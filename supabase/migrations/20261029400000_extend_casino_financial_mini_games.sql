-- ============================================================
-- Extend Casino Financial Summary & Game Financial Summary
-- to include Mini Jackpot Game rounds.
--
-- get_casino_financial_summary: adds mini_game_rounds stake/payout
--   to total_wagered / total_won (and thus ggr).
-- get_game_financial_summary: adds mini game per-game rows.
-- get_money_flow_series: adds mini game wagered/won to daily buckets.
-- ============================================================


-- ── 1. get_casino_financial_summary ────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_casino_financial_summary(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.get_casino_financial_summary(
  p_start timestamptz DEFAULT NULL,
  p_end   timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_role                text;
  v_end                 timestamptz;
  v_total_deposited     numeric;
  v_total_withdrawn     numeric;
  v_total_wagered       numeric;
  v_total_won           numeric;
  v_player_funds        numeric;
  v_pending_deposits    numeric;
  v_pending_withdrawals numeric;
  v_jackpot_pool        numeric;
  v_jackpot_paid        numeric;
  v_jackpot_wins_count  bigint;
  v_jackpot_largest     numeric;
BEGIN
  v_role := public.get_my_admin_role();
  IF v_role NOT IN ('super_admin','finance_admin','support_agent','game_manager') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_end := COALESCE(p_end, now());

  SELECT COALESCE(SUM(amount), 0) INTO v_total_deposited FROM transactions
   WHERE type IN ('deposit','admin_credit') AND status = 'success'
     AND (p_start IS NULL OR created_at >= p_start) AND created_at <= v_end;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_withdrawn FROM transactions
   WHERE type IN ('withdrawal','admin_debit') AND status = 'success'
     AND (p_start IS NULL OR created_at >= p_start) AND created_at <= v_end;

  -- Total wagered = spins + settled mini game rounds
  SELECT COALESCE(SUM(src.bet), 0) INTO v_total_wagered
  FROM (
    SELECT bet::numeric AS bet FROM spins
     WHERE (p_start IS NULL OR created_at >= p_start) AND created_at <= v_end
    UNION ALL
    SELECT stake::numeric AS bet FROM mini_game_rounds
     WHERE phase = 'complete'
       AND (p_start IS NULL OR created_at >= p_start) AND created_at <= v_end
  ) src;

  -- Total won = spins + settled mini game rounds
  SELECT COALESCE(SUM(src.payout), 0) INTO v_total_won
  FROM (
    SELECT payout::numeric FROM spins
     WHERE (p_start IS NULL OR created_at >= p_start) AND created_at <= v_end
    UNION ALL
    SELECT payout::numeric FROM mini_game_rounds
     WHERE phase = 'complete'
       AND (p_start IS NULL OR created_at >= p_start) AND created_at <= v_end
  ) src;

  SELECT COALESCE(SUM(balance), 0) INTO v_player_funds FROM profiles
   WHERE account_status = 'active' AND admin_role IS NULL;

  SELECT COALESCE(SUM(amount), 0) INTO v_pending_deposits FROM transactions
   WHERE type = 'deposit' AND status = 'pending';

  SELECT COALESCE(SUM(amount), 0) INTO v_pending_withdrawals FROM transactions
   WHERE type = 'withdrawal' AND status IN ('pending','approved');

  SELECT COALESCE(SUM(current_amount), 0) INTO v_jackpot_pool FROM jackpots;

  SELECT COALESCE(SUM(amount), 0), COUNT(*), COALESCE(MAX(amount), 0)
    INTO v_jackpot_paid, v_jackpot_wins_count, v_jackpot_largest
    FROM jackpot_wins
   WHERE (p_start IS NULL OR created_at >= p_start) AND created_at <= v_end;

  RETURN jsonb_build_object(
    'total_deposited',     v_total_deposited,
    'total_withdrawn',     v_total_withdrawn,
    'net_cash_flow',       v_total_deposited - v_total_withdrawn,
    'total_wagered',       v_total_wagered,
    'total_won',           v_total_won,
    'ggr',                 v_total_wagered - v_total_won,
    'player_funds',        v_player_funds,
    'pending_deposits',    v_pending_deposits,
    'pending_withdrawals', v_pending_withdrawals,
    'jackpot_pool',        v_jackpot_pool,
    'jackpot_paid',        v_jackpot_paid,
    'jackpot_wins_count',  v_jackpot_wins_count,
    'jackpot_largest',     v_jackpot_largest
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_casino_financial_summary(timestamptz, timestamptz) TO authenticated;


-- ── 2. get_game_financial_summary ──────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_game_financial_summary(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.get_game_financial_summary(
  p_start timestamptz DEFAULT NULL,
  p_end   timestamptz DEFAULT NULL
)
RETURNS TABLE (
  game_id       text,
  total_bets    numeric,
  total_payouts numeric,
  ggr           numeric,
  spin_count    bigint,
  avg_bet       numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  v_role := public.get_my_admin_role();
  IF v_role NOT IN ('super_admin','finance_admin','support_agent','game_manager') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    src.game_id::text,
    COALESCE(SUM(src.bet),    0)::numeric,
    COALESCE(SUM(src.payout), 0)::numeric,
    COALESCE(SUM(src.bet) - SUM(src.payout), 0)::numeric,
    COUNT(*)::bigint,
    CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(src.bet) / COUNT(*), 2) ELSE 0 END::numeric
  FROM (
    SELECT game_id, bet::numeric AS bet, payout::numeric AS payout, created_at
    FROM spins
    WHERE (p_start IS NULL OR created_at >= p_start)
      AND created_at <= COALESCE(p_end, now())

    UNION ALL

    SELECT game_id, stake::numeric AS bet, payout::numeric AS payout, created_at
    FROM mini_game_rounds
    WHERE phase = 'complete'
      AND (p_start IS NULL OR created_at >= p_start)
      AND created_at <= COALESCE(p_end, now())
  ) src
  GROUP BY src.game_id
  ORDER BY (SUM(src.bet) - SUM(src.payout)) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_game_financial_summary(timestamptz, timestamptz) TO authenticated;


-- ── 3. get_money_flow_series ───────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_money_flow_series(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.get_money_flow_series(
  p_start timestamptz,
  p_end   timestamptz
)
RETURNS TABLE (
  bucket      date,
  deposits    numeric,
  withdrawals numeric,
  wagered     numeric,
  won         numeric,
  ggr         numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  v_role := public.get_my_admin_role();
  IF v_role NOT IN ('super_admin','finance_admin','support_agent','game_manager') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(p_start::date, p_end::date, '1 day'::interval)::date AS bucket
  ),
  dep AS (
    SELECT DATE(created_at) AS d, COALESCE(SUM(amount), 0) AS v FROM transactions
     WHERE type IN ('deposit','admin_credit') AND status = 'success'
       AND created_at BETWEEN p_start AND p_end GROUP BY 1
  ),
  wdr AS (
    SELECT DATE(created_at) AS d, COALESCE(SUM(amount), 0) AS v FROM transactions
     WHERE type IN ('withdrawal','admin_debit') AND status = 'success'
       AND created_at BETWEEN p_start AND p_end GROUP BY 1
  ),
  bets_payouts AS (
    -- Spins + mini game rounds combined
    SELECT DATE(created_at) AS d,
           COALESCE(SUM(bet),    0) AS total_bet,
           COALESCE(SUM(payout), 0) AS total_payout
    FROM (
      SELECT bet::numeric AS bet, payout::numeric AS payout, created_at FROM spins
       WHERE created_at BETWEEN p_start AND p_end
      UNION ALL
      SELECT stake::numeric AS bet, payout::numeric AS payout, created_at FROM mini_game_rounds
       WHERE phase = 'complete' AND created_at BETWEEN p_start AND p_end
    ) src
    GROUP BY 1
  )
  SELECT
    days.bucket,
    COALESCE(dep.v,            0)::numeric,
    COALESCE(wdr.v,            0)::numeric,
    COALESCE(bp.total_bet,     0)::numeric,
    COALESCE(bp.total_payout,  0)::numeric,
    COALESCE(bp.total_bet - bp.total_payout, 0)::numeric
  FROM days
  LEFT JOIN dep ON dep.d = days.bucket
  LEFT JOIN wdr ON wdr.d = days.bucket
  LEFT JOIN bets_payouts bp ON bp.d = days.bucket
  ORDER BY days.bucket;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_money_flow_series(timestamptz, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
