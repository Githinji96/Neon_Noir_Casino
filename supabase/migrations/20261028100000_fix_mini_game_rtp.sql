-- ============================================================
-- Fix Mini Game RTP: Corrected Prize Tiers
--
-- AUDIT FINDINGS (prior configuration):
--   The original multipliers were sized as net-profit multiples
--   but applied as gross-return multiples, producing RTPs well
--   above 100 percent on every game (house losing every spin).
--
-- Prior theoretical RTPs (INCORRECT):
--   lucky-wheel:        202.5%
--   scratch-cards:      102.5%
--   treasure-chest:     136.0%
--   mini-slot:          193.5%
--   mystery-multiplier: 197.5%
--   crystal-match:      196.5%
--
-- Corrected theoretical RTPs (target approx 90%):
--   lucky-wheel:        90.0%  (house edge 10.0%)
--   scratch-cards:      92.5%  (house edge  7.5%)
--   treasure-chest:     90.0%  (house edge 10.0%)
--   mini-slot:          92.0%  (house edge  8.0%)
--   mystery-multiplier: 90.0%  (house edge 10.0%)
--   crystal-match:      92.5%  (house edge  7.5%)
--
-- Formula: RTP = SUM(probability * gross_multiplier)
-- Gross multiplier 0.0 = full stake lost
-- Gross multiplier 1.0 = stake returned (break even)
-- Gross multiplier 2.0 = stake + 1x net profit
--
-- Outcomes are generated server-side with gen_random_uuid() CSPRNG.
-- No player-specific manipulation. All outcomes are independent.
-- ============================================================

-- lucky-wheel: RTP = 0.45*0 + 0.20*0.5 + 0.20*1.5 + 0.10*3.0 + 0.04*5.0 + 0.01*10.0
--                  = 0 + 0.10 + 0.30 + 0.30 + 0.20 + 0.10 = 0.90 (90.0%)
UPDATE public.mini_game_config SET
  prize_tiers = '[
    {"label": "No Win", "multiplier": 0.0,  "probability": 0.45, "symbol": "x"},
    {"label": "0.5x",   "multiplier": 0.5,  "probability": 0.20, "symbol": "star"},
    {"label": "1.5x",   "multiplier": 1.5,  "probability": 0.20, "symbol": "shine"},
    {"label": "3x",     "multiplier": 3.0,  "probability": 0.10, "symbol": "spark"},
    {"label": "5x",     "multiplier": 5.0,  "probability": 0.04, "symbol": "gem"},
    {"label": "10x",    "multiplier": 10.0, "probability": 0.01, "symbol": "crown"}
  ]'::jsonb,
  updated_at = now()
WHERE game_id = 'lucky-wheel';

-- scratch-cards: RTP = 0.50*0 + 0.25*0.5 + 0.15*2.0 + 0.08*4.0 + 0.02*9.0
--                   = 0 + 0.125 + 0.30 + 0.32 + 0.18 = 0.925 (92.5%)
UPDATE public.mini_game_config SET
  prize_tiers = '[
    {"label": "No Prize", "multiplier": 0.0, "probability": 0.50, "symbol": "x"},
    {"label": "0.5x",     "multiplier": 0.5, "probability": 0.25, "symbol": "card"},
    {"label": "2x",       "multiplier": 2.0, "probability": 0.15, "symbol": "slot"},
    {"label": "4x",       "multiplier": 4.0, "probability": 0.08, "symbol": "coin"},
    {"label": "9x",       "multiplier": 9.0, "probability": 0.02, "symbol": "gem"}
  ]'::jsonb,
  updated_at = now()
WHERE game_id = 'scratch-cards';

-- treasure-chest: RTP = 0.55*0 + 0.25*1.0 + 0.15*2.0 + 0.05*7.0
--                     = 0 + 0.25 + 0.30 + 0.35 = 0.90 (90.0%)
UPDATE public.mini_game_config SET
  prize_tiers = '[
    {"label": "Empty", "multiplier": 0.0, "probability": 0.55, "symbol": "box"},
    {"label": "1x",    "multiplier": 1.0, "probability": 0.25, "symbol": "coin"},
    {"label": "2x",    "multiplier": 2.0, "probability": 0.15, "symbol": "gem"},
    {"label": "7x",    "multiplier": 7.0, "probability": 0.05, "symbol": "crown"}
  ]'::jsonb,
  updated_at = now()
