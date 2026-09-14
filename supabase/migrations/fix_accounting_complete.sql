-- ============================================================
-- COMPLETE ACCOUNTING FIX — supersedes all previous versions
--
-- Changes:
--   1. admin_credit_player  — stores reason + accounting metadata
--   2. admin_debit_player   — stores reason + accounting metadata
--   3. get_casino_financial_summary — correct accounting, VOLATILE
--   4. get_money_flow_series        — correct accounting, VOLATILE
--   5. get_game_financial_summary   — VOLATILE (no logic change)
--
-- Accounting rules:
--   admin_credit = casino PAYS player  → casino_balance--, player_balance++
--   admin_debit  = casino TAKES player → casino_balance++, player_balance--
--   Neither affects GGR (GGR = spins.bet - spins.payout only)
--   Neither is classified as a player deposit or withdrawal
--
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run (all are CREATE OR REPLACE).
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- 1. TRANSACTIONS TABLE — add notes column for reason/metadata
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS notes            text,
  ADD COLUMN IF NOT EXISTS casino_impact    numeric(14,2),
  ADD COLUMN IF NOT EXISTS previous_player_balance  numeric(14,2),
  ADD COLUMN IF NOT EXISTS new_player_balance       numeric(14,2),
  ADD COLUMN IF NOT EXISTS previous_casino_balance  numeric(14,2),
  ADD COLUMN IF NOT EXISTS new_casino_balance       numeric(14,2);


