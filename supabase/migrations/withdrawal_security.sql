-- ============================================================
-- Secure Withdrawal System
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add phone_verified flag to profiles (safe re-run)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;

-- 2. Mark existing profiles with a phone as verified
UPDATE public.profiles
  SET phone_verified = true
  WHERE phone IS NOT NULL AND phone != '';

-- 3. Withdrawal fraud attempt log
CREATE TABLE IF NOT EXISTS public.withdrawal_fraud_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  registered_phone text,
  submitted_phone  text,
  amount           numeric(12,2),
  ip_address       text,
  user_agent       text,
  attempt_count    int NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_fraud_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read fraud logs
DROP POLICY IF EXISTS "Admins read fraud logs" ON public.withdrawal_fraud_logs;
CREATE POLICY "Admins read fraud logs"
  ON public.withdrawal_fraud_logs FOR SELECT
  USING (public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent'));

-- Service role can insert (used by Edge Function with service key)
DROP POLICY IF EXISTS "Service role inserts fraud logs" ON public.withdrawal_fraud_logs;
CREATE POLICY "Service role inserts fraud logs"
  ON public.withdrawal_fraud_logs FOR ALL
  USING (auth.role() = 'service_role');

-- 4. SECURITY DEFINER function: validate withdrawal phone matches profile
--    Called from the withdrawal Edge Function via supabase.rpc()
--    Returns: 'ok' | 'phone_mismatch' | 'no_phone_registered' | 'user_not_found'
CREATE OR REPLACE FUNCTION public.validate_withdrawal_phone(
  p_user_id      uuid,
  p_phone        text,   -- submitted phone in 2547XXXXXXXX format
  p_amount       numeric,
  p_ip_address   text DEFAULT NULL,
  p_user_agent   text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registered_phone text;
  v_normalized_registered text;
  v_normalized_submitted text;
  v_recent_attempts int;
BEGIN
  -- Fetch registered phone
  SELECT phone INTO v_registered_phone
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN 'user_not_found';
  END IF;

  IF v_registered_phone IS NULL OR v_registered_phone = '' THEN
    RETURN 'no_phone_registered';
  END IF;

  -- Normalize both to digits only for comparison
  v_normalized_registered := regexp_replace(v_registered_phone, '[^0-9]', '', 'g');
  v_normalized_submitted   := regexp_replace(p_phone, '[^0-9]', '', 'g');

  -- Strip leading 254 / 0 to get the 9-digit suffix
  IF length(v_normalized_registered) = 12 AND left(v_normalized_registered, 3) = '254' THEN
    v_normalized_registered := substring(v_normalized_registered from 4);
  ELSIF length(v_normalized_registered) = 10 AND left(v_normalized_registered, 1) = '0' THEN
    v_normalized_registered := substring(v_normalized_registered from 2);
  END IF;

  IF length(v_normalized_submitted) = 12 AND left(v_normalized_submitted, 3) = '254' THEN
    v_normalized_submitted := substring(v_normalized_submitted from 4);
  ELSIF length(v_normalized_submitted) = 10 AND left(v_normalized_submitted, 1) = '0' THEN
    v_normalized_submitted := substring(v_normalized_submitted from 2);
  END IF;

  IF v_normalized_registered != v_normalized_submitted THEN
    -- Count recent failed attempts (last 24h)
    SELECT COUNT(*) INTO v_recent_attempts
    FROM public.withdrawal_fraud_logs
    WHERE user_id = p_user_id
      AND created_at > now() - interval '24 hours';

    -- Log the fraud attempt
    INSERT INTO public.withdrawal_fraud_logs
      (user_id, registered_phone, submitted_phone, amount, ip_address, user_agent, attempt_count)
    VALUES
      (p_user_id, v_registered_phone, p_phone, p_amount, p_ip_address, p_user_agent, v_recent_attempts + 1);

    -- Flag account if too many attempts
    IF v_recent_attempts >= 3 THEN
      UPDATE public.profiles
        SET account_status = 'suspended'
        WHERE id = p_user_id AND account_status = 'active';
    END IF;

    RETURN 'phone_mismatch';
  END IF;

  RETURN 'ok';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_withdrawal_phone(uuid, text, numeric, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.validate_withdrawal_phone(uuid, text, numeric, text, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.validate_withdrawal_phone(uuid, text, numeric, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
