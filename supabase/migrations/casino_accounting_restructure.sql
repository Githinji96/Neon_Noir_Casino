-- ============================================================
-- Casino Accounting Restructure
--
-- Architecture:
--   casino_account.balance = running cash ledger
--
--   Inflows  (+):  M-Pesa deposits, admin_debit from player
--   Outflows (-):  withdrawals completed, admin_credit to player,
--                  game payouts net loss (payout > bet)
--
--   GGR is NEVER stored in casino_account.
--   GGR is always computed from spins: SUM(bet) - SUM(payout)
--
-- Changes in this migration:
--   1. Add opening_balance column to casino_account to preserve history
--   2. Set opening_balance = current balance (preserves existing -4880)
--   3. Patch mpesa-callback: credit casino_account on deposit success
--      → done via new RPC record_deposit_cash_inflow (idempotent)
--   4. Patch withdrawal completion: debit casino_account when withdrawal
--      is marked completed → done via update_withdrawal_cash_outflow
--   5. Update get_casino_financial_summary to return correct fields
--   6. Update get_money_flow_series with admin_out/admin_in columns
--
-- IDEMPOTENCY:
--   record_deposit_cash_inflow: guarded by transaction_id uniqueness in
--   a new casino_ledger_entries table — replay of same txn_id is ignored.
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Add opening_balance to preserve the existing -4,880 history ──────────
ALTER TABLE public.casino_account
  ADD COLUMN IF NOT EXISTS opening_balance numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_event_at   timestamptz;

-- Snapshot the current balance as the opening balance (one-time)
UPDATE public.casino_account
   SET opening_balance = balance,
       last_event_at   = now()
 WHERE id = 1
   AND opening_balance = 0;  -- only on first run

-- ── 2. Casino ledger entries table ──────────────────────────────────────────
-- Append-only audit log of every casino cash movement.
-- Prevents double-counting: each source_id (transaction.id or spin.id)
-- can only appear once per event_type.

