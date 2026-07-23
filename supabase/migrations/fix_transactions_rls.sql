-- ============================================================
-- FIX: Transactions RLS + missing columns
-- Self-contained — does NOT depend on has_any_admin_role()
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add missing columns (safe to re-run)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS type             text         DEFAULT 'deposit',
  ADD COLUMN IF NOT EXISTS approved_at      timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by      text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS phone            text;

-- 2. Make sure RLS is enabled
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 3. Drop old policies cleanly
DROP POLICY IF EXISTS "Users read own transactions"        ON public.transactions;
DROP POLICY IF EXISTS "Service role manages transactions"  ON public.transactions;
DROP POLICY IF EXISTS "Admins can read all transactions"   ON public.transactions;
DROP POLICY IF EXISTS "Admins can update transactions"     ON public.transactions;
DROP POLICY IF EXISTS "Admins can insert transactions"     ON public.transactions;

-- 4. Players read their own transactions
CREATE POLICY "Users read own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

-- 5. Admins (any role) can read ALL transactions
CREATE POLICY "Admins can read all transactions"
  ON public.transactions FOR SELECT
  USING (public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent','game_manager'));

-- 6. super_admin + finance_admin can UPDATE transactions (approve/reject)
CREATE POLICY "Admins can update transactions"
  ON public.transactions FOR UPDATE
  USING (public.get_my_admin_role() IN ('super_admin','finance_admin'))
  WITH CHECK (public.get_my_admin_role() IN ('super_admin','finance_admin'));

-- 7. super_admin + finance_admin can INSERT transactions
CREATE POLICY "Admins can insert transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (public.get_my_admin_role() IN ('super_admin','finance_admin'));

-- 8. Service role (Edge Functions) bypasses RLS entirely
CREATE POLICY "Service role manages transactions"
  ON public.transactions FOR ALL
  USING (auth.role() = 'service_role');

-- 9. Reload PostgREST schema cache so the profiles join works
NOTIFY pgrst, 'reload schema';
