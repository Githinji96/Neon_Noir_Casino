-- ============================================================
-- Casino Account (House Ledger)
-- Tracks the casino's own balance as a single-row ledger.
-- Every admin credit to a player debits this account.
-- Every admin debit from a player credits this account.
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Create table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.casino_account (
  id         int  PRIMARY KEY DEFAULT 1 CHECK (id = 1),   -- enforces single row
  balance    numeric(18,2) NOT NULL DEFAULT 0,
  updated_at timestamptz   NOT NULL DEFAULT now()
);

-- Seed the single row (idempotent)
INSERT INTO public.casino_account (id, balance)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- ── 2. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.casino_account ENABLE ROW LEVEL SECURITY;

-- Admins can read
DROP POLICY IF EXISTS "Admins read casino account" ON public.casino_account;
CREATE POLICY "Admins read casino account"
  ON public.casino_account FOR SELECT
  USING (public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent','game_manager'));

-- No direct writes from client — only via SECURITY DEFINER RPCs below

-- ── 3. RPC: admin_credit_player ───────────────────────────────────────────────
-- Atomically:
--   a) credits the player's balance
--   b) debits the casino account
--   c) inserts a transactions record (type='admin_credit')
-- Restricted to super_admin and finance_admin.
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
BEGIN
  -- ── Auth check ──────────────────────────────────────────────────────────
  v_admin_role := public.get_my_admin_role();
  IF v_admin_role NOT IN ('super_admin', 'finance_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin or finance_admin role required';
  END IF;

  -- ── Validate amount ─────────────────────────────────────────────────────
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  -- ── Lock rows in a consistent order to prevent deadlocks ────────────────
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

  -- ── Compute new balances ────────────────────────────────────────────────
  v_new_player_bal := ROUND((v_player_balance + p_amount)::numeric, 2);
  v_new_casino_bal := ROUND((v_casino_balance - p_amount)::numeric, 2);

  -- ── Apply updates ───────────────────────────────────────────────────────
  UPDATE public.profiles
     SET balance    = v_new_player_bal,
         updated_at = now()
   WHERE id = p_player_id;

  UPDATE public.casino_account
     SET balance    = v_new_casino_bal,
         updated_at = now()
   WHERE id = 1;

  -- ── Insert transaction record ───────────────────────────────────────────
  INSERT INTO public.transactions (
    user_id, amount, type, status, approved_by, approved_at
  ) VALUES (
    p_player_id,
    p_amount,
    'admin_credit',
    'success',
    COALESCE((SELECT username FROM public.profiles WHERE id = p_admin_id), 'admin'),
    now()
  );

  RETURN jsonb_build_object(
    'success',           true,
    'player_balance',    v_new_player_bal,
    'casino_balance',    v_new_casino_bal
  );
END;
$$;

-- ── 4. RPC: admin_debit_player ────────────────────────────────────────────────
-- Atomically:
--   a) debits the player's balance
--   b) credits the casino account
--   c) inserts a transactions record (type='admin_debit')
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
BEGIN
  -- ── Auth check ──────────────────────────────────────────────────────────
  v_admin_role := public.get_my_admin_role();
  IF v_admin_role NOT IN ('super_admin', 'finance_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin or finance_admin role required';
  END IF;

  -- ── Validate amount ─────────────────────────────────────────────────────
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  -- ── Lock rows ────────────────────────────────────────────────────────────
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

  -- ── Compute new balances ────────────────────────────────────────────────
  v_new_player_bal := ROUND((v_player_balance - p_amount)::numeric, 2);
  v_new_casino_bal := ROUND((v_casino_balance + p_amount)::numeric, 2);

  -- ── Apply updates ───────────────────────────────────────────────────────
  UPDATE public.profiles
     SET balance    = v_new_player_bal,
         updated_at = now()
   WHERE id = p_player_id;

  UPDATE public.casino_account
     SET balance    = v_new_casino_bal,
         updated_at = now()
   WHERE id = 1;

  -- ── Insert transaction record ───────────────────────────────────────────
  INSERT INTO public.transactions (
    user_id, amount, type, status, approved_by, approved_at
  ) VALUES (
    p_player_id,
    p_amount,
    'admin_debit',
    'success',
    COALESCE((SELECT username FROM public.profiles WHERE id = p_admin_id), 'admin'),
    now()
  );

  RETURN jsonb_build_object(
    'success',           true,
    'player_balance',    v_new_player_bal,
    'casino_balance',    v_new_casino_bal
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
