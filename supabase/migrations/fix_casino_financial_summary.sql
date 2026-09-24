-- ============================================================
-- Fix get_casino_financial_summary RPC
--
-- Fixes:
--   1. Language typo: 'plpgsqlv' → 'plpgsql'
--   2. Add casino_balance from casino_account table
--   3. Add separate admin_credits_paid + admin_debits_taken fields
--   4. Fix total_deposited to include ONLY deposits (not admin_credit)
--   5. Fix total_withdrawn to include ONLY withdrawals (not admin_debit)
--   6. Fix get_money_flow_series to return admin_out/admin_in columns
--      (the frontend chart expects these columns)
--
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
  v_admin_credits_paid  numeric;
  v_admin_debits_taken  numeric;
  v_total_wagered       numeric;
  v_total_won           numeric;
  v_player_funds        numeric;
  v_casino_balance      numeric;
  v_pending_deposits    numeric;
  v_pending_withdrawals numeric;
  v_jackpot_pool        numeric;
  v_jackpot_paid        numeric;
  v_jackpot_wins_count  bigint;
  v_jackpot_largest     numeric;
BEGIN
  -- ── Auth check ──────────────────────────────────────────────────────────
  v_role := public.get_my_admin_role();
  IF v_role NOT IN ('super_admin','finance_admin','support_agent','game_manager') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_end := COALESCE(p_end, now());

  -- ── Player deposits only (M-Pesa inflows) ───────────────────────────────
  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_deposited
    FROM transactions
   WHERE type   = 'deposit'
     AND status = 'success'
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- ── Player withdrawals only (M-Pesa outflows) ───────────────────────────
  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_withdrawn
    FROM transactions
   WHERE type   = 'withdrawal'
     AND status IN ('success', 'completed')
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- ── Admin credits paid to players (reduces casino balance) ──────────────
  SELECT COALESCE(SUM(amount), 0)
    INTO v_admin_credits_paid
    FROM transactions
   WHERE type   = 'admin_credit'
     AND status = 'success'
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- ── Admin debits taken from players (increases casino balance) ──────────
  SELECT COALESCE(SUM(amount), 0)
    INTO v_admin_debits_taken
    FROM transactions
   WHERE type   = 'admin_debit'
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
  SELECT COALESCE(SUM(balance), 0)
    INTO v_player_funds
    FROM profiles
   WHERE account_status = 'active'
     AND admin_role IS NULL;

  -- ── Casino account balance (live ledger from casino_account table) ───────
  SELECT COALESCE(balance, 0)
    INTO v_casino_balance
    FROM casino_account
   WHERE id = 1;

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
    -- Core M-Pesa money flows
    'total_deposited',      v_total_deposited,
    'total_withdrawn',      v_total_withdrawn,
    'net_cash_flow',        v_total_deposited - v_total_withdrawn,
    -- Admin adjustments (separate from M-Pesa)
    'admin_credits_paid',   v_admin_credits_paid,
    'admin_debits_taken',   v_admin_debits_taken,
    -- Wagering
    'total_wagered',        v_total_wagered,
    'total_won',            v_total_won,
    'ggr',                  v_total_wagered - v_total_won,
    -- Live positions
    'player_funds',         v_player_funds,
    'casino_balance',       v_casino_balance,
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
-- Fix get_money_flow_series — add admin_out/admin_in columns
-- Must DROP first because return type is changing
-- ============================================================

DROP FUNCTION IF EXISTS public.get_money_flow_series(timestamptz, timestamptz);

CREATE FUNCTION public.get_money_flow_series(
  p_start timestamptz,
  p_end   timestamptz
)
RETURNS TABLE (
  bucket       date,
  deposits     numeric,
  withdrawals  numeric,
  admin_out    numeric,
  admin_in     numeric,
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
     WHERE type = 'withdrawal' AND status IN ('success','completed')
       AND created_at BETWEEN p_start AND p_end
     GROUP BY 1
  ),
  adm_out AS (
    -- admin_credit = casino pays player = outflow from casino
    SELECT DATE(created_at) AS d, COALESCE(SUM(amount), 0) AS v
      FROM transactions
     WHERE type = 'admin_credit' AND status = 'success'
       AND created_at BETWEEN p_start AND p_end
     GROUP BY 1
  ),
  adm_in AS (
    -- admin_debit = casino takes from player = inflow to casino
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
    COALESCE(dep.v,               0)::numeric AS deposits,
    COALESCE(wdr.v,               0)::numeric AS withdrawals,
    COALESCE(ao.v,                0)::numeric AS admin_out,
    COALESCE(ai.v,                0)::numeric AS admin_in,
    COALESCE(bp.total_bet,        0)::numeric AS wagered,
    COALESCE(bp.total_payout,     0)::numeric AS won,
    COALESCE(bp.total_bet - bp.total_payout, 0)::numeric AS ggr
  FROM days
  LEFT JOIN dep         ON dep.d   = days.bucket
  LEFT JOIN wdr         ON wdr.d   = days.bucket
  LEFT JOIN adm_out ao  ON ao.d    = days.bucket
  LEFT JOIN adm_in  ai  ON ai.d    = days.bucket
  LEFT JOIN bets_payouts bp ON bp.d = days.bucket
  ORDER BY days.bucket;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_money_flow_series(timestamptz, timestamptz)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
