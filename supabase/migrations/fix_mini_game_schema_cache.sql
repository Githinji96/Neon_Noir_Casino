-- ============================================================
-- Fix Mini Game Schema Cache
--
-- Drops and recreates play_mini_game to force PostgREST schema
-- cache refresh. Run this in Supabase SQL Editor if the RPC
-- returns "Could not find the function ... in the schema cache".
-- ============================================================

-- Drop ALL overloads of play_mini_game to clear any stale signatures
DROP FUNCTION IF EXISTS public.play_mini_game(text, uuid, numeric, uuid);
DROP FUNCTION IF EXISTS public.play_mini_game(uuid, text, numeric, uuid);
DROP FUNCTION IF EXISTS public.play_mini_game(text, uuid, numeric);
DROP FUNCTION IF EXISTS public.play_mini_game;

-- Recreate with explicit named parameters
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
  v_cumul           numeric := 0;
  v_roll            numeric;
  v_tier            jsonb;
  v_tier_idx        int := 0;
  v_selected_idx    int := 0;
BEGIN
  -- ── 1. Auth check
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- ── 2. Idempotency
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

  -- ── 3. Load and validate config
  SELECT * INTO v_config
    FROM mini_game_config
   WHERE game_id = p_game_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found: %', p_game_id;
  END IF;
  IF NOT v_config.enabled THEN
    RAISE EXCEPTION 'Game not available';
  END IF;
  IF v_config.maintenance THEN
    RAISE EXCEPTION 'Game under maintenance';
  END IF;
  IF jsonb_array_length(v_config.prize_tiers) = 0 THEN
    RAISE EXCEPTION 'Game has no prize tiers configured';
  END IF;

  -- ── 4. Validate stake
  IF p_stake IS NULL OR p_stake <= 0 THEN
    RAISE EXCEPTION 'Stake must be positive';
  END IF;
  IF p_stake < v_config.min_bet THEN
    RAISE EXCEPTION 'Stake below minimum (min: %)', v_config.min_bet;
  END IF;
  IF p_stake > v_config.max_bet THEN
    RAISE EXCEPTION 'Stake above maximum (max: %)', v_config.max_bet;
  END IF;

  -- ── 5. Lock balance
  SELECT balance, account_status
    INTO v_balance, v_account_status
    FROM profiles
   WHERE id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_balance < p_stake THEN
    RAISE EXCEPTION 'Insufficient balance (have: %, need: %)', v_balance, p_stake;
  END IF;

  -- ── 6. Account status check
  IF v_account_status IN ('banned', 'suspended') THEN
    RAISE EXCEPTION 'Account restricted';
  END IF;

  -- ── 7. Generate outcome inline (with segment_index)
  v_roll := (
    get_byte(gen_random_bytes(4), 0) * 16777216.0 +
    get_byte(gen_random_bytes(4), 0) *    65536.0 +
    get_byte(gen_random_bytes(4), 0) *      256.0 +
    get_byte(gen_random_bytes(4), 0)
  ) / 4294967296.0;

  FOR v_tier IN
    SELECT value FROM jsonb_array_elements(v_config.prize_tiers) AS t(value)
  LOOP
    v_cumul := v_cumul + (v_tier->>'probability')::numeric;
    IF v_roll < v_cumul THEN
      v_outcome := v_tier || jsonb_build_object('segment_index', v_tier_idx);
      EXIT;
    END IF;
    v_tier_idx := v_tier_idx + 1;
  END LOOP;

  -- Fallback: pick last tier
  IF v_outcome IS NULL THEN
    v_selected_idx := jsonb_array_length(v_config.prize_tiers) - 1;
    v_outcome := (v_config.prize_tiers -> v_selected_idx)
                 || jsonb_build_object('segment_index', v_selected_idx);
  END IF;

  -- ── 8. Compute payout (multiplier=0 is valid — means no win)
  v_payout := ROUND(p_stake * COALESCE((v_outcome->>'multiplier')::numeric, 0), 2);

  -- ── 9. Atomic balance update
  v_new_balance := ROUND((v_balance - p_stake + v_payout)::numeric, 2);
  IF v_new_balance < 0 THEN
    v_new_balance := 0;
  END IF;

  UPDATE profiles
     SET balance    = v_new_balance,
         updated_at = now()
   WHERE id = p_user_id;

  -- ── 10. Insert round record
  v_round_id := gen_random_uuid();

  INSERT INTO mini_game_rounds
    (id, idempotency_key, user_id, game_id, stake, outcome, payout, phase, settled_at)
  VALUES
    (v_round_id, p_idempotency_key, p_user_id, p_game_id,
     p_stake, v_outcome, v_payout, 'complete', now());

  -- ── 11. Return result
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

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';

-- Confirm the function exists with correct signature
SELECT
  p.proname,
  pg_get_function_arguments(p.oid) AS args,
  p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'play_mini_game';
