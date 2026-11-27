-- ============================================================
-- Fix: Drop ALL overloads of initiate_mini_game then recreate.
--
-- The 3-arg variant (p_game_id, p_id_empotency_key, p_user_id)
-- has no p_stake — a completely different signature that was
-- never cleaned up. We use CASCADE to drop it even if anything
-- depends on it, then recreate the single correct 4-arg version.
--
-- RUN IN: Supabase Dashboard → SQL Editor
-- ============================================================

-- Step 1: Drop every overload by brute-force, all type combos
DROP FUNCTION IF EXISTS public.initiate_mini_game(text, uuid, numeric, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.initiate_mini_game(text, uuid, uuid)          CASCADE;
DROP FUNCTION IF EXISTS public.initiate_mini_game(text, uuid, uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.initiate_mini_game(uuid, text, numeric, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.initiate_mini_game(uuid, text, uuid, numeric) CASCADE;

-- Step 2: Confirm nothing remains (this will return 0 rows if clean)
-- SELECT proname, pg_get_function_arguments(oid)
-- FROM pg_proc WHERE proname = 'initiate_mini_game';

-- Step 3: Recreate the one correct version
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
  -- 1. Auth check
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- 2. Idempotency
  SELECT * INTO v_existing FROM mini_game_rounds WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('round_id', v_existing.id, 'duplicate', true);
  END IF;

  -- 3. Config
  SELECT * INTO v_config FROM mini_game_config WHERE game_id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found: %', p_game_id; END IF;
  IF NOT v_config.enabled THEN RAISE EXCEPTION 'Game not available'; END IF;
  IF v_config.maintenance THEN RAISE EXCEPTION 'Game under maintenance'; END IF;
  IF jsonb_array_length(v_config.prize_tiers) = 0 THEN
    RAISE EXCEPTION 'Game has no prize tiers configured';
  END IF;

  -- 4. Stake validation
  IF p_stake IS NULL OR p_stake <= 0 THEN RAISE EXCEPTION 'Stake must be positive'; END IF;
  IF p_stake < v_config.min_bet THEN RAISE EXCEPTION 'Stake below minimum'; END IF;
  IF p_stake > v_config.max_bet THEN RAISE EXCEPTION 'Stake above maximum'; END IF;

  -- 5. Balance lock
  SELECT balance, account_status INTO v_balance, v_account_status
    FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_balance < p_stake THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  IF v_account_status IN ('banned', 'suspended') THEN RAISE EXCEPTION 'Account restricted'; END IF;

  -- 6. Prize tier selection (CSPRNG)
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

  -- 7. Treasure chest: assign winning chest position
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

  -- 8. Debit stake
  v_new_balance := ROUND((v_balance - p_stake)::numeric, 2);
  UPDATE profiles SET balance = v_new_balance, updated_at = now() WHERE id = p_user_id;

  -- 9. Insert pending round
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

-- Step 4: Force PostgREST cache reload
NOTIFY pgrst, 'reload schema';
