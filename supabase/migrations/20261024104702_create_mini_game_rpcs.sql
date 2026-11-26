-- ============================================================
-- Mini Jackpot Games — Server-Side RPCs
--
-- All functions use SECURITY DEFINER + SET search_path = public
-- and follow the same auth.uid() ownership-check pattern as
-- apply_spin_result (harden_spin_rpc.sql).
--
-- Functions defined here:
--   1. generate_mini_game_outcome  — PRNG helper (internal only)
--   2. play_mini_game              — single-phase game round
--   3. initiate_mini_game          — two-phase: Phase 1 (debit + store outcome)
--   4. claim_mini_game_result      — two-phase: Phase 2 (reveal + credit payout)
--   5. get_mini_game_history       — player round history (last ≤20)
--   6. update_mini_game_config     — admin config upsert with audit log
--
-- Prerequisites (earlier migrations must have run):
--   • create_mini_game_config.sql
--   • create_mini_game_rounds.sql
--   • complete_admin_setup.sql  (defines get_my_admin_role, admin_audit_logs)
--
-- Safe to re-run: all functions use CREATE OR REPLACE.
-- ============================================================


-- ── Function 1: generate_mini_game_outcome ──────────────────────────────────
--
-- Performs a weighted random selection over the prize_tiers JSONB array.
-- Each tier must have a "probability" key (fraction in [0,1]) and the
-- probabilities must sum to 1.00 (enforced by update_mini_game_config).
--
-- Uses gen_random_bytes(4) four times to build a 32-bit uniform random
-- value mapped to [0, 1).  Four separate calls are intentional: each call
-- to gen_random_bytes is independently seeded, so combining them avoids
-- any sequential-PRNG bias that a single-byte approach could introduce.
--
-- This function is called only from other SECURITY DEFINER functions;
-- no direct GRANT is needed.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_mini_game_outcome(
  p_prize_tiers jsonb,
  p_game_id     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_roll         numeric;
  v_cumul        numeric := 0;
  v_tier         jsonb;
  v_tier_index   int := 0;
  v_current_idx  int := 0;
BEGIN
  -- Build a uniform random number in [0, 1) from four independent
  -- cryptographically secure random bytes.
  v_roll := (
    get_byte(gen_random_bytes(4), 0) * 16777216.0 +
    get_byte(gen_random_bytes(4), 0) *    65536.0 +
    get_byte(gen_random_bytes(4), 0) *      256.0 +
    get_byte(gen_random_bytes(4), 0)
  ) / 4294967296.0;

  -- Walk through tiers accumulating probability; return when roll is covered.
  -- Include segment_index in the returned JSONB so the client can animate
  -- the wheel (or other indexed-segment games) to the correct position.
  FOR v_tier IN SELECT value FROM jsonb_array_elements(p_prize_tiers) AS t(value)
  LOOP
    v_cumul := v_cumul + (v_tier->>'probability')::numeric;
    IF v_roll < v_cumul THEN
      RETURN v_tier || jsonb_build_object('segment_index', v_current_idx);
    END IF;
    v_current_idx := v_current_idx + 1;
  END LOOP;

  -- Fallback: floating-point rounding may leave v_roll marginally above the
  -- accumulated sum even when probabilities were intended to sum to 1.00.
  -- Return the last tier rather than raising an error.
  v_tier_index := jsonb_array_length(p_prize_tiers) - 1;
  RETURN (p_prize_tiers -> v_tier_index) || jsonb_build_object('segment_index', v_tier_index);
END;
$$;


-- ── Function 2: play_mini_game ───────────────────────────────────────────────
--
-- Single-phase game round for: Neon Lucky Wheel, Mini Slot Jackpot,
-- Mystery Multiplier, Crystal Match.
--
-- All steps execute in the implicit PL/pgSQL transaction:
--   1. Auth check
--   2. Idempotency check  — return existing result on duplicate key
--   3. Load + validate config
--   4. Validate stake
--   5. Lock profile balance (FOR UPDATE)
--   6. Account status check
--   7. Generate outcome server-side
--   8. Compute payout
--   9. Atomic balance update
--  10. Insert round record
--  11. Return result payload
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.play_mini_game(text, uuid, numeric, uuid);

CREATE OR REPLACE FUNCTION public.play_mini_game(
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
  v_payout          numeric;
  v_round_id        uuid;
  v_existing        mini_game_rounds%ROWTYPE;
BEGIN
  -- ── 1. Auth check ────────────────────────────────────────────────────────
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- ── 2. Idempotency ───────────────────────────────────────────────────────
  SELECT * INTO v_existing
    FROM mini_game_rounds
   WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'round_id',    v_existing.id,
      'outcome',     v_existing.outcome,
      'payout',      v_existing.payout,
      'new_balance', (SELECT balance FROM profiles WHERE id = p_user_id),
      'duplicate',   true
    );
  END IF;

  -- ── 3. Load and validate config ──────────────────────────────────────────
  SELECT * INTO v_config
    FROM mini_game_config
   WHERE game_id = p_game_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;
  IF NOT v_config.enabled THEN
    RAISE EXCEPTION 'Game not available';
  END IF;
  IF v_config.maintenance THEN
    RAISE EXCEPTION 'Game under maintenance';
  END IF;

  -- ── 4. Validate stake ────────────────────────────────────────────────────
  IF p_stake IS NULL OR p_stake <= 0 THEN
    RAISE EXCEPTION 'Stake must be positive';
  END IF;
  IF p_stake < v_config.min_bet THEN
    RAISE EXCEPTION 'Stake below minimum';
  END IF;
  IF p_stake > v_config.max_bet THEN
    RAISE EXCEPTION 'Stake above maximum';
  END IF;

  -- ── 5. Lock balance ──────────────────────────────────────────────────────
  SELECT balance, account_status
    INTO v_balance, v_account_status
    FROM profiles
   WHERE id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_balance < p_stake THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- ── 6. Account status check ──────────────────────────────────────────────
  IF v_account_status IN ('banned', 'suspended') THEN
    RAISE EXCEPTION 'Account restricted';
  END IF;

  -- ── 7. Generate outcome ──────────────────────────────────────────────────
  v_outcome := generate_mini_game_outcome(v_config.prize_tiers, p_game_id);

  -- ── 8. Compute payout ────────────────────────────────────────────────────
  v_payout := ROUND(p_stake * (v_outcome->>'multiplier')::numeric, 2);

  -- ── 9. Atomic balance update ─────────────────────────────────────────────
  v_new_balance := ROUND((v_balance - p_stake + v_payout)::numeric, 2);
  IF v_new_balance < 0 THEN
    v_new_balance := 0;
  END IF;

  UPDATE profiles
     SET balance    = v_new_balance,
         updated_at = now()
   WHERE id = p_user_id;

  -- ── 10. Insert round record ───────────────────────────────────────────────
  v_round_id := gen_random_uuid();

  INSERT INTO mini_game_rounds
    (id, idempotency_key, user_id, game_id, stake, outcome, payout, phase, settled_at)
  VALUES
    (v_round_id, p_idempotency_key, p_user_id, p_game_id,
     p_stake, v_outcome, v_payout, 'complete', now());

  -- ── 11. Return result ─────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'round_id',    v_round_id,
    'outcome',     v_outcome,
    'payout',      v_payout,
    'new_balance', v_new_balance
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.play_mini_game(text, uuid, numeric, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.play_mini_game(text, uuid, numeric, uuid) TO authenticated;


-- ── Function 3: initiate_mini_game ──────────────────────────────────────────
--
-- Phase 1 of the two-phase flow for: Neon Scratch Cards, Cyber Treasure Chest.
--
-- Debits the stake and generates the outcome server-side, storing it in
-- mini_game_rounds with phase = 'pending'.  Returns only the round_id so
-- the client cannot know the result before committing to the reveal
-- interaction.
--
-- Steps mirror play_mini_game up to balance lock, then diverge:
--   • Debit stake only (no payout yet)
--   • Insert round with phase = 'pending', payout = 0, settled_at = NULL
--   • Return ONLY round_id — outcome deliberately withheld
-- ─────────────────────────────────────────────────────────────────────────────
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
BEGIN
  -- ── 1. Auth check ────────────────────────────────────────────────────────
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- ── 2. Idempotency ───────────────────────────────────────────────────────
  SELECT * INTO v_existing
    FROM mini_game_rounds
   WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'round_id',  v_existing.id,
      'duplicate', true
    );
  END IF;

  -- ── 3. Load and validate config ──────────────────────────────────────────
  SELECT * INTO v_config
    FROM mini_game_config
   WHERE game_id = p_game_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;
  IF NOT v_config.enabled THEN
    RAISE EXCEPTION 'Game not available';
  END IF;
  IF v_config.maintenance THEN
    RAISE EXCEPTION 'Game under maintenance';
  END IF;

  -- ── 4. Validate stake ────────────────────────────────────────────────────
  IF p_stake IS NULL OR p_stake <= 0 THEN
    RAISE EXCEPTION 'Stake must be positive';
  END IF;
  IF p_stake < v_config.min_bet THEN
    RAISE EXCEPTION 'Stake below minimum';
  END IF;
  IF p_stake > v_config.max_bet THEN
    RAISE EXCEPTION 'Stake above maximum';
  END IF;

  -- ── 5. Lock balance ──────────────────────────────────────────────────────
  SELECT balance, account_status
    INTO v_balance, v_account_status
    FROM profiles
   WHERE id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_balance < p_stake THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- ── 6. Account status check ──────────────────────────────────────────────
  IF v_account_status IN ('banned', 'suspended') THEN
    RAISE EXCEPTION 'Account restricted';
  END IF;

  -- ── 7. Generate outcome server-side (stored; not returned to client) ──────
  v_outcome := generate_mini_game_outcome(v_config.prize_tiers, p_game_id);

  -- ── 8. Debit stake only ───────────────────────────────────────────────────
  v_new_balance := ROUND((v_balance - p_stake)::numeric, 2);

  UPDATE profiles
     SET balance    = v_new_balance,
         updated_at = now()
   WHERE id = p_user_id;

  -- ── 9. Insert pending round ───────────────────────────────────────────────
  v_round_id := gen_random_uuid();

  INSERT INTO mini_game_rounds
    (id, idempotency_key, user_id, game_id, stake, outcome, payout, phase, settled_at)
  VALUES
    (v_round_id, p_idempotency_key, p_user_id, p_game_id,
     p_stake, v_outcome, 0, 'pending', NULL);

  -- ── 10. Return round_id only — outcome deliberately withheld ─────────────
  RETURN jsonb_build_object(
    'round_id', v_round_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.initiate_mini_game(text, uuid, numeric, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.initiate_mini_game(text, uuid, numeric, uuid) TO authenticated;


-- ── Function 4: claim_mini_game_result ──────────────────────────────────────
--
-- Phase 2 of the two-phase flow.
--
-- Validates the pending round, credits the payout, marks phase = 'complete',
-- and returns the outcome with the new balance.
--
-- Re-claiming an already-complete round is idempotent: returns the existing
-- result without error or additional credit (safe for network retries after
-- the client missed the Phase 2 response).
--
-- p_selection (optional) is accepted for future use by games that need the
-- player's choice forwarded to the server (e.g. Treasure Chest chest index).
-- The current implementation ignores it; the outcome was determined in Phase 1.
-- ─────────────────────────────────────────────────────────────────────────────
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
  v_round       mini_game_rounds%ROWTYPE;
  v_config      mini_game_config%ROWTYPE;
  v_payout      numeric;
  v_balance     numeric;
  v_new_balance numeric;
BEGIN
  -- ── 1. Auth check ────────────────────────────────────────────────────────
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- ── 2. Load and lock round ───────────────────────────────────────────────
  SELECT * INTO v_round
    FROM mini_game_rounds
   WHERE id = p_round_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Round not found';
  END IF;

  IF v_round.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Idempotent re-claim: round already settled — return stored result.
  IF v_round.phase <> 'pending' THEN
    RETURN jsonb_build_object(
      'round_id',       v_round.id,
      'outcome',        v_round.outcome,
      'payout',         v_round.payout,
      'already_claimed', true
    );
  END IF;

  -- ── 3. Load config (needed for context; multiplier is in outcome jsonb) ───
  SELECT * INTO v_config
    FROM mini_game_config
   WHERE game_id = v_round.game_id;

  -- ── 4. Compute payout from the stored outcome ────────────────────────────
  v_payout := ROUND(v_round.stake * (v_round.outcome->>'multiplier')::numeric, 2);

  -- ── 5. Lock profile and credit payout ────────────────────────────────────
  SELECT balance INTO v_balance
    FROM profiles
   WHERE id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  v_new_balance := ROUND((v_balance + v_payout)::numeric, 2);

  UPDATE profiles
     SET balance    = v_new_balance,
         updated_at = now()
   WHERE id = p_user_id;

  -- ── 6. Settle the round ───────────────────────────────────────────────────
  UPDATE mini_game_rounds
     SET payout     = v_payout,
         phase      = 'complete',
         settled_at = now()
   WHERE id = p_round_id;

  -- ── 7. Return result ──────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'round_id',    p_round_id,
    'outcome',     v_round.outcome,
    'payout',      v_payout,
    'new_balance', v_new_balance
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_mini_game_result(uuid, jsonb, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.claim_mini_game_result(uuid, jsonb, uuid) TO authenticated;


-- ── Function 5: get_mini_game_history ───────────────────────────────────────
--
-- Returns the most recent completed rounds for the calling player.
-- p_game_id = '' (empty string) returns rounds across all games.
-- Capped at 20 entries regardless of p_limit to bound data transfer.
--
-- Implemented in plpgsql (not sql) so we can add the auth.uid() guard;
-- the SECURITY DEFINER bypasses RLS, so without the guard a caller could
-- pass any UUID and read another player's history.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_mini_game_history(text, int, uuid);

CREATE OR REPLACE FUNCTION public.get_mini_game_history(
  p_game_id text DEFAULT '',
  p_limit   int  DEFAULT 20,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  round_id   uuid,
  game_id    text,
  stake      numeric,
  payout     numeric,
  net_result numeric,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auth check: callers may only fetch their own history.
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
    SELECT
      r.id              AS round_id,
      r.game_id         AS game_id,
      r.stake           AS stake,
      r.payout          AS payout,
      (r.payout - r.stake) AS net_result,
      r.created_at      AS created_at
    FROM mini_game_rounds r
   WHERE r.user_id = p_user_id
     AND (p_game_id = '' OR r.game_id = p_game_id)
     AND r.phase = 'complete'
   ORDER BY r.created_at DESC
   LIMIT LEAST(p_limit, 20);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_mini_game_history(text, int, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_mini_game_history(text, int, uuid) TO authenticated;


-- ── Function 6: update_mini_game_config ─────────────────────────────────────
--
-- Admin-only RPC to create or update a mini game configuration.
-- Requires admin role of 'super_admin' or 'game_manager'.
--
-- Validates:
--   • min_bet > 0
--   • max_bet > min_bet
--   • prize_tiers array length ≤ 20
--   • every tier's multiplier > 0
--   • probabilities sum to exactly 1.0000 (within 4 decimal places)
--
-- On success: UPSERTs mini_game_config and inserts an admin_audit_log entry.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_mini_game_config(
  p_game_id text,
  p_config  jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role  text;
  v_min_bet     numeric;
  v_max_bet     numeric;
  v_tiers       jsonb;
  v_tier_count  int;
  v_tier        jsonb;
  v_prob_sum    numeric := 0;
BEGIN
  -- ── 1. Admin role check ───────────────────────────────────────────────────
  v_admin_role := public.get_my_admin_role();

  IF v_admin_role NOT IN ('super_admin', 'game_manager') THEN
    RAISE EXCEPTION 'Insufficient admin role: super_admin or game_manager required';
  END IF;

  -- ── 2. Extract and validate fields ───────────────────────────────────────

  -- min_bet
  v_min_bet := (p_config->>'min_bet')::numeric;
  IF v_min_bet IS NULL OR v_min_bet <= 0 THEN
    RAISE EXCEPTION 'min_bet must be greater than 0';
  END IF;

  -- max_bet
  v_max_bet := (p_config->>'max_bet')::numeric;
  IF v_max_bet IS NULL OR v_max_bet <= v_min_bet THEN
    RAISE EXCEPTION 'max_bet must be greater than min_bet';
  END IF;

  -- prize_tiers count
  v_tiers      := p_config->'prize_tiers';
  v_tier_count := jsonb_array_length(v_tiers);

  IF v_tier_count > 20 THEN
    RAISE EXCEPTION 'prize_tiers cannot exceed 20 entries';
  END IF;

  -- Per-tier: multiplier >= 0; accumulate probability sum
  -- Note: multiplier = 0 is valid (represents a losing/no-prize outcome)
  FOR v_tier IN SELECT value FROM jsonb_array_elements(v_tiers) AS t(value)
  LOOP
    IF (v_tier->>'multiplier')::numeric < 0 THEN
      RAISE EXCEPTION 'All multipliers must be greater than or equal to 0';
    END IF;
    v_prob_sum := v_prob_sum + (v_tier->>'probability')::numeric;
  END LOOP;

  -- Probability sum must equal 1.0000 (rounded to 4 decimal places)
  IF ROUND(v_prob_sum::numeric, 4) <> 1.0000 THEN
    RAISE EXCEPTION
      'Outcome probabilities must sum to 1.00 (100%%), got %',
      v_prob_sum;
  END IF;

  -- ── 3. Upsert config ──────────────────────────────────────────────────────
  INSERT INTO mini_game_config
    (game_id, enabled, min_bet, max_bet, prize_tiers,
     outcome_probabilities, maintenance, game_specific_rules, updated_at)
  VALUES (
    p_game_id,
    COALESCE((p_config->>'enabled')::boolean,   false),
    v_min_bet,
    v_max_bet,
    v_tiers,
    COALESCE(p_config->'outcome_probabilities', '{}'::jsonb),
    COALESCE((p_config->>'maintenance')::boolean, false),
    COALESCE(p_config->'game_specific_rules',   '{}'::jsonb),
    now()
  )
  ON CONFLICT (game_id) DO UPDATE SET
    enabled               = EXCLUDED.enabled,
    min_bet               = EXCLUDED.min_bet,
    max_bet               = EXCLUDED.max_bet,
    prize_tiers           = EXCLUDED.prize_tiers,
    outcome_probabilities = EXCLUDED.outcome_probabilities,
    maintenance           = EXCLUDED.maintenance,
    game_specific_rules   = EXCLUDED.game_specific_rules,
    updated_at            = now();

  -- ── 4. Audit log ──────────────────────────────────────────────────────────
  INSERT INTO admin_audit_logs
    (admin_id, admin_role, action_type, target_entity, target_id,
     new_value, created_at)
  VALUES
    (auth.uid(), v_admin_role, 'update_mini_game_config',
     'mini_game_config', p_game_id,
     p_config, now());

  -- ── 5. Return success ─────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'success', true,
    'game_id', p_game_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_mini_game_config(text, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_mini_game_config(text, jsonb) TO authenticated;


-- ── Reload PostgREST schema cache ─────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
