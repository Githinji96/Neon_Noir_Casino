-- ============================================================
-- Cyber Treasure Chest: 5 Chests, 1 Winner Model
--
-- DESIGN:
--   5 treasure chests are displayed. Exactly 1 contains a prize.
--   The player picks 1 chest — 20% chance of winning.
--
--   The winning chest's prize tier is drawn from the prize_tiers
--   distribution ON EVERY ROUND. The 4 losing chests are always
--   Empty (0x multiplier).
--
-- THEORETICAL RTP CALCULATION:
--   P(win) = 1/5 = 0.20
--   Prize tier distribution when winning:
--     Empty (0x):   probability 0.00  (losing chests handle emptiness)
--     1x:           probability 0.55  -> contribution: 0.20 * 0.55 * 1.0 = 0.110
--     2x:           probability 0.30  -> contribution: 0.20 * 0.30 * 2.0 = 0.120
--     4.5x:         probability 0.12  -> contribution: 0.20 * 0.12 * 4.5 = 0.108
--     10x:          probability 0.03  -> contribution: 0.20 * 0.03 * 10  = 0.060
--
--   Total RTP = 0.110 + 0.120 + 0.108 + 0.060 = 0.398
--   That is too low. Let's recalculate to target 90% RTP.
--
-- TARGET: RTP = 90%, House Edge = 10%
--   RTP = P(win) * E[gross_multiplier | win]
--   0.90 = 0.20 * E[M]
--   E[M] = 0.90 / 0.20 = 4.5
--
--   Prize tier distribution must average 4.5× gross return:
--     1x at 0.55:  0.55 * 1.0 = 0.55
--     2.5x at 0.25: 0.25 * 2.5 = 0.625
--     6x at 0.15:  0.15 * 6.0 = 0.90
--     15x at 0.05: 0.05 * 15  = 0.75
--     E[M] = 0.55 + 0.625 + 0.90 + 0.75 = 2.825  (still too low)
--
--   Needs higher multipliers. Try:
--     1x at 0.50:  0.50 * 1.0 = 0.50
--     3x at 0.30:  0.30 * 3.0 = 0.90
--     7x at 0.15:  0.15 * 7.0 = 1.05
--     18x at 0.05: 0.05 * 18  = 0.90
--     E[M] = 0.50 + 0.90 + 1.05 + 0.90 = 3.35  (still too low)
--
--   To get E[M] = 4.5 with 4 tiers and reasonable prizes:
--     1x at 0.45:  0.45 * 1.0  = 0.45
--     3x at 0.30:  0.30 * 3.0  = 0.90
--     8x at 0.18:  0.18 * 8.0  = 1.44
--     25x at 0.07: 0.07 * 25.0 = 1.75
--     E[M] = 0.45 + 0.90 + 1.44 + 1.75 = 4.54 ~= 4.5 ✓
--
--   Actual RTP = 0.20 * 4.54 = 0.908 = 90.8%
--   House Edge = 9.2%
--
-- BACKEND LOGIC CHANGE:
--   initiate_mini_game for treasure-chest now:
--   1. Draws a prize tier using the prize_tiers probabilities (determines the win prize)
--   2. Randomly assigns a "winning chest index" (0 to chest_count-1)
--   3. Stores: { prize_index: N, multiplier: M, label: L, segment_index: tier_idx }
--   4. claim_mini_game_result uses outcome.prize_index to check if player selected
--      the correct chest, and pays outcome.multiplier only if selected_index == prize_index
-- ============================================================

-- 1. Update prize tiers and chest count
UPDATE public.mini_game_config SET
  prize_tiers = '[
    {"label": "1x",  "multiplier": 1.0,  "probability": 0.45, "symbol": "coin"},
    {"label": "3x",  "multiplier": 3.0,  "probability": 0.30, "symbol": "gem"},
    {"label": "8x",  "multiplier": 8.0,  "probability": 0.18, "symbol": "diamond"},
    {"label": "25x", "multiplier": 25.0, "probability": 0.07, "symbol": "crown"}
  ]'::jsonb,
  game_specific_rules = '{"chest_count": 5}'::jsonb,
  theoretical_rtp     = 0.9080,
  rtp_tolerance       = 0.0200,
  updated_at          = now()
WHERE game_id = 'treasure-chest';


