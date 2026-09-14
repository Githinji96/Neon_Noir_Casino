-- ============================================================
-- Fix admin_credit / admin_debit accounting
--
-- BEFORE (wrong):
--   admin_credit counted as a deposit → inflated Net Cash Flow & Total Deposited
--   admin_debit  counted as a withdrawal → deflated Net Cash Flow & Total Withdrawn
--
-- AFTER (correct):
--   admin_credit = casino PAYS a player → outflow, same bucket as withdrawals
--   admin_debit  = casino TAKES from a player → inflow, same bucket as deposits
--
-- This is re-run safe (CREATE OR REPLACE).
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

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
  v_total_admin_credit  numeric;
  v_total_admin_debit   numeric;
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

  -- ── Real player deposits only (M-Pesa inflows) ──────────────────────────
  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_deposited
    FROM transactions
   WHERE type   = 'deposit'          -- NOT admin_credit
     AND status = 'success'
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- ── Real player withdrawals only (M-Pesa outflows) ──────────────────────
  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_withdrawn
    FROM transactions
   WHERE type   = 'withdrawal'       -- NOT admin_debit
     AND status IN ('success', 'approved', 'completed')
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- ── Admin credits = casino paid player (outflow from house) ─────────────
  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_admin_credit
    FROM transactions
   WHERE type   = 'admin_credit'
     AND status = 'success'
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- ── Admin debits = casino reclaimed from player (inflow to house) ────────
  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_admin_debit
    FROM transactions
   WHERE type   = 'admin_debit'
     AND status = 'success'
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- ── Total wagered ────────────────────────────────────────────────────────
  SELECT COALESCE(SUM(bet), 0)
    INTO v_total_wagered
    FROM spins
   WHERE (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- ── Total won by players ─────────────────────────────────────────────────
  SELECT COALESCE(SUM(payout), 0)
    INTO v_total_won
    FROM spins
   WHERE (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- ── Live player funds ────────────────────────────────────────────────────
  SELECT COALESCE(SUM(balance), 0)
    INTO v_player_funds
    FROM profiles
   WHERE account_status = 'active'
     AND admin_role IS NULL;

  -- ── Pending deposits ─────────────────────────────────────────────────────
  SELECT COALESCE(SUM(amount), 0)
    INTO v_pending_deposits
    FROM transactions
   WHERE type   = 'deposit'
     AND status = 'pending';

  -- ── Pending withdrawals ──────────────────────────────────────────────────
  SELECT COALESCE(SUM(amount), 0)
    INTO v_pending_withdrawals
    FROM transactions
   WHERE type   = 'withdrawal'
     AND status IN ('pending','approved');

  -- ── Jackpot pool ─────────────────────────────────────────────────────────
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
    -- Real M-Pesa flows
    'total_deposited',      v_total_deposited,
    'total_withdrawn',      v_total_withdrawn,
    -- Net cash flow: deposits - withdrawals - admin_credits + admin_debits
    -- admin_credit reduces house cash; admin_debit restores it
    'net_cash_flow',        (v_total_deposited + v_total_admin_debit)
                          - (v_total_withdrawn + v_total_admin_credit),
    -- Admin adjustments broken out for transparency
    'admin_credits_paid',   v_total_admin_credit,
    'admin_debits_taken',   v_total_admin_debit,
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


-- ── Fix the money-flow time series chart too ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_money_flow_series(
  p_start timestamptz,
  p_end   timestamptz
)
RETURNS TABLE (
  bucket       date,
  deposits     numeric,
  withdrawals  numeric,
  admin_out    numeric,   -- admin credits (casino pays player)
  admin_in     numeric,   -- admin debits  (casino takes from player)
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
     WHERE type = 'deposit' AND status = 'success'
       AND created_at BETWEEN p_start AND p_end
     GROUP BY 1
  ),
  wdr AS (
    SELECT DATE(created_at) AS d, COALESCE(SUM(amount), 0) AS v
      FROM transactions
     WHERE type = 'withdrawal' AND status IN ('success','approved','completed')
       AND created_at BETWEEN p_start AND p_end
     GROUP BY 1
  ),
  adm_out AS (
    -- admin_credit = casino pays player → outflow
    SELECT DATE(created_at) AS d, COALESCE(SUM(amount), 0) AS v
      FROM transactions
     WHERE type = 'admin_credit' AND status = 'success'
       AND created_at BETWEEN p_start AND p_end
     GROUP BY 1
  ),
  adm_in AS (
    -- admin_debit = casino takes from player → inflow
    SELECT DATE(created_at) AS d, COALESCE(SUM(amount), 0) AS v
      FROM transactions
     WHERE type = 'admin_debit' AND status = 'success'
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
    COALESCE(dep.v,            0)::numeric AS deposits,
    COALESCE(wdr.v,            0)::numeric AS withdrawals,
    COALESCE(ao.v,             0)::numeric AS admin_out,
    COALESCE(ai.v,             0)::numeric AS admin_in,
    COALESCE(bp.total_bet,     0)::numeric AS wagered,
    COALESCE(bp.total_payout,  0)::numeric AS won,
    COALESCE(bp.total_bet - bp.total_payout, 0)::numeric AS ggr
  FROM days
  LEFT JOIN dep       ON dep.d  = days.bucket
  LEFT JOIN wdr       ON wdr.d  = days.bucket
  LEFT JOIN adm_out ao ON ao.d  = days.bucket
  LEFT JOIN adm_in  ai ON ai.d  = days.bucket
  LEFT JOIN bets_payouts bp ON bp.d = days.bucket
  ORDER BY days.bucket;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_money_flow_series(timestamptz, timestamptz)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
