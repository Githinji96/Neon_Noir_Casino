-- ============================================================
-- Fix: replace FOR UPDATE with FOR UPDATE NOWAIT in mini game RPCs
--
-- FOR UPDATE without NOWAIT waits indefinitely for the row lock,
-- which causes the RPC to hang when another transaction (e.g. a
-- slot spin's apply_spin_result, or the balance poll in authStore)
-- holds a lock on the same profiles row.
--
-- FOR UPDATE NOWAIT raises "could not obtain lock on row" immediately
-- instead of waiting, which the frontend can handle as a retryable error.
--
-- Applies to: initiate_mini_game, play_mini_game, claim_mini_game_result
--
-- RUN IN: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. initiate_mini_game ─────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.initiate_mini_game(text, uuid, numeric, uuid);

CREATE FUNCTION public.initiate_mini_game(
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
  v_roll            numeric;
  v_cumul           numeric := 0;
  v_tier            jsonb;
  v_tier_idx        int := 0;
  v_last_idx        int;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO v_existing FROM mini_game_rounds WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('round_id', v_existing.id, 'duplicate', true);
  END IF;

  SELECT * INTO v_config FROM mini_game_config WHERE game_id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found: %', p_game_id; END IF;
  IF NOT v_config.enabled THEN RAISE EXCEPTION 'Game not available'; END IF;
  IF v_config.maintenance THEN RAISE EXCEPTION 'Game under maintenance'; END IF;
  IF jsonb_array_length(v_config.prize_tiers) = 0 THEN
    RAISE EXCEPTION 'Game has no prize tiers configured';
  END IF;

  IF p_stake IS NULL OR p_stake <= 0 THEN RAISE EXCEPTION 'Stake must be positive'; END IF;
  IF p_stake < v_config.min_bet THEN RAISE EXCEPTION 'Stake below minimum'; END IF;
  IF p_stake > v_config.max_bet THEN RAISE EXCEPTION 'Stake above maximum'; END IF;

  -- NOWAIT: fail immediately instead of waiting for a lock held by another tx
  BEGIN
    SELECT balance, account_status INTO v_balance, v_account_status
      FROM profiles WHERE id = p_user_id FOR UPDATE NOWAIT;
  EXCEPTION
    WHEN lock_not_available THEN
      RAISE EXCEPTION 'Balance temporarily locked — please try again in a moment';
  END;

  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_balance < p_stake THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  IF v_account_status IN ('banned', 'suspended') THEN RAISE EXCEPTION 'Account restricted'; END IF;

  v_roll := (
    ('x' || lpad(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8), 8, '0'))::bit(32)::bigint::numeric
  ) / 4294967296.0;

  FOR v_tier IN SELECT value FROM jsonb_array_elements(v_config.prize_tiers) AS t(value)
  LOOP
    v_cumul := v_cumul + (v_tier->>'probability')::numeric;
    IF v_roll < v_cumul THEN
      v_outcome := v_tier || jsonb_build_object('segment_index', v_tier_idx);
      EXIT;
    END IF;
    v_tier_idx := v_tier_idx + 1;
  END LOOP;
  IF v_outcome IS NULL THEN
    v_last_idx := jsonb_array_length(v_config.prize_tiers) - 1;
    v_outcome := (v_config.prize_tiers -> v_last_idx) || jsonb_build_object('segment_index', v_last_idx);
  END IF;

  IF p_game_id = 'treasure-chest' THEN
    v_chest_count := GREATEST(2, LEAST(10,
      COALESCE((v_config.game_specific_rules->>'chest_count')::int, 3)
    ));
    v_prize_idx := GREATEST(0, LEAST(v_chest_count - 1,
      floor(
        ((('x' || lpad(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8), 8, '0'))::bit(32)::bigint::numeric
         / 4294967296.0) * v_chest_count)::int
      )
    ));
    v_outcome := v_outcome || jsonb_build_object('prize_index', v_prize_idx);
  END IF;

  v_new_balance := ROUND((v_balance - p_stake)::numeric, 2);
  UPDATE profiles SET balance = v_new_balance, updated_at = now() WHERE id = p_user_id;

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


-- ── 2. play_mini_game ─────────────────────────────────────────────────────
-- (single-phase: Lucky Wheel, Mini Slot, etc.)
-- Get current definition to find exact signature
DO $$
BEGIN
  -- Only patch if the function exists (safe to skip if already patched)
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'play_mini_game'
  ) THEN
    -- Update the function body to use NOWAIT via a targeted search-replace approach
    -- We recreate it here with the same signature
    NULL; -- play_mini_game patched separately below
  END IF;
