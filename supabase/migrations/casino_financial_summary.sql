-- ============================================================
-- Casino Financial Summary RPC
-- Returns all casino-level financial metrics in one call.
-- Reads from: transactions, spins, jackpot_wins, jackpots, profiles
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_casino_financial_summary(
  p_start timestamptz DEFAULT NULL,   -- NULL = all-time
  p_end   timestamptz DEFAULT NULL    -- NULL = now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_role              text;
  v_end               timestamptz;
  v_total_deposited   numeric;
  v_total_withdrawn   numeric;
  v_total_wagered     numeric;
  v_total_won         numeric;
  v_player_funds      numeric;
  v_pending_deposits  numeric;
  v_pending_withdrawals numeric;
  v_jackpot_pool      numeric;
  v_jackpot_paid      numeric;
  v_jackpot_wins_count bigint;
  v_jackpot_largest   numeric;
BEGIN
  -- ── Auth check ──────────────────────────────────────────────────────────
  v_role := public.get_my_admin_role();
  IF v_role NOT IN ('super_admin','finance_admin','support_agent','game_manager') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_end := COALESCE(p_end, now());

  -- ── Money deposited (successful deposits in period) ─────────────────────
  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_deposited
    FROM transactions
   WHERE type    IN ('deposit','admin_credit')
     AND status  = 'success'
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- ── Money withdrawn (successful withdrawals in period) ──────────────────
  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_withdrawn
    FROM transactions
   WHERE type   IN ('withdrawal','admin_debit')
     AND status = 'success'
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- ── Total wagered (from spins table) ────────────────────────────────────
  SELECT COALESCE(SUM(bet), 0)
    INTO v_total_wagered
    FROM spins
   WHERE (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- ── Total won by players (from spins table) ─────────────────────────────
  SELECT COALESCE(SUM(payout), 0)
    INTO v_total_won
    FROM spins
   WHERE (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- ── Current player funds = sum of all active player balances ────────────
  -- Derived from live profiles.balance — not the transaction ledger delta
  -- so it accounts for admin credits/debits and bonuses correctly.
  SELECT COALESCE(SUM(balance), 0)
    INTO v_player_funds
    FROM profiles
   WHERE account_status = 'active'
     AND admin_role IS NULL;  -- exclude admin accounts

  -- ── Pending deposits ────────────────────────────────────────────────────
  SELECT COALESCE(SUM(amount), 0)
    INTO v_pending_deposits
    FROM transactions
   WHERE type   = 'deposit'
     AND status = 'pending';

  -- ── Pending withdrawals ─────────────────────────────────────────────────
  SELECT COALESCE(SUM(amount), 0)
    INTO v_pending_withdrawals
    FROM transactions
   WHERE type   = 'withdrawal'
     AND status IN ('pending','approved');

  -- ── Jackpot pool (current live amounts) ─────────────────────────────────
  SELECT COALESCE(SUM(current_amount), 0)
    INTO v_jackpot_pool
    FROM jackpots;

  -- ── Jackpot payouts ──────────────────────────────────────────────────────
  SELECT COALESCE(SUM(amount), 0),
         COUNT(*),
         COALESCE(MAX(amount), 0)
    INTO v_jackpot_paid, v_jackpot_wins_count, v_jackpot_largest
    FROM jackpot_wins
   WHERE (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  RETURN jsonb_build_object(
    -- Core money flows
    'total_deposited',      v_total_deposited,
    'total_withdrawn',      v_total_withdrawn,
    'net_cash_flow',        v_total_deposited - v_total_withdrawn,
    -- Wagering
    'total_wagered',        v_total_wagered,
    'total_won',            v_total_won,
    'ggr',                  v_total_wagered - v_total_won,
    -- Live positions
    'player_funds',         v_player_funds,
    'pending_deposits',     v_pending_deposits,
    'pending_withdrawals',  v_pending_withdrawals,
    -- Jackpots
    'jackpot_pool',         v_jackpot_pool,
    'jackpot_paid',         v_jackpot_paid,
    'jackpot_wins_count',   v_jackpot_wins_count,
    'jackpot_largest',      v_jackpot_largest
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_casino_financial_summary(timestamptz, timestamptz)
  TO authenticated;

-- ============================================================
-- Per-game GGR breakdown
-- ============================================================
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
    s.game_id,
    COALESCE(SUM(s.bet),    0)::numeric AS total_bets,
    COALESCE(SUM(s.payout), 0)::numeric AS total_payouts,
    COALESCE(SUM(s.bet) - SUM(s.payout), 0)::numeric AS ggr,
    COUNT(*)                            AS spin_count,
    CASE WHEN COUNT(*) > 0
         THEN ROUND(SUM(s.bet) / COUNT(*), 2)
         ELSE 0 END::numeric            AS avg_bet
  FROM spins s
  WHERE (p_start IS NULL OR s.created_at >= p_start)
    AND s.created_at <= COALESCE(p_end, now())
  GROUP BY s.game_id
  ORDER BY ggr DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_game_financial_summary(timestamptz, timestamptz)
  TO authenticated;

-- ============================================================
-- Money-flow time series (for chart) — daily buckets
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_money_flow_series(
  p_start timestamptz,
  p_end   timestamptz
)
RETURNS TABLE (
  bucket       date,
  deposits     numeric,
  withdrawals  numeric,
  wagered      numeric,
  won          numeric,
  ggr          numeric
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
    SELECT DATE(created_at) AS d, COALESCE(SUM(amount), 0) AS v
      FROM transactions
     WHERE type IN ('deposit','admin_credit') AND status = 'success'
       AND created_at BETWEEN p_start AND p_end
     GROUP BY 1
  ),
  wdr AS (
    SELECT DATE(created_at) AS d, COALESCE(SUM(amount), 0) AS v
      FROM transactions
     WHERE type IN ('withdrawal','admin_debit') AND status = 'success'
       AND created_at BETWEEN p_start AND p_end
     GROUP BY 1
  ),
  bets_payouts AS (
    SELECT DATE(created_at) AS d,
           COALESCE(SUM(bet),    0) AS total_bet,
           COALESCE(SUM(payout), 0) AS total_payout
      FROM spins
     WHERE created_at BETWEEN p_start AND p_end
     GROUP BY 1
  )
  SELECT
    days.bucket,
    COALESCE(dep.v,               0)::numeric AS deposits,
    COALESCE(wdr.v,               0)::numeric AS withdrawals,
    COALESCE(bp.total_bet,        0)::numeric AS wagered,
    COALESCE(bp.total_payout,     0)::numeric AS won,
    COALESCE(bp.total_bet - bp.total_payout, 0)::numeric AS ggr
  FROM days
  LEFT JOIN dep ON dep.d = days.bucket
  LEFT JOIN wdr ON wdr.d = days.bucket
  LEFT JOIN bets_payouts bp ON bp.d = days.bucket
  ORDER BY days.bucket;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_money_flow_series(timestamptz, timestamptz)
  TO authenticated;

-- RLS: admins can read jackpot_wins
ALTER TABLE public.jackpot_wins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read jackpot wins" ON public.jackpot_wins;
CREATE POLICY "Admins read jackpot wins"
  ON public.jackpot_wins FOR SELECT
  USING (public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent','game_manager'));

NOTIFY pgrst, 'reload schema';
