-- ============================================================
-- COMPLETE ADMIN SETUP — run this in Supabase SQL Editor
-- This is fully self-contained and safe to re-run
-- ============================================================

-- ── 1. Add admin columns to profiles ────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='profiles' AND column_name='admin_role'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN admin_role text
        CHECK (admin_role IN ('super_admin','finance_admin','support_agent','game_manager'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='profiles' AND column_name='account_status'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN account_status text NOT NULL DEFAULT 'active'
        CHECK (account_status IN ('active','suspended','banned'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='profiles' AND column_name='phone'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN phone text;
  END IF;
END $$;

-- ── 2. Profiles RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile"    ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"  ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile"  ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles"  ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Helper: check caller's admin_role WITHOUT triggering RLS on profiles
-- SECURITY DEFINER runs as the function owner (postgres), bypassing RLS
CREATE OR REPLACE FUNCTION public.get_my_admin_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT admin_role FROM public.profiles WHERE id = auth.uid();
$$;

-- Every authenticated user can read their own row (covers admin login)
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can read ALL profiles — uses helper to avoid recursion
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent','game_manager')
  );

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admins can update all profiles (balance adjust, suspend, ban)
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (
    public.get_my_admin_role() IN ('super_admin','finance_admin')
  );

-- Users can insert their own profile (signup trigger)
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ── 3. Transactions columns + RLS ───────────────────────────────────────────
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS type             text DEFAULT 'deposit',
  ADD COLUMN IF NOT EXISTS approved_at      timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by      text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS phone            text;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own transactions"       ON public.transactions;
DROP POLICY IF EXISTS "Service role manages transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can read all transactions"  ON public.transactions;
DROP POLICY IF EXISTS "Admins can update transactions"    ON public.transactions;
DROP POLICY IF EXISTS "Admins can insert transactions"    ON public.transactions;

CREATE POLICY "Users read own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all transactions"
  ON public.transactions FOR SELECT
  USING (
    public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent','game_manager')
  );

CREATE POLICY "Admins can update transactions"
  ON public.transactions FOR UPDATE
  USING (
    public.get_my_admin_role() IN ('super_admin','finance_admin')
  )
  WITH CHECK (
    public.get_my_admin_role() IN ('super_admin','finance_admin')
  );

CREATE POLICY "Admins can insert transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (
    public.get_my_admin_role() IN ('super_admin','finance_admin')
  );

CREATE POLICY "Service role manages transactions"
  ON public.transactions FOR ALL
  USING (auth.role() = 'service_role');

-- ── 4. Admin audit logs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_role      text NOT NULL,
  action_type     text NOT NULL,
  target_entity   text,
  target_id       text,
  previous_value  jsonb,
  new_value       jsonb,
  ip_address      inet,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Admins can read audit logs"   ON public.admin_audit_logs;

CREATE POLICY "Admins can insert audit logs"
  ON public.admin_audit_logs FOR INSERT
  WITH CHECK (public.get_my_admin_role() IS NOT NULL);

CREATE POLICY "Admins can read audit logs"
  ON public.admin_audit_logs FOR SELECT
  USING (public.get_my_admin_role() = 'super_admin');

-- ── 5. Set your user as super_admin ─────────────────────────────────────────
-- Replace <YOUR_USER_ID> with your actual user UUID from auth.users
-- You can find it in: Supabase Dashboard → Authentication → Users
-- Example:
-- UPDATE public.profiles SET admin_role = 'super_admin' WHERE id = 'ecabdec9-12ad-49d9-b404-769a7e4e02b4';

-- ── 6. Reload PostgREST schema cache ────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