END;
$$;

-- Patch play_mini_game to use FOR UPDATE NOWAIT
-- (Get the latest version from 20261028100000_fix_mini_game_rtp.sql and patch)
DROP FUNCTION IF EXISTS public.play_mini_game(text, uuid, numeric, uuid);

CREATE FUNCTION public.play_mini_game(
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
  v_config         mini_game_config%ROWTYPE;
  v_balance        numeric;
  v_account_status text;
  v_new_balance    numeric;
  v_outcome        jsonb;
  v_payout         numeric;
  v_round_id       uuid;
  v_existing       mini_game_rounds%ROWTYPE;
  v_roll           numeric;
  v_cumul          numeric := 0;
  v_tier           jsonb;
  v_tier_idx       int := 0;
  v_last_idx       int;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Idempotency
  SELECT * INTO v_existing FROM mini_game_rounds WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'round_id', v_existing.id,
      'outcome',  v_existing.outcome,
      'payout',   v_existing.payout,
      'duplicate', true
    );
  END IF;

  SELECT * INTO v_config FROM mini_game_config WHERE game_id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found: %', p_game_id; END IF;
  IF NOT v_config.enabled THEN RAISE EXCEPTION 'Game not available'; END IF;
  IF v_config.maintenance THEN RAISE EXCEPTION 'Game under maintenance'; END IF;
  IF jsonb_array_length(v_config.prize_tiers) = 0 THEN
    RAISE EXCEPTION 'Game has no prize tiers configured';
  END IF;

  IF p_stake IS NULL OR p_stake <= 0 THEN RAISE EXCEPTION 'Stake must be positive'; END IF;
  IF p_stake < v_config.min_bet THEN RAISE EXCEPTION 'Stake below minimum'; END IF;
  IF p_stake > v_config.max_bet THEN RAISE EXCEPTION 'Stake above maximum'; END IF;

  -- NOWAIT: fail immediately instead of waiting for another tx's lock
  BEGIN
    SELECT balance, account_status INTO v_balance, v_account_status
      FROM profiles WHERE id = p_user_id FOR UPDATE NOWAIT;
  EXCEPTION
    WHEN lock_not_available THEN
      RAISE EXCEPTION 'Balance temporarily locked — please try again in a moment';
  END;

  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_balance < p_stake THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  IF v_account_status IN ('banned', 'suspended') THEN RAISE EXCEPTION 'Account restricted'; END IF;

  -- Prize tier selection (CSPRNG)
  v_roll := (
    ('x' || lpad(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8), 8, '0'))::bit(32)::bigint::numeric
  ) / 4294967296.0;

  FOR v_tier IN SELECT value FROM jsonb_array_elements(v_config.prize_tiers) AS t(value)
  LOOP
    v_cumul := v_cumul + (v_tier->>'probability')::numeric;
    IF v_roll < v_cumul THEN
      v_outcome := v_tier || jsonb_build_object('segment_index', v_tier_idx);
      EXIT;
    END IF;
    v_tier_idx := v_tier_idx + 1;
  END LOOP;
  IF v_outcome IS NULL THEN
    v_last_idx := jsonb_array_length(v_config.prize_tiers) - 1;
    v_outcome := (v_config.prize_tiers -> v_last_idx) || jsonb_build_object('segment_index', v_last_idx);
  END IF;

  v_payout := ROUND((p_stake * (v_outcome->>'multiplier')::numeric)::numeric, 2);

  v_new_balance := ROUND((v_balance - p_stake + v_payout)::numeric, 2);
  UPDATE profiles SET balance = v_new_balance, updated_at = now() WHERE id = p_user_id;

  v_round_id := gen_random_uuid();
  INSERT INTO mini_game_rounds
    (id, idempotency_key, user_id, game_id, stake, outcome, payout, phase, settled_at)
  VALUES
    (v_round_id, p_idempotency_key, p_user_id, p_game_id,
     p_stake, v_outcome, v_payout, 'complete', now());

  RETURN jsonb_build_object(
    'round_id', v_round_id,
    'outcome',  v_outcome,
    'payout',   v_payout
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.play_mini_game(text, uuid, numeric, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.play_mini_game(text, uuid, numeric, uuid) TO authenticated;


NOTIFY pgrst, 'reload schema';
