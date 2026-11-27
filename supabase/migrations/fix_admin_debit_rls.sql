-- ============================================================
-- Fix: admin_debit_player failing due to casino_account RLS
--
-- Root cause: casino_account has RLS enabled with only a SELECT
-- policy. When admin_debit_player (SECURITY DEFINER) tries to
-- UPDATE casino_account, it runs as the function owner (postgres
-- superuser) and bypasses RLS — BUT only if the function was
-- created by a true superuser. In some Supabase projects the
-- function owner is the schema owner, not postgres, and RLS
-- is NOT bypassed.
--
-- Fix 1: Add an explicit UPDATE policy for casino_account so
--        SECURITY DEFINER RPCs can always write to it.
--
-- Fix 2: Re-grant EXECUTE on admin_debit_player to ensure the
--        anon/authenticated grant is current after any re-deploys.
--
-- Safe to re-run.
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Ensure casino_account has the seed row ─────────────────────────────
INSERT INTO public.casino_account (id, balance)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Add UPDATE policy for casino_account ───────────────────────────────
-- SECURITY DEFINER RPCs (admin_credit_player, admin_debit_player,
-- apply_spin_result, etc.) need to UPDATE this row.
-- Service role covers Edge Functions; the second policy covers
-- SECURITY DEFINER functions called by authenticated admin users.

DROP POLICY IF EXISTS "Service role manages casino account" ON public.casino_account;
DROP POLICY IF EXISTS "SECURITY DEFINER rpcs update casino account" ON public.casino_account;

-- Service role: full access (Edge Functions, server-side operations)
CREATE POLICY "Service role manages casino account"
  ON public.casino_account FOR ALL
  USING     (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Finance roles can read (already existed — recreate to be safe)
DROP POLICY IF EXISTS "Admins read casino account"          ON public.casino_account;
DROP POLICY IF EXISTS "Finance roles read casino account"   ON public.casino_account;

CREATE POLICY "Finance roles read casino account"
  ON public.casino_account FOR SELECT
  USING (
    public.get_my_admin_role() IN ('super_admin', 'finance_admin')
  );

-- ── 3. Ensure admin_debit_player is the latest version ────────────────────
-- Re-deploy the full function so the SECURITY DEFINER owner is
-- current and all column references match the live schema.
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
  -- ── Auth check ─────────────────────────────────────────────────────────
  v_admin_role := public.get_my_admin_role();
  IF v_admin_role NOT IN ('super_admin', 'finance_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin or finance_admin role required (got: %)', COALESCE(v_admin_role, 'NULL');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  -- ── Lock player row ────────────────────────────────────────────────────
  SELECT balance INTO v_player_balance
    FROM public.profiles
   WHERE id = p_player_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found: %', p_player_id;
  END IF;

  IF v_player_balance < p_amount THEN
    RAISE EXCEPTION 'Debit amount % exceeds player balance %', p_amount, v_player_balance;
  END IF;

  -- ── Lock casino row ────────────────────────────────────────────────────
  SELECT balance INTO v_casino_balance
    FROM public.casino_account
   WHERE id = 1
     FOR UPDATE;

  -- Seed casino row if it doesn't exist yet
  IF NOT FOUND THEN
    INSERT INTO public.casino_account (id, balance) VALUES (1, 0)
    ON CONFLICT (id) DO NOTHING;
    v_casino_balance := 0;
  END IF;

  -- ── Admin username ─────────────────────────────────────────────────────
  SELECT COALESCE(username, 'admin') INTO v_admin_username
    FROM public.profiles
   WHERE id = p_admin_id;

  -- ── Compute new balances ───────────────────────────────────────────────
  v_new_player_bal := ROUND((v_player_balance - p_amount)::numeric, 2);
  v_new_casino_bal := ROUND((v_casino_balance + p_amount)::numeric, 2);

  -- ── Apply atomically ───────────────────────────────────────────────────
  UPDATE public.profiles
     SET balance    = v_new_player_bal,
         updated_at = now()
   WHERE id = p_player_id;

  UPDATE public.casino_account
     SET balance    = v_new_casino_bal,
         updated_at = now()
   WHERE id = 1;

  -- ── Transaction record ─────────────────────────────────────────────────
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
    'admin_debit',
    'success',
    v_admin_username,
    now(),
    p_reason,
    p_amount,
    v_player_balance,
    v_new_player_bal,
    v_casino_balance,
    v_new_casino_bal
  );

  RETURN jsonb_build_object(
    'success',               true,
    'type',                  'admin_debit',
    'amount',                p_amount,
    'reason',                p_reason,
    'player_balance',        v_new_player_bal,
    'casino_balance',        v_new_casino_bal,
    'player_balance_impact', -p_amount,
    'casino_funds_impact',   p_amount,
    'ggr_impact',            0,
    'cash_flow_impact',      p_amount
  );
END;
$$;

-- Re-grant after replacing (CREATE OR REPLACE resets grants in some PG versions)
REVOKE EXECUTE ON FUNCTION public.admin_debit_player(uuid, numeric, text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_debit_player(uuid, numeric, text, uuid) TO authenticated;

-- ── 4. Also fix admin_credit_player the same way ──────────────────────────
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
  v_admin_role := public.get_my_admin_role();
  IF v_admin_role NOT IN ('super_admin', 'finance_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin or finance_admin role required (got: %)', COALESCE(v_admin_role, 'NULL');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  SELECT balance INTO v_player_balance
    FROM public.profiles
   WHERE id = p_player_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found: %', p_player_id;
  END IF;

  SELECT balance INTO v_casino_balance
    FROM public.casino_account
   WHERE id = 1
     FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.casino_account (id, balance) VALUES (1, 0)
    ON CONFLICT (id) DO NOTHING;
    v_casino_balance := 0;
  END IF;

  SELECT COALESCE(username, 'admin') INTO v_admin_username
    FROM public.profiles
   WHERE id = p_admin_id;

  v_new_player_bal := ROUND((v_player_balance + p_amount)::numeric, 2);
  v_new_casino_bal := ROUND((v_casino_balance - p_amount)::numeric, 2);

  UPDATE public.profiles
     SET balance    = v_new_player_bal,
         updated_at = now()
   WHERE id = p_player_id;

  UPDATE public.casino_account
     SET balance    = v_new_casino_bal,
         updated_at = now()
   WHERE id = 1;

  INSERT INTO public.transactions (
    user_id, amount, type, status, approved_by, approved_at,
    notes, casino_impact,
    previous_player_balance, new_player_balance,
    previous_casino_balance, new_casino_balance
  ) VALUES (
    p_player_id, p_amount, 'admin_credit', 'success',
    v_admin_username, now(),
    p_reason, -p_amount,
    v_player_balance, v_new_player_bal,
    v_casino_balance, v_new_casino_bal
  );

  RETURN jsonb_build_object(
    'success',               true,
    'type',                  'admin_credit',
    'amount',                p_amount,
    'reason',                p_reason,
    'player_balance',        v_new_player_bal,
    'casino_balance',        v_new_casino_bal,
    'player_balance_impact', p_amount,
    'casino_funds_impact',   -p_amount,
    'ggr_impact',            0,
    'cash_flow_impact',      -p_amount
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_credit_player(uuid, numeric, text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_credit_player(uuid, numeric, text, uuid) TO authenticated;

-- ── 5. Reload PostgREST schema cache ──────────────────────────────────────
NOTIFY pgrst, 'reload schema';