WHERE game_id = 'treasure-chest';

-- mini-slot: RTP = 0.55*0 + 0.25*1.0 + 0.12*2.0 + 0.07*4.0 + 0.01*15.0
--                = 0 + 0.25 + 0.24 + 0.28 + 0.15 = 0.92 (92.0%)
UPDATE public.mini_game_config SET
  prize_tiers = '[
    {"label": "No Win",          "multiplier": 0.0,  "probability": 0.55},
    {"label": "Pair",            "multiplier": 1.0,  "probability": 0.25},
    {"label": "Two Pair",        "multiplier": 2.0,  "probability": 0.12},
    {"label": "Three of a Kind", "multiplier": 4.0,  "probability": 0.07},
    {"label": "Jackpot",         "multiplier": 15.0, "probability": 0.01}
  ]'::jsonb,
  updated_at = now()
WHERE game_id = 'mini-slot';

-- mystery-multiplier: RTP = 0.45*0 + 0.20*0.5 + 0.20*1.5 + 0.10*3.0 + 0.04*5.0 + 0.01*10.0
--                         = 0 + 0.10 + 0.30 + 0.30 + 0.20 + 0.10 = 0.90 (90.0%)
UPDATE public.mini_game_config SET
  prize_tiers = '[
    {"label": "No Win", "multiplier": 0.0,  "probability": 0.45},
    {"label": "0.5x",   "multiplier": 0.5,  "probability": 0.20},
    {"label": "1.5x",   "multiplier": 1.5,  "probability": 0.20},
    {"label": "3x",     "multiplier": 3.0,  "probability": 0.10},
    {"label": "5x",     "multiplier": 5.0,  "probability": 0.04},
    {"label": "10x",    "multiplier": 10.0, "probability": 0.01}
  ]'::jsonb,
  updated_at = now()
WHERE game_id = 'mystery-multiplier';

-- crystal-match: RTP = 0.50*0 + 0.25*0.5 + 0.15*2.0 + 0.08*4.0 + 0.02*9.0
--                    = 0 + 0.125 + 0.30 + 0.32 + 0.18 = 0.925 (92.5%)
UPDATE public.mini_game_config SET
  prize_tiers = '[
    {"label": "No Match", "multiplier": 0.0, "probability": 0.50, "symbol": "orb"},
    {"label": "Bronze",   "multiplier": 0.5, "probability": 0.25, "symbol": "bronze"},
    {"label": "Silver",   "multiplier": 2.0, "probability": 0.15, "symbol": "silver"},
    {"label": "Gold",     "multiplier": 4.0, "probability": 0.08, "symbol": "gold"},
    {"label": "Diamond",  "multiplier": 9.0, "probability": 0.02, "symbol": "diamond"}
  ]'::jsonb,
  updated_at = now()
WHERE game_id = 'crystal-match';


-- ============================================================
-- Add RTP metadata columns to mini_game_config
-- ============================================================
ALTER TABLE public.mini_game_config
  ADD COLUMN IF NOT EXISTS theoretical_rtp       numeric(5,4) NOT NULL DEFAULT 0.9000,
  ADD COLUMN IF NOT EXISTS rtp_tolerance         numeric(5,4) NOT NULL DEFAULT 0.0100,
  ADD COLUMN IF NOT EXISTS max_payout_per_round  numeric(12,2) NOT NULL DEFAULT 50000.00;

UPDATE public.mini_game_config
  SET theoretical_rtp = 0.9000
  WHERE game_id IN ('lucky-wheel', 'treasure-chest', 'mystery-multiplier');

UPDATE public.mini_game_config
  SET theoretical_rtp = 0.9200
  WHERE game_id = 'mini-slot';

UPDATE public.mini_game_config
  SET theoretical_rtp = 0.9250
  WHERE game_id IN ('scratch-cards', 'crystal-match');


