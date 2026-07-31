-- ============================================================
-- Fix: Admin policies for transaction approve/reject
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add approved_by column if it doesn't exist
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS approved_by text;

-- 2. Allow admins (super_admin + finance_admin) to UPDATE transactions
--    (needed for approve/reject deposit & withdrawal)
DROP POLICY IF EXISTS "Admins can update transactions" ON public.transactions;
CREATE POLICY "Admins can update transactions"
  ON public.transactions FOR UPDATE
  USING (
    public.has_any_admin_role(ARRAY['super_admin','finance_admin'])
  )
  WITH CHECK (
    public.has_any_admin_role(ARRAY['super_admin','finance_admin'])
  );

-- 3. Allow admins to INSERT transactions (for manual adjustments)
DROP POLICY IF EXISTS "Admins can insert transactions" ON public.transactions;
CREATE POLICY "Admins can insert transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (
    public.has_any_admin_role(ARRAY['super_admin','finance_admin'])
  );