-- ══════════════════════════════════════════════════════════════
-- 2. admin_credit_player
--    Player balance ++, Casino balance --, GGR unchanged
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_credit_player(
  p_player_id  uuid,
  p_amount     numeric,
  p_reason     text,
  p_admin_id   uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role         text;
  v_player_balance     numeric;
  v_casino_balance     numeric;
  v_new_player_bal     numeric;
  v_new_casino_bal     numeric;
  v_admin_username     text;
BEGIN
  -- ── Auth check ──────────────────────────────────────────────────────────
  v_admin_role := public.get_my_admin_role();
  IF v_admin_role NOT IN ('super_admin', 'finance_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin or finance_admin role required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  -- ── Lock rows in a consistent order (profile first, then casino) ─────────
  SELECT balance INTO v_player_balance
    FROM public.profiles
   WHERE id = p_player_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  SELECT balance INTO v_casino_balance
    FROM public.casino_account
   WHERE id = 1
     FOR UPDATE;

  SELECT COALESCE(username, 'admin') INTO v_admin_username
    FROM public.profiles
   WHERE id = p_admin_id;

  -- ── Compute balances ─────────────────────────────────────────────────────
  v_new_player_bal := ROUND((v_player_balance + p_amount)::numeric, 2);
  v_new_casino_bal := ROUND((v_casino_balance - p_amount)::numeric, 2);

  -- ── Apply updates atomically ─────────────────────────────────────────────
  UPDATE public.profiles
     SET balance    = v_new_player_bal,
         updated_at = now()
   WHERE id = p_player_id;

  UPDATE public.casino_account
     SET balance    = v_new_casino_bal,
         updated_at = now()
   WHERE id = 1;

  -- ── Full audit transaction record ────────────────────────────────────────
  INSERT INTO public.transactions (
    user_id,
    amount,
    type,
    status,
    approved_by,
    approved_at,
    notes,
    casino_impact,
    previous_player_balance,
    new_player_balance,
    previous_casino_balance,
    new_casino_balance
  ) VALUES (
    p_player_id,
    p_amount,
    'admin_credit',           -- NEVER 'deposit'
    'success',
    v_admin_username,
    now(),
    p_reason,
    -p_amount,                -- casino_impact: negative = outflow from casino
    v_player_balance,
    v_new_player_bal,
    v_casino_balance,
    v_new_casino_bal
  );

  RETURN jsonb_build_object(
    'success',                true,
    'type',                   'admin_credit',
    'amount',                 p_amount,
    'reason',                 p_reason,
    'player_balance',         v_new_player_bal,
    'casino_balance',         v_new_casino_bal,
    -- accounting impact breakdown for the caller
    'player_balance_impact',  p_amount,        -- +X to player
    'casino_funds_impact',    -p_amount,        -- -X from casino
    'ggr_impact',             0,               -- GGR unchanged
    'cash_flow_impact',       -p_amount         -- net cash flow -X
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_credit_player(uuid, numeric, text, uuid)
  TO authenticated;


-- ══════════════════════════════════════════════════════════════
-- 3. admin_debit_player
--    Player balance --, Casino balance ++, GGR unchanged
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_debit_player(
  p_player_id  uuid,
  p_amount     numeric,
  p_reason     text,
  p_admin_id   uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role         text;
  v_player_balance     numeric;
  v_casino_balance     numeric;
  v_new_player_bal     numeric;
  v_new_casino_bal     numeric;
  v_admin_username     text;
BEGIN
  -- ── Auth check ──────────────────────────────────────────────────────────
  v_admin_role := public.get_my_admin_role();
  IF v_admin_role NOT IN ('super_admin', 'finance_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin or finance_admin role required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  -- ── Lock rows ─────────────────────────────────────────────────────────────
  SELECT balance INTO v_player_balance
    FROM public.profiles
   WHERE id = p_player_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  IF v_player_balance < p_amount THEN
    RAISE EXCEPTION 'Debit amount exceeds player balance (balance: %, requested: %)',
      v_player_balance, p_amount;
  END IF;

  SELECT balance INTO v_casino_balance
    FROM public.casino_account
   WHERE id = 1
     FOR UPDATE;

  SELECT COALESCE(username, 'admin') INTO v_admin_username
    FROM public.profiles
   WHERE id = p_admin_id;

  -- ── Compute balances ─────────────────────────────────────────────────────
  v_new_player_bal := ROUND((v_player_balance - p_amount)::numeric, 2);
  v_new_casino_bal := ROUND((v_casino_balance + p_amount)::numeric, 2);

  -- ── Apply updates atomically ─────────────────────────────────────────────
  UPDATE public.profiles
     SET balance    = v_new_player_bal,
         updated_at = now()
   WHERE id = p_player_id;

  UPDATE public.casino_account
     SET balance    = v_new_casino_bal,
         updated_at = now()
   WHERE id = 1;

  -- ── Full audit transaction record ────────────────────────────────────────
  INSERT INTO public.transactions (
    user_id,
    amount,
    type,
    status,
    approved_by,
    approved_at,
    notes,
    casino_impact,
    previous_player_balance,
    new_player_balance,
    previous_casino_balance,
    new_casino_balance
  ) VALUES (
    p_player_id,
    p_amount,
    'admin_debit',            -- NEVER 'withdrawal'
    'success',
    v_admin_username,
    now(),
    p_reason,
    p_amount,                 -- casino_impact: positive = inflow to casino
    v_player_balance,
    v_new_player_bal,
    v_casino_balance,
    v_new_casino_bal
  );

  RETURN jsonb_build_object(
    'success',                true,
    'type',                   'admin_debit',
    'amount',                 p_amount,
    'reason',                 p_reason,
    'player_balance',         v_new_player_bal,
    'casino_balance',         v_new_casino_bal,
    -- accounting impact breakdown for the caller
    'player_balance_impact',  -p_amount,       -- -X from player
    'casino_funds_impact',    p_amount,         -- +X to casino
    'ggr_impact',             0,               -- GGR unchanged
    'cash_flow_impact',       p_amount          -- net cash flow +X
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_debit_player(uuid, numeric, text, uuid)
  TO authenticated;


-- ══════════════════════════════════════════════════════════════
-- 4. get_casino_financial_summary  (VOLATILE, correct accounting)
--
--   GGR           = SUM(spins.bet) - SUM(spins.payout)        [gaming only]
--   Net Cash Flow = (deposits + admin_debits)
--                 - (withdrawals + admin_credits)
--   Total Deposited  = real M-Pesa deposits only
--   Total Withdrawn  = real M-Pesa withdrawals only
--   admin_credit/debit shown as separate line items
-- ══════════════════════════════════════════════════════════════
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
  v_total_admin_credit  numeric;
  v_total_admin_debit   numeric;
  v_total_wagered       numeric;
  v_total_won           numeric;
  v_player_funds        numeric;
  v_pending_deposits    numeric;
  v_pending_withdrawals numeric;
  v_casino_balance      numeric;
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

  -- ── Real M-Pesa deposits only ────────────────────────────────────────────
  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_deposited
    FROM transactions
   WHERE type   = 'deposit'               -- NOT admin_credit
     AND status = 'success'
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- ── Real M-Pesa withdrawals only ─────────────────────────────────────────
  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_withdrawn
    FROM transactions
   WHERE type   = 'withdrawal'            -- NOT admin_debit
     AND status IN ('success','approved','completed')
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- ── Admin credits paid to players (casino outflow) ───────────────────────
  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_admin_credit
    FROM transactions
   WHERE type   = 'admin_credit'
     AND status = 'success'
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- ── Admin debits taken from players (casino inflow) ──────────────────────
  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_admin_debit
    FROM transactions
   WHERE type   = 'admin_debit'
     AND status = 'success'
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- ── GGR — gaming activity only, never touched by admin adjustments ────────
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

  -- ── Live player funds (snapshot liability) ───────────────────────────────
  SELECT COALESCE(SUM(balance), 0)
    INTO v_player_funds
    FROM profiles
   WHERE account_status = 'active'
     AND admin_role IS NULL;

  -- ── Pending M-Pesa deposits ──────────────────────────────────────────────
  SELECT COALESCE(SUM(amount), 0)
    INTO v_pending_deposits
    FROM transactions
   WHERE type   = 'deposit'
     AND status = 'pending';

  -- ── Pending M-Pesa withdrawals ───────────────────────────────────────────
  SELECT COALESCE(SUM(amount), 0)
    INTO v_pending_withdrawals
    FROM transactions
   WHERE type   = 'withdrawal'
     AND status IN ('pending','approved');

  -- ── Casino account balance (live ledger) ─────────────────────────────────
  SELECT COALESCE(balance, 0)
    INTO v_casino_balance
    FROM casino_account
   WHERE id = 1;

  -- ── Jackpots ─────────────────────────────────────────────────────────────
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
    -- M-Pesa flows (never include admin adjustments)
    'total_deposited',      v_total_deposited,
    'total_withdrawn',      v_total_withdrawn,
    -- Net cash flow formula:
    --   inflows  = real deposits + admin debits taken
    --   outflows = real withdrawals + admin credits paid
    'net_cash_flow',        (v_total_deposited + v_total_admin_debit)
                          - (v_total_withdrawn + v_total_admin_credit),
    -- Admin adjustment lines (shown separately in UI)
    'admin_credits_paid',   v_total_admin_credit,
    'admin_debits_taken',   v_total_admin_debit,
    -- GGR = pure gaming (bets minus payouts, no admin adjustments)
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


-- ══════════════════════════════════════════════════════════════
-- 5. get_money_flow_series  (VOLATILE, correct accounting)
--    Deposits  = M-Pesa deposits only
--    Withdrawals = M-Pesa withdrawals only
--    admin_out = admin credits paid (casino outflows)
--    admin_in  = admin debits taken (casino inflows)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_money_flow_series(
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
    SELECT DATE(created_at) AS d, SUM(amount) AS v
      FROM transactions
     WHERE type = 'deposit' AND status = 'success'
       AND created_at BETWEEN p_start AND p_end
     GROUP BY 1
  ),
  wdr AS (
    SELECT DATE(created_at) AS d, SUM(amount) AS v
      FROM transactions
     WHERE type = 'withdrawal' AND status IN ('success','approved','completed')
       AND created_at BETWEEN p_start AND p_end
     GROUP BY 1
  ),
  adm_out AS (
    SELECT DATE(created_at) AS d, SUM(amount) AS v
      FROM transactions
     WHERE type = 'admin_credit' AND status = 'success'
       AND created_at BETWEEN p_start AND p_end
     GROUP BY 1
  ),
  adm_in AS (
    SELECT DATE(created_at) AS d, SUM(amount) AS v
      FROM transactions
     WHERE type = 'admin_debit' AND status = 'success'
       AND created_at BETWEEN p_start AND p_end
     GROUP BY 1
  ),
  sp AS (
    SELECT DATE(created_at) AS d,
           SUM(bet)    AS total_bet,
           SUM(payout) AS total_payout
      FROM spins
     WHERE created_at BETWEEN p_start AND p_end
     GROUP BY 1
  )
  SELECT
    days.d                                             AS bucket,
    COALESCE(dep.v,          0)::numeric               AS deposits,
    COALESCE(wdr.v,          0)::numeric               AS withdrawals,
    COALESCE(ao.v,           0)::numeric               AS admin_out,
    COALESCE(ai.v,           0)::numeric               AS admin_in,
    COALESCE(sp.total_bet,   0)::numeric               AS wagered,
    COALESCE(sp.total_payout,0)::numeric               AS won,
    COALESCE(sp.total_bet - sp.total_payout, 0)::numeric AS ggr
  FROM days
  LEFT JOIN dep     ON dep.d  = days.d
  LEFT JOIN wdr     ON wdr.d  = days.d
  LEFT JOIN adm_out ao ON ao.d = days.d
  LEFT JOIN adm_in  ai ON ai.d = days.d
  LEFT JOIN sp      ON sp.d   = days.d
  ORDER BY days.d;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_money_flow_series(timestamptz, timestamptz)
  TO authenticated;


-- ══════════════════════════════════════════════════════════════
-- 6. get_game_financial_summary  (VOLATILE, no logic change)
-- ══════════════════════════════════════════════════════════════
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
    COALESCE(SUM(s.bet),    0)::numeric                                  AS total_bets,
    COALESCE(SUM(s.payout), 0)::numeric                                  AS total_payouts,
    COALESCE(SUM(s.bet) - SUM(s.payout), 0)::numeric                    AS ggr,
    COUNT(*)                                                              AS spin_count,
    CASE WHEN COUNT(*) > 0
         THEN ROUND(SUM(s.bet) / COUNT(*), 2) ELSE 0 END::numeric       AS avg_bet
  FROM spins s
  WHERE (p_start IS NULL OR s.created_at >= p_start)
    AND s.created_at <= COALESCE(p_end, now())
  GROUP BY s.game_id
  ORDER BY ggr DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_game_financial_summary(timestamptz, timestamptz)
  TO authenticated;


NOTIFY pgrst, 'reload schema';
