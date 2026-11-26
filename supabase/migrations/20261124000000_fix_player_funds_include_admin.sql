-- ============================================================
-- Fix: player_funds should include ALL profiles (including admins)
--
-- The previous query excluded accounts where admin_role IS NOT NULL,
-- which omitted the super_admin's balance from the total.
-- This migration updates get_casino_financial_summary to sum ALL
-- active player balances regardless of admin role.
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
  v_role := public.get_my_admin_role();
  IF v_role NOT IN ('super_admin','finance_admin','support_agent','game_manager') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_end := COALESCE(p_end, now());

  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_deposited
    FROM transactions
   WHERE type    IN ('deposit','admin_credit')
     AND status  = 'success'
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_withdrawn
    FROM transactions
   WHERE type   IN ('withdrawal','admin_debit')
     AND status = 'success'
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  SELECT COALESCE(SUM(bet), 0)
    INTO v_total_wagered
    FROM spins
   WHERE (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  SELECT COALESCE(SUM(payout), 0)
    INTO v_total_won
    FROM spins
   WHERE (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- ── Current player funds = sum of ALL active balances ──────────────────
  -- Includes admin accounts (e.g. super_admin who also plays).
  -- Previously admin_role IS NULL excluded them incorrectly.
  SELECT COALESCE(SUM(balance), 0)
    INTO v_player_funds
    FROM profiles
   WHERE account_status = 'active';

  SELECT COALESCE(SUM(amount), 0)
    INTO v_pending_deposits
    FROM transactions
   WHERE type   = 'deposit'
     AND status = 'pending';

  SELECT COALESCE(SUM(amount), 0)
    INTO v_pending_withdrawals
    FROM transactions
   WHERE type   = 'withdrawal'
     AND status IN ('pending','approved');

  SELECT COALESCE(SUM(current_amount), 0)
    INTO v_jackpot_pool
    FROM jackpots;

  SELECT COALESCE(SUM(amount), 0),
         COUNT(*),
         COALESCE(MAX(amount), 0)
    INTO v_jackpot_paid, v_jackpot_wins_count, v_jackpot_largest
    FROM jackpot_wins
   WHERE (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  RETURN jsonb_build_object(
    'total_deposited',      v_total_deposited,
    'total_withdrawn',      v_total_withdrawn,
    'net_cash_flow',        v_total_deposited - v_total_withdrawn,
    'total_wagered',        v_total_wagered,
    'total_won',            v_total_won,
    'ggr',                  v_total_wagered - v_total_won,
    'player_funds',         v_player_funds,
    'pending_deposits',     v_pending_deposits,
    'pending_withdrawals',  v_pending_withdrawals,
    'jackpot_pool',         v_jackpot_pool,
    'jackpot_paid',         v_jackpot_paid,
    'jackpot_wins_count',   v_jackpot_wins_count,
    'jackpot_largest',      v_jackpot_largest
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_casino_financial_summary(timestamptz, timestamptz)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