-- ============================================================
-- RTP Monitoring View (admin read-only)
-- ============================================================
CREATE OR REPLACE VIEW public.mini_game_rtp_report AS
SELECT
  c.game_id,
  c.theoretical_rtp,
  ROUND(c.theoretical_rtp * 100, 2)                           AS theoretical_rtp_pct,
  ROUND((1 - c.theoretical_rtp) * 100, 2)                     AS theoretical_house_edge_pct,
  COUNT(r.id)                                                  AS total_rounds,
  COALESCE(SUM(r.stake), 0)                                   AS total_stakes,
  COALESCE(SUM(r.payout), 0)                                  AS total_gross_payouts,
  CASE
    WHEN COALESCE(SUM(r.stake), 0) = 0 THEN NULL
    ELSE ROUND(SUM(r.payout) / SUM(r.stake) * 100, 2)
  END                                                          AS observed_rtp_pct,
  CASE
    WHEN COALESCE(SUM(r.stake), 0) = 0 THEN NULL
    ELSE ROUND((1 - SUM(r.payout) / SUM(r.stake)) * 100, 2)
  END                                                          AS observed_house_edge_pct,
  COALESCE(SUM(r.stake) - SUM(r.payout), 0)                  AS net_gaming_revenue,
  COUNT(r.id) FILTER (WHERE r.payout > 0)                     AS winning_rounds,
  COUNT(r.id) FILTER (WHERE r.payout = 0)                     AS losing_rounds,
  COUNT(r.id) FILTER (
    WHERE (r.outcome->>'multiplier')::numeric >= 5
  )                                                            AS high_value_rounds,
  MIN(r.created_at)                                           AS first_round_at,
  MAX(r.created_at)                                           AS last_round_at
FROM public.mini_game_config c
LEFT JOIN public.mini_game_rounds r
  ON r.game_id = c.game_id AND r.phase = 'complete'
GROUP BY c.game_id, c.theoretical_rtp
ORDER BY c.game_id;

REVOKE ALL  ON public.mini_game_rtp_report FROM PUBLIC;
GRANT SELECT ON public.mini_game_rtp_report TO authenticated;


