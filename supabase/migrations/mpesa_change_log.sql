-- ============================================================
-- M-Pesa Number Change Audit Log
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mpesa_change_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  previous_phone   text NOT NULL,
  new_phone        text NOT NULL,
  password_verified boolean NOT NULL DEFAULT false,
  ip_address       text,
  user_agent       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mpesa_change_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read the log
DROP POLICY IF EXISTS "Admins read mpesa log" ON public.mpesa_change_log;
CREATE POLICY "Admins read mpesa log"
  ON public.mpesa_change_log FOR SELECT
  USING (public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent'));

-- Service role inserts
DROP POLICY IF EXISTS "Service role manages mpesa log" ON public.mpesa_change_log;
CREATE POLICY "Service role manages mpesa log"
  ON public.mpesa_change_log FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated user can insert their own log entry
DROP POLICY IF EXISTS "User inserts own mpesa log" ON public.mpesa_change_log;
CREATE POLICY "User inserts own mpesa log"
  ON public.mpesa_change_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add phone_changed_at to profiles for cooling-off period tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_changed_at timestamptz;

NOTIFY pgrst, 'reload schema';