-- 2. Dedicated initiate_mini_game for treasure-chest
--
--    For treasure-chest the RPC must:
--    a) Draw the prize tier (determines prize amount)
--    b) Pick a random winning chest index (0 to chest_count-1)
--    c) Store both in the outcome
--    d) Debit stake, store pending round
--    e) Return round_id only (outcome hidden)
--
--    claim_mini_game_result then:
--    a) Receives p_selection = { selected_index: N }
--    b) Checks if selected_index == outcome.prize_index
--    c) Pays multiplier if match, 0 if not
--    d) Records player's selected_index alongside the outcome
--
--    This replaces the old initiate_mini_game for ALL games.
--    The key change: outcome now includes prize_index for pick-a-chest games.
DROP FUNCTION IF EXISTS public.initiate_mini_game(text, uuid, numeric, uuid);

CREATE OR REPLACE FUNCTION public.initiate_mini_game(
  p_game_id         text,
  p_idempotency_key uuid,
  p_stake           numeric,
  p_user_id         uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config          mini_game_config%ROWTYPE;
  v_balance         numeric;
  v_account_status  text;
  v_new_balance     numeric;
  v_outcome         jsonb;
  v_round_id        uuid;
  v_existing        mini_game_rounds%ROWTYPE;
  v_chest_count     int;
  v_prize_idx       int;
  v_roll_chest      numeric;
  v_cumul           numeric := 0;
  v_tier            jsonb;
  v_tier_idx        int := 0;
  v_last_idx        int;
BEGIN
  -- 1. Auth check
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- 2. Idempotency
  SELECT * INTO v_existing FROM mini_game_rounds WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('round_id', v_existing.id, 'duplicate', true);
  END IF;

  -- 3. Load and validate config
  SELECT * INTO v_config FROM mini_game_config WHERE game_id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found: %', p_game_id; END IF;
  IF NOT v_config.enabled THEN RAISE EXCEPTION 'Game not available'; END IF;
  IF v_config.maintenance THEN RAISE EXCEPTION 'Game under maintenance'; END IF;
  IF jsonb_array_length(v_config.prize_tiers) = 0 THEN
    RAISE EXCEPTION 'Game has no prize tiers configured';
  END IF;

  -- 4. Validate stake
  IF p_stake IS NULL OR p_stake <= 0 THEN RAISE EXCEPTION 'Stake must be positive'; END IF;
  IF p_stake < v_config.min_bet THEN RAISE EXCEPTION 'Stake below minimum'; END IF;
  IF p_stake > v_config.max_bet THEN RAISE EXCEPTION 'Stake above maximum'; END IF;

  -- 5. Lock balance
  SELECT balance, account_status INTO v_balance, v_account_status
    FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_balance < p_stake THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  IF v_account_status IN ('banned', 'suspended') THEN RAISE EXCEPTION 'Account restricted'; END IF;

  -- 6. Generate prize tier outcome using CSPRNG
  v_roll_chest := (
    ('x' || lpad(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8), 8, '0'))::bit(32)::bigint::numeric
  ) / 4294967296.0;

  FOR v_tier IN SELECT value FROM jsonb_array_elements(v_config.prize_tiers) AS t(value)
  LOOP
    v_cumul := v_cumul + (v_tier->>'probability')::numeric;
    IF v_roll_chest < v_cumul THEN
      v_outcome := v_tier || jsonb_build_object('segment_index', v_tier_idx);
      EXIT;
    END IF;
    v_tier_idx := v_tier_idx + 1;
  END LOOP;
  -- Fallback
  IF v_outcome IS NULL THEN
    v_last_idx := jsonb_array_length(v_config.prize_tiers) - 1;
    v_outcome := (v_config.prize_tiers -> v_last_idx) || jsonb_build_object('segment_index', v_last_idx);
  END IF;

  -- 7. For pick-a-chest games: randomly assign the winning chest index
  --    Uses a second independent CSPRNG call so prize tier and chest position
  --    are independently random (no correlation).
  IF p_game_id = 'treasure-chest' THEN
    v_chest_count := COALESCE(
      (v_config.game_specific_rules->>'chest_count')::int,
      3
    );
    v_chest_count := GREATEST(2, LEAST(10, v_chest_count));

    -- Roll for winning chest position (0 to chest_count-1)
    v_prize_idx := floor(
      ((('x' || lpad(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8), 8, '0'))::bit(32)::bigint::numeric
       / 4294967296.0) * v_chest_count)::int
    );
    v_prize_idx := GREATEST(0, LEAST(v_chest_count - 1, v_prize_idx));

    -- Embed prize_index into the outcome so claim_mini_game_result can use it
    v_outcome := v_outcome || jsonb_build_object('prize_index', v_prize_idx);
  END IF;

  -- 8. Debit stake only (payout settled in Phase 2)
  v_new_balance := ROUND((v_balance - p_stake)::numeric, 2);
  UPDATE profiles SET balance = v_new_balance, updated_at = now() WHERE id = p_user_id;

  -- 9. Insert pending round (outcome stored, not returned to client)
  v_round_id := gen_random_uuid();
  INSERT INTO mini_game_rounds
    (id, idempotency_key, user_id, game_id, stake, outcome, payout, phase, settled_at)
  VALUES
    (v_round_id, p_idempotency_key, p_user_id, p_game_id, p_stake, v_outcome, 0, 'pending', NULL);

  RETURN jsonb_build_object('round_id', v_round_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.initiate_mini_game(text, uuid, numeric, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.initiate_mini_game(text, uuid, numeric, uuid) TO authenticated;


-- 3. Update claim_mini_game_result to correctly settle treasure-chest
--    The key fix: for treasure-chest, payout is only awarded if
--    p_selection.selected_index == outcome.prize_index.
--    For other games (scratch cards), settlement is as before.
DROP FUNCTION IF EXISTS public.claim_mini_game_result(uuid, jsonb, uuid);

CREATE OR REPLACE FUNCTION public.claim_mini_game_result(
  p_round_id   uuid,
  p_selection  jsonb DEFAULT NULL,
  p_user_id    uuid  DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round          mini_game_rounds%ROWTYPE;
  v_config         mini_game_config%ROWTYPE;
  v_payout         numeric;
  v_balance        numeric;
  v_new_balance    numeric;
  v_selected_index int;
  v_prize_index    int;
  v_multiplier     numeric;
  v_final_outcome  jsonb;
BEGIN
  -- 1. Auth check
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- 2. Load and lock round
  SELECT * INTO v_round FROM mini_game_rounds WHERE id = p_round_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Round not found'; END IF;
  IF v_round.user_id IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Access denied'; END IF;

  -- 3. Idempotent re-claim for already-settled round
  IF v_round.phase <> 'pending' THEN
    RETURN jsonb_build_object(
      'round_id',        v_round.id,
      'outcome',         v_round.outcome,
      'payout',          v_round.payout,
      'already_claimed', true
    );
  END IF;

  -- 4. Load config (for max_payout_per_round)
  SELECT * INTO v_config FROM mini_game_config WHERE game_id = v_round.game_id;

  -- 5. Determine payout based on game type
  IF v_round.game_id = 'treasure-chest' THEN
    -- Treasure chest: payout only if player selected the winning chest
    v_selected_index := COALESCE((p_selection->>'selected_index')::int, -1);
    v_prize_index    := COALESCE((v_round.outcome->>'prize_index')::int, -999);
    v_multiplier     := COALESCE((v_round.outcome->>'multiplier')::numeric, 0);

    IF v_selected_index = v_prize_index THEN
      -- Correct chest — award the prize
      v_payout := ROUND(v_round.stake * v_multiplier, 2);
    ELSE
      -- Wrong chest — no payout
      v_payout := 0;
    END IF;

    -- Embed the player's choice into the outcome for audit trail
    v_final_outcome := v_round.outcome || jsonb_build_object('selected_index', v_selected_index);
  ELSE
    -- Other two-phase games (scratch cards etc.): multiplier from stored outcome
    v_multiplier    := COALESCE((v_round.outcome->>'multiplier')::numeric, 0);
    v_payout        := ROUND(v_round.stake * v_multiplier, 2);
    v_final_outcome := v_round.outcome
                       || jsonb_build_object('selected_index',
                            COALESCE((p_selection->>'selected_index')::int, NULL));
  END IF;

  -- 6. Enforce per-round payout cap
  IF v_config.max_payout_per_round IS NOT NULL AND v_payout > v_config.max_payout_per_round THEN
    v_payout := v_config.max_payout_per_round;
  END IF;

  -- 7. Credit payout to player balance
  SELECT balance INTO v_balance FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

  v_new_balance := ROUND((v_balance + v_payout)::numeric, 2);
  UPDATE profiles SET balance = v_new_balance, updated_at = now() WHERE id = p_user_id;

  -- 8. Settle the round
  UPDATE mini_game_rounds
     SET payout     = v_payout,
         outcome    = v_final_outcome,
         phase      = 'complete',
         settled_at = now()
   WHERE id = p_round_id;

  RETURN jsonb_build_object(
    'round_id',    p_round_id,
    'outcome',     v_final_outcome,
    'payout',      v_payout,
    'net_result',  v_payout - v_round.stake,
    'new_balance', v_new_balance
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_mini_game_result(uuid, jsonb, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.claim_mini_game_result(uuid, jsonb, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