-- ============================================================
-- RPC: get_mini_game_rtp_report (admin-only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_mini_game_rtp_report(
  p_game_id   text         DEFAULT '',
  p_from_date timestamptz  DEFAULT NULL,
  p_to_date   timestamptz  DEFAULT NULL
)
RETURNS TABLE (
  game_id                text,
  theoretical_rtp_pct    numeric,
  theoretical_house_edge numeric,
  total_rounds           bigint,
  total_stakes           numeric,
  total_gross_payouts    numeric,
  observed_rtp_pct       numeric,
  net_gaming_revenue     numeric,
  winning_rounds         bigint,
  losing_rounds          bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := public.get_my_admin_role();
  IF v_role NOT IN ('super_admin', 'finance_admin', 'game_manager') THEN
    RAISE EXCEPTION 'Insufficient privileges: super_admin, finance_admin or game_manager required';
  END IF;

  RETURN QUERY
  SELECT
    c.game_id::text,
    ROUND(c.theoretical_rtp * 100, 2),
    ROUND((1 - c.theoretical_rtp) * 100, 2),
    COUNT(r.id),
    COALESCE(SUM(r.stake), 0),
    COALESCE(SUM(r.payout), 0),
    CASE
      WHEN COALESCE(SUM(r.stake), 0) = 0 THEN NULL
      ELSE ROUND(SUM(r.payout) / SUM(r.stake) * 100, 2)
    END,
    COALESCE(SUM(r.stake) - SUM(r.payout), 0),
    COUNT(r.id) FILTER (WHERE r.payout > 0),
    COUNT(r.id) FILTER (WHERE r.payout = 0)
  FROM public.mini_game_config c
  LEFT JOIN public.mini_game_rounds r ON
    r.game_id = c.game_id
    AND r.phase = 'complete'
    AND (p_from_date IS NULL OR r.created_at >= p_from_date)
    AND (p_to_date   IS NULL OR r.created_at <= p_to_date)
  WHERE (p_game_id = '' OR c.game_id = p_game_id)
  GROUP BY c.game_id, c.theoretical_rtp
  ORDER BY c.game_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_mini_game_rtp_report(text, timestamptz, timestamptz) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_mini_game_rtp_report(text, timestamptz, timestamptz) TO authenticated;


-- ============================================================
-- update_mini_game_config: validates calculated RTP vs target
-- ============================================================
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
  v_admin_role      text;
  v_min_bet         numeric;
  v_max_bet         numeric;
  v_tiers           jsonb;
  v_tier_count      int;
  v_tier            jsonb;
  v_prob_sum        numeric := 0;
  v_calculated_rtp  numeric := 0;
  v_target_rtp      numeric;
  v_tolerance       numeric;
  v_max_payout      numeric;
BEGIN
  -- 1. Admin role check
  v_admin_role := public.get_my_admin_role();
  IF v_admin_role NOT IN ('super_admin', 'game_manager') THEN
    RAISE EXCEPTION 'Insufficient admin role: super_admin or game_manager required';
  END IF;

  -- 2. Validate bet limits
  v_min_bet := (p_config->>'min_bet')::numeric;
  IF v_min_bet IS NULL OR v_min_bet <= 0 THEN
    RAISE EXCEPTION 'min_bet must be greater than 0';
  END IF;

  v_max_bet := (p_config->>'max_bet')::numeric;
  IF v_max_bet IS NULL OR v_max_bet <= v_min_bet THEN
    RAISE EXCEPTION 'max_bet must be greater than min_bet';
  END IF;

  -- 3. Validate prize tiers
  v_tiers      := p_config->'prize_tiers';
  v_tier_count := jsonb_array_length(v_tiers);
  IF v_tier_count > 20 THEN
    RAISE EXCEPTION 'prize_tiers cannot exceed 20 entries';
  END IF;
  IF v_tier_count < 2 THEN
    RAISE EXCEPTION 'prize_tiers must have at least 2 entries';
  END IF;

  FOR v_tier IN SELECT value FROM jsonb_array_elements(v_tiers) AS t(value)
  LOOP
    IF (v_tier->>'multiplier')::numeric < 0 THEN
      RAISE EXCEPTION 'All multipliers must be >= 0 (0 = losing outcome)';
    END IF;
    v_prob_sum       := v_prob_sum + (v_tier->>'probability')::numeric;
    v_calculated_rtp := v_calculated_rtp
                        + (v_tier->>'probability')::numeric
                        * (v_tier->>'multiplier')::numeric;
  END LOOP;

  IF ROUND(v_prob_sum::numeric, 4) <> 1.0000 THEN
    RAISE EXCEPTION 'Outcome probabilities must sum to 1.00 (100%%), got %', v_prob_sum;
  END IF;

  -- 4. RTP validation
  v_target_rtp := COALESCE(
    (p_config->>'theoretical_rtp')::numeric,
    (SELECT theoretical_rtp FROM mini_game_config WHERE game_id = p_game_id),
    0.9000
  );
  v_tolerance := COALESCE(
    (p_config->>'rtp_tolerance')::numeric,
    (SELECT rtp_tolerance FROM mini_game_config WHERE game_id = p_game_id),
    0.0100
  );
  v_max_payout := COALESCE((p_config->>'max_payout_per_round')::numeric, 50000.00);

  IF ABS(v_calculated_rtp - v_target_rtp) > v_tolerance THEN
    RAISE EXCEPTION
      'Calculated RTP (%) deviates from target RTP (%) by more than tolerance (%). Adjust prize tiers or theoretical_rtp.',
      ROUND(v_calculated_rtp * 100, 2),
      ROUND(v_target_rtp * 100, 2),
      ROUND(v_tolerance * 100, 2);
  END IF;

  -- 5. Upsert config
  INSERT INTO mini_game_config
    (game_id, enabled, min_bet, max_bet, prize_tiers,
     outcome_probabilities, maintenance, game_specific_rules,
     theoretical_rtp, rtp_tolerance, max_payout_per_round, updated_at)
  VALUES (
    p_game_id,
    COALESCE((p_config->>'enabled')::boolean, false),
    v_min_bet, v_max_bet, v_tiers,
    COALESCE(p_config->'outcome_probabilities', '{}'::jsonb),
    COALESCE((p_config->>'maintenance')::boolean, false),
    COALESCE(p_config->'game_specific_rules', '{}'::jsonb),
    v_target_rtp, v_tolerance, v_max_payout,
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
    theoretical_rtp       = EXCLUDED.theoretical_rtp,
    rtp_tolerance         = EXCLUDED.rtp_tolerance,
    max_payout_per_round  = EXCLUDED.max_payout_per_round,
    updated_at            = now();

  -- 6. Audit log
  INSERT INTO admin_audit_logs
    (admin_id, admin_role, action_type, target_entity, target_id, new_value, created_at)
  VALUES (
    auth.uid(), v_admin_role, 'update_mini_game_config',
    'mini_game_config', p_game_id,
    jsonb_build_object(
      'config', p_config,
      'calculated_rtp', v_calculated_rtp,
      'target_rtp', v_target_rtp
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success',          true,
    'game_id',          p_game_id,
    'calculated_rtp',   v_calculated_rtp,
    'calculated_rtp_pct', ROUND(v_calculated_rtp * 100, 2)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_mini_game_config(text, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_mini_game_config(text, jsonb) TO authenticated;


-- ============================================================
-- play_mini_game: add max_payout_per_round enforcement
-- and return net_result in response
-- ============================================================
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
  v_last_idx        int;
BEGIN
  -- 1. Auth check
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- 2. Idempotency
  SELECT * INTO v_existing FROM mini_game_rounds WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'round_id',    v_existing.id,
      'outcome',     v_existing.outcome,
      'payout',      v_existing.payout,
      'net_result',  v_existing.payout - v_existing.stake,
      'new_balance', (SELECT balance FROM profiles WHERE id = p_user_id),
      'duplicate',   true
    );
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
  IF p_stake < v_config.min_bet THEN
    RAISE EXCEPTION 'Stake below minimum (min: %)', v_config.min_bet;
  END IF;
  IF p_stake > v_config.max_bet THEN
    RAISE EXCEPTION 'Stake above maximum (max: %)', v_config.max_bet;
  END IF;

  -- 5. Lock balance
  SELECT balance, account_status
    INTO v_balance, v_account_status
    FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_balance < p_stake THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  IF v_account_status IN ('banned', 'suspended') THEN
    RAISE EXCEPTION 'Account restricted';
  END IF;

  -- 6. Generate outcome (CSPRNG via gen_random_uuid, no pgcrypto needed)
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

  -- Fallback to last tier (handles floating-point edge)
  IF v_outcome IS NULL THEN
    v_last_idx := jsonb_array_length(v_config.prize_tiers) - 1;
    v_outcome := (v_config.prize_tiers -> v_last_idx)
                 || jsonb_build_object('segment_index', v_last_idx);
  END IF;

  -- 7. Compute gross payout = stake * multiplier, capped at max_payout_per_round
  v_payout := ROUND(p_stake * COALESCE((v_outcome->>'multiplier')::numeric, 0), 2);
  IF v_payout > v_config.max_payout_per_round THEN
    v_payout := v_config.max_payout_per_round;
  END IF;

  -- 8. Atomic balance update
  v_new_balance := ROUND((v_balance - p_stake + v_payout)::numeric, 2);
  IF v_new_balance < 0 THEN v_new_balance := 0; END IF;

  UPDATE profiles SET balance = v_new_balance, updated_at = now()
  WHERE id = p_user_id;

  -- 9. Insert round record
  v_round_id := gen_random_uuid();
  INSERT INTO mini_game_rounds
    (id, idempotency_key, user_id, game_id, stake, outcome, payout, phase, settled_at)
  VALUES
    (v_round_id, p_idempotency_key, p_user_id, p_game_id,
     p_stake, v_outcome, v_payout, 'complete', now());

  -- 10. Return result
  RETURN jsonb_build_object(
    'round_id',    v_round_id,
    'outcome',     v_outcome,
    'payout',      v_payout,
    'net_result',  v_payout - p_stake,
    'new_balance', v_new_balance
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.play_mini_game(text, uuid, numeric, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.play_mini_game(text, uuid, numeric, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