CREATE TABLE IF NOT EXISTS public.casino_ledger_entries (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   text        NOT NULL,   -- 'deposit' | 'withdrawal' | 'admin_credit' | 'admin_debit' | 'spin_net'
  source_id    uuid,                   -- transactions.id or jackpot_wins.id
  amount       numeric(18,2) NOT NULL, -- always positive; sign implied by event_type
  direction    text        NOT NULL CHECK (direction IN ('inflow','outflow')),
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate entries for same source event
CREATE UNIQUE INDEX IF NOT EXISTS idx_casino_ledger_source_event
  ON public.casino_ledger_entries (event_type, source_id)
  WHERE source_id IS NOT NULL;

-- RLS: admins read, nobody writes directly
ALTER TABLE public.casino_ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read casino ledger" ON public.casino_ledger_entries;
CREATE POLICY "Admins read casino ledger"
  ON public.casino_ledger_entries FOR SELECT
  USING (public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent','game_manager'));

-- ── 3. RPC: record_deposit_cash_inflow ──────────────────────────────────────
-- Called by the M-Pesa callback AFTER it has successfully credited
-- the player's balance. Idempotent — replaying the same transaction_id
-- is silently ignored due to the unique index above.
--
-- Security: SECURITY DEFINER, callable by service_role only (Edge Function).
-- The frontend never calls this directly.

CREATE OR REPLACE FUNCTION public.record_deposit_cash_inflow(
  p_transaction_id uuid,
  p_amount         numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Idempotency guard: if this transaction_id already has a ledger entry, skip
  IF EXISTS (
    SELECT 1 FROM casino_ledger_entries
     WHERE event_type = 'deposit'
       AND source_id  = p_transaction_id
  ) THEN
    RETURN;
  END IF;

  -- Credit casino cash
  UPDATE casino_account
     SET balance       = ROUND((balance + p_amount)::numeric, 2),
         last_event_at = now()
   WHERE id = 1;

  -- Append audit entry
  INSERT INTO casino_ledger_entries (event_type, source_id, amount, direction, note)
  VALUES ('deposit', p_transaction_id, p_amount, 'inflow', 'M-Pesa deposit confirmed');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_deposit_cash_inflow(uuid, numeric) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_deposit_cash_inflow(uuid, numeric) TO service_role;

-- ── 4. RPC: record_withdrawal_cash_outflow ──────────────────────────────────
-- Called when an admin marks a withdrawal as completed (B2C sent).
-- Idempotent via the unique ledger index.

CREATE OR REPLACE FUNCTION public.record_withdrawal_cash_outflow(
  p_transaction_id uuid,
  p_amount         numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  v_role := public.get_my_admin_role();
  IF v_role NOT IN ('super_admin','finance_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin or finance_admin required';
  END IF;

  -- Idempotency guard
  IF EXISTS (
    SELECT 1 FROM casino_ledger_entries
     WHERE event_type = 'withdrawal'
       AND source_id  = p_transaction_id
  ) THEN
    RETURN;
  END IF;

  -- Debit casino cash
  UPDATE casino_account
     SET balance       = ROUND((balance - p_amount)::numeric, 2),
         last_event_at = now()
   WHERE id = 1;

  -- Audit
  INSERT INTO casino_ledger_entries (event_type, source_id, amount, direction, note)
  VALUES ('withdrawal', p_transaction_id, p_amount, 'outflow', 'Withdrawal completed (B2C sent)');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_withdrawal_cash_outflow(uuid, numeric) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.record_withdrawal_cash_outflow(uuid, numeric) TO authenticated;

-- ── 5. Update admin_credit_player to append ledger entry ────────────────────
-- The existing RPC already updates casino_account.balance atomically.
-- We add the ledger entry here so the history is queryable.

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
  v_player_balance   numeric;
  v_casino_balance   numeric;
  v_new_player_bal   numeric;
  v_new_casino_bal   numeric;
  v_admin_role       text;
  v_txn_id           uuid;
BEGIN
  v_admin_role := public.get_my_admin_role();
  IF v_admin_role NOT IN ('super_admin', 'finance_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin or finance_admin role required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

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

  v_new_player_bal := ROUND((v_player_balance + p_amount)::numeric, 2);
  v_new_casino_bal := ROUND((v_casino_balance - p_amount)::numeric, 2);

  UPDATE public.profiles
     SET balance    = v_new_player_bal,
         updated_at = now()
   WHERE id = p_player_id;

  UPDATE public.casino_account
     SET balance       = v_new_casino_bal,
         last_event_at = now()
   WHERE id = 1;

  INSERT INTO public.transactions (user_id, amount, type, status, approved_by, approved_at)
  VALUES (
    p_player_id, p_amount, 'admin_credit', 'success',
    COALESCE((SELECT username FROM public.profiles WHERE id = p_admin_id), 'admin'),
    now()
  )
  RETURNING id INTO v_txn_id;

  -- Ledger entry
  INSERT INTO public.casino_ledger_entries (event_type, source_id, amount, direction, note)
  VALUES ('admin_credit', v_txn_id, p_amount, 'outflow',
          COALESCE(p_reason, 'Admin credit to player'));

  RETURN jsonb_build_object(
    'success',        true,
    'player_balance', v_new_player_bal,
    'casino_balance', v_new_casino_bal
  );
END;
$$;

-- ── 6. Update admin_debit_player to append ledger entry ─────────────────────

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
  v_player_balance   numeric;
  v_casino_balance   numeric;
  v_new_player_bal   numeric;
  v_new_casino_bal   numeric;
  v_admin_role       text;
  v_txn_id           uuid;
BEGIN
  v_admin_role := public.get_my_admin_role();
  IF v_admin_role NOT IN ('super_admin', 'finance_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin or finance_admin role required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  SELECT balance INTO v_player_balance
    FROM public.profiles
   WHERE id = p_player_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  IF v_player_balance < p_amount THEN
    RAISE EXCEPTION 'Debit amount exceeds player balance';
  END IF;

  SELECT balance INTO v_casino_balance
    FROM public.casino_account
   WHERE id = 1
     FOR UPDATE;

  v_new_player_bal := ROUND((v_player_balance - p_amount)::numeric, 2);
  v_new_casino_bal := ROUND((v_casino_balance + p_amount)::numeric, 2);

  UPDATE public.profiles
     SET balance    = v_new_player_bal,
         updated_at = now()
   WHERE id = p_player_id;

  UPDATE public.casino_account
     SET balance       = v_new_casino_bal,
         last_event_at = now()
   WHERE id = 1;

  INSERT INTO public.transactions (user_id, amount, type, status, approved_by, approved_at)
  VALUES (
    p_player_id, p_amount, 'admin_debit', 'success',
    COALESCE((SELECT username FROM public.profiles WHERE id = p_admin_id), 'admin'),
    now()
  )
  RETURNING id INTO v_txn_id;

  -- Ledger entry
  INSERT INTO public.casino_ledger_entries (event_type, source_id, amount, direction, note)
  VALUES ('admin_debit', v_txn_id, p_amount, 'inflow',
          COALESCE(p_reason, 'Admin debit from player'));

  RETURN jsonb_build_object(
    'success',        true,
    'player_balance', v_new_player_bal,
    'casino_balance', v_new_casino_bal
  );
END;
$$;

-- ── 7. Updated get_casino_financial_summary ──────────────────────────────────
-- Correctly separates:
--   casino_cash_balance  = live casino_account.balance (updated by all cash events)
--   ggr                  = SUM(bet) - SUM(payout) from spins ONLY
--   admin_credits_paid   = admin manual outflows (not in deposits)
--   admin_debits_taken   = admin manual inflows  (not in withdrawals)

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
  v_role := public.get_my_admin_role();
  IF v_role NOT IN ('super_admin','finance_admin','support_agent','game_manager') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_end := COALESCE(p_end, now());

  -- M-Pesa deposits only
  SELECT COALESCE(SUM(amount), 0) INTO v_total_deposited
    FROM transactions
   WHERE type   = 'deposit'
     AND status = 'success'
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- Withdrawals only (completed/success)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_withdrawn
    FROM transactions
   WHERE type   = 'withdrawal'
     AND status IN ('success','completed')
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- Admin credits to players (outflows from casino)
  SELECT COALESCE(SUM(amount), 0) INTO v_admin_credits_paid
    FROM transactions
   WHERE type   = 'admin_credit'
     AND status = 'success'
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- Admin debits from players (inflows to casino)
  SELECT COALESCE(SUM(amount), 0) INTO v_admin_debits_taken
    FROM transactions
   WHERE type   = 'admin_debit'
     AND status = 'success'
     AND (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- GGR from spins only (completely independent of cash flows)
  SELECT COALESCE(SUM(bet), 0) INTO v_total_wagered
    FROM spins
   WHERE (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  SELECT COALESCE(SUM(payout), 0) INTO v_total_won
    FROM spins
   WHERE (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  -- Live player balances (all active accounts including admins)
  SELECT COALESCE(SUM(balance), 0) INTO v_player_funds
    FROM profiles
   WHERE account_status = 'active';

  -- Casino cash ledger (single source of truth)
  SELECT COALESCE(balance, 0), COALESCE(opening_balance, 0)
    INTO v_casino_balance, v_opening_balance
    FROM casino_account
   WHERE id = 1;

  -- Pending
  SELECT COALESCE(SUM(amount), 0) INTO v_pending_deposits
    FROM transactions
   WHERE type = 'deposit' AND status = 'pending';

  SELECT COALESCE(SUM(amount), 0) INTO v_pending_withdrawals
    FROM transactions
   WHERE type = 'withdrawal' AND status IN ('pending','approved');

  -- Jackpots
  SELECT COALESCE(SUM(current_amount), 0) INTO v_jackpot_pool FROM jackpots;

  SELECT COALESCE(SUM(amount), 0), COUNT(*), COALESCE(MAX(amount), 0)
    INTO v_jackpot_paid, v_jackpot_wins_count, v_jackpot_largest
    FROM jackpot_wins
   WHERE (p_start IS NULL OR created_at >= p_start)
     AND created_at <= v_end;

  RETURN jsonb_build_object(
    -- Casino cash position
    'casino_balance',       v_casino_balance,
    'opening_balance',      v_opening_balance,
    -- M-Pesa flows
    'total_deposited',      v_total_deposited,
    'total_withdrawn',      v_total_withdrawn,
    'net_cash_flow',        v_total_deposited - v_total_withdrawn,
    -- Admin adjustments (separate buckets — not mixed with deposits/withdrawals)
    'admin_credits_paid',   v_admin_credits_paid,
    'admin_debits_taken',   v_admin_debits_taken,
    -- GGR (gaming only — never polluted by cash flows)
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

GRANT EXECUTE ON FUNCTION public.get_casino_financial_summary(timestamptz, timestamptz) TO authenticated;

-- ── 8. Updated get_money_flow_series (drop + recreate for new columns) ───────

DROP FUNCTION IF EXISTS public.get_money_flow_series(timestamptz, timestamptz);

CREATE FUNCTION public.get_money_flow_series(
  p_start timestamptz,
  p_end   timestamptz
)
RETURNS TABLE (
  bucket       date,
  deposits     numeric,
  withdrawals  numeric,
  admin_out    numeric,   -- admin_credit outflows
  admin_in     numeric,   -- admin_debit inflows
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
    SELECT generate_series(p_start::date, p_end::date, '1 day'::interval)::date AS day_bucket
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
  sp AS (
    SELECT DATE(created_at) AS d,
           COALESCE(SUM(bet),    0) AS total_bet,
           COALESCE(SUM(payout), 0) AS total_payout
      FROM spins
     WHERE created_at BETWEEN p_start AND p_end
     GROUP BY 1
  )
  SELECT
    days.day_bucket                                              AS bucket,
    COALESCE(dep.v,            0)::numeric                       AS deposits,
    COALESCE(wdr.v,            0)::numeric                       AS withdrawals,
    COALESCE(ao.v,             0)::numeric                       AS admin_out,
    COALESCE(ai.v,             0)::numeric                       AS admin_in,
    COALESCE(sp.total_bet,     0)::numeric                       AS wagered,
    COALESCE(sp.total_payout,  0)::numeric                       AS won,
    COALESCE(sp.total_bet - sp.total_payout, 0)::numeric         AS ggr
  FROM days
  LEFT JOIN dep        ON dep.d = days.day_bucket
  LEFT JOIN wdr        ON wdr.d = days.day_bucket
  LEFT JOIN adm_out ao ON ao.d  = days.day_bucket
  LEFT JOIN adm_in  ai ON ai.d  = days.day_bucket
  LEFT JOIN sp         ON sp.d  = days.day_bucket
  ORDER BY days.day_bucket;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_money_flow_series(timestamptz, timestamptz) TO authenticated;

-- ── 9. RLS for casino_ledger_entries ────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.record_deposit_cash_inflow(uuid, numeric)    TO service_role;
GRANT EXECUTE ON FUNCTION public.record_withdrawal_cash_outflow(uuid, numeric) TO authenticated;

NOTIFY pgrst, 'reload schema';
