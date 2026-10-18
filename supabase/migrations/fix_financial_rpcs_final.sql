-- ============================================================
-- DEFINITIVE financial RPC fix
--
-- Combines all previous patches into one authoritative version:
--   1. VOLATILE (not STABLE) — prevents stale role-check caching
--   2. Separates deposit vs admin_credit, withdrawal vs admin_debit
--   3. Returns casino_balance from casino_account table
--   4. Returns opening_balance from casino_account table
--   5. Returns admin_credits_paid + admin_debits_taken separately
--   6. get_money_flow_series returns admin_out + admin_in columns
--   7. All date filters applied consistently with IS NULL guard
--   8. pending_deposits / pending_withdrawals are live snapshots (no date filter — by design)
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── 1. get_casino_financial_summary ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_casino_financial_summary(
  p_start timestamptz DEFAULT NULL,
  p_end   timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
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
  v_opening_balance     numeric;
  v_pending_deposits    numeric;
  v_pending_withdrawals numeric;
  v_jackpot_pool        numeric;
  v_jackpot_paid        numeric;
  v_jackpot_wins_count  bigint;
  v_jackpot_largest     numeric;
BEGIN
  -- Auth check
  v_role := public.get_my_admin_role();
  IF v_role NOT IN ('super_admin','finance_admin','support_agent','game_manager') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_end := COALESCE(p_end, now());

  -- Player M-Pesa deposits only (period-filtered)
  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_deposited
    FROM transactions
   WHERE type   = 'deposit'
     AND status = 'success'
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- Player M-Pesa withdrawals only (period-filtered)
  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_withdrawn
    FROM transactions
   WHERE type   = 'withdrawal'
     AND status IN ('success', 'completed')
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- Admin credits paid to players — reduces casino balance (period-filtered)
  SELECT COALESCE(SUM(amount), 0)
    INTO v_admin_credits_paid
    FROM transactions
   WHERE type   = 'admin_credit'
     AND status = 'success'
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- Admin debits taken from players — increases casino balance (period-filtered)
  SELECT COALESCE(SUM(amount), 0)
    INTO v_admin_debits_taken
    FROM transactions
   WHERE type   = 'admin_debit'
     AND status = 'success'
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- Total wagered (period-filtered)
  SELECT COALESCE(SUM(bet), 0)
    INTO v_total_wagered
    FROM spins
   WHERE (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- Total won by players (period-filtered)
  SELECT COALESCE(SUM(payout), 0)
    INTO v_total_won
    FROM spins
   WHERE (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- Current player funds — live snapshot, not period-filtered (intentional)
  SELECT COALESCE(SUM(balance), 0)
    INTO v_player_funds
    FROM profiles
   WHERE account_status = 'active'
     AND admin_role IS NULL;

  -- Casino account balance + opening balance — live snapshot
  SELECT COALESCE(balance, 0),
         COALESCE(opening_balance, 0)
    INTO v_casino_balance, v_opening_balance
    FROM casino_account
   WHERE id = 1;

  -- Pending deposits — live snapshot (not period-filtered)
  SELECT COALESCE(SUM(amount), 0)
    INTO v_pending_deposits
    FROM transactions
   WHERE type   = 'deposit'
     AND status = 'pending';

  -- Pending withdrawals — live snapshot (not period-filtered)
  SELECT COALESCE(SUM(amount), 0)
    INTO v_pending_withdrawals
    FROM transactions
   WHERE type   = 'withdrawal'
     AND status IN ('pending', 'approved');

  -- Jackpot pool — live snapshot
  SELECT COALESCE(SUM(current_amount), 0)
    INTO v_jackpot_pool
    FROM jackpots;

  -- Jackpot payouts (period-filtered)
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
    'admin_credits_paid',   v_admin_credits_paid,
    'admin_debits_taken',   v_admin_debits_taken,
    'total_wagered',        v_total_wagered,
    'total_won',            v_total_won,
    'ggr',                  v_total_wagered - v_total_won,
    'player_funds',         v_player_funds,
    'casino_balance',       v_casino_balance,
    'opening_balance',      v_opening_balance,
    'pending_deposits',     v_pending_deposits,
    'pending_withdrawals',  v_pending_withdrawals,
    'jackpot_pool',         v_jackpot_pool,
    'jackpot_paid',         v_jackpot_paid,
    'jackpot_wins_count',   v_jackpot_wins_count,
    'jackpot_largest',      v_jackpot_largest
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_casino_financial_summary(timestamptz, timestamptz) TO authenticated;


-- ─── 2. get_game_financial_summary ───────────────────────────────────────────

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
VOLATILE
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
    (COALESCE(SUM(s.bet), 0) - COALESCE(SUM(s.payout), 0))::numeric AS ggr,
    COUNT(*)                            AS spin_count,
    CASE WHEN COUNT(*) > 0
         THEN ROUND(COALESCE(SUM(s.bet), 0) / COUNT(*), 2)
         ELSE 0
    END::numeric                        AS avg_bet
  FROM spins s
  WHERE (p_start IS NULL OR s.created_at >= p_start)
    AND s.created_at <= COALESCE(p_end, now())
  GROUP BY s.game_id
  ORDER BY ggr DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_game_financial_summary(timestamptz, timestamptz) TO authenticated;


-- ─── 3. get_money_flow_series ─────────────────────────────────────────────────
-- Must DROP first because the return type is changing (adding admin_out/admin_in)

DROP FUNCTION IF EXISTS public.get_money_flow_series(timestamptz, timestamptz);

CREATE FUNCTION public.get_money_flow_series(
  p_start timestamptz,
  p_end   timestamptz
)
RETURNS TABLE (
  bucket       date,
  deposits     numeric,
  withdrawals  numeric,
  admin_out    numeric,   -- admin_credit outflows from casino
  admin_in     numeric,   -- admin_debit inflows to casino
  wagered      numeric,
  won          numeric,
  ggr          numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
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
    SELECT generate_series(p_start::date, p_end::date, '1 day'::interval)::date AS d
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
    SELECT DATE(created_at) AS d, COALESCE(SUM(amount), 0) AS v
      FROM transactions
     WHERE type = 'admin_credit' AND status = 'success'
       AND created_at BETWEEN p_start AND p_end
     GROUP BY 1
  ),
  adm_in AS (
    SELECT DATE(created_at) AS d, COALESCE(SUM(amount), 0) AS v
      FROM transactions
     WHERE type = 'admin_debit' AND status = 'success'
       AND created_at BETWEEN p_start AND p_end
     GROUP BY 1
  ),
  bp AS (
    SELECT DATE(created_at) AS d,
           COALESCE(SUM(bet),    0) AS total_bet,
           COALESCE(SUM(payout), 0) AS total_payout
      FROM spins
     WHERE created_at BETWEEN p_start AND p_end
     GROUP BY 1
  )
  SELECT
    days.d                                                  AS bucket,
    COALESCE(dep.v,     0)::numeric                         AS deposits,
    COALESCE(wdr.v,     0)::numeric                         AS withdrawals,
    COALESCE(ao.v,      0)::numeric                         AS admin_out,
    COALESCE(ai.v,      0)::numeric                         AS admin_in,
    COALESCE(bp.total_bet,   0)::numeric                    AS wagered,
    COALESCE(bp.total_payout,0)::numeric                    AS won,
    COALESCE(bp.total_bet - bp.total_payout, 0)::numeric    AS ggr
  FROM days
  LEFT JOIN dep         ON dep.d   = days.d
  LEFT JOIN wdr         ON wdr.d   = days.d
  LEFT JOIN adm_out ao  ON ao.d    = days.d
  LEFT JOIN adm_in  ai  ON ai.d    = days.d
  LEFT JOIN bp          ON bp.d    = days.d
  ORDER BY days.d;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_money_flow_series(timestamptz, timestamptz) TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
