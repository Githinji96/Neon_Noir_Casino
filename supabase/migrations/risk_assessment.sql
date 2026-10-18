-- ============================================================
-- Risk Assessment Table, Indexes, RLS, and Auth RPC
-- ============================================================

-- 1. Table
CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  overall_score      int         NOT NULL CHECK (overall_score  >= 0 AND overall_score  <= 100),
  fraud_risk         int         NOT NULL CHECK (fraud_risk     >= 0 AND fraud_risk     <= 100),
  rg_risk            int         NOT NULL CHECK (rg_risk        >= 0 AND rg_risk        <= 100),
  account_risk       int         NOT NULL CHECK (account_risk   >= 0 AND account_risk   <= 100),
  risk_level         text        NOT NULL CHECK (risk_level IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  signals            jsonb       NOT NULL DEFAULT '[]',
  recommended_action text        NOT NULL,
  features_metadata  jsonb,
  assessed_at        timestamptz NOT NULL DEFAULT now()
);

-- 2. Unique constraint so upsert on user_id keeps only the latest assessment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'risk_assessments_user_id_key'
  ) THEN
    ALTER TABLE public.risk_assessments ADD CONSTRAINT risk_assessments_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_risk_assessments_user    ON public.risk_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_level   ON public.risk_assessments(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_time    ON public.risk_assessments(assessed_at DESC);

-- 4. Row Level Security
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;

-- Super admins and support agents can read
DROP POLICY IF EXISTS "Admins read risk assessments" ON public.risk_assessments;
CREATE POLICY "Admins read risk assessments"
  ON public.risk_assessments
  FOR SELECT
  USING (
    public.get_my_admin_role() IN ('super_admin', 'support_agent')
  );

-- Application layer writes via service role; no direct INSERT/UPDATE from anon/user
-- (no write policies = no writes from non-service-role clients)

-- Admins (super_admin + support_agent) can INSERT and UPDATE via anon client
DROP POLICY IF EXISTS "Admins write risk assessments" ON public.risk_assessments;
CREATE POLICY "Admins write risk assessments"
  ON public.risk_assessments
  FOR ALL
  USING (
    public.get_my_admin_role() IN ('super_admin', 'support_agent')
  )
  WITH CHECK (
    public.get_my_admin_role() IN ('super_admin', 'support_agent')
  );

-- 5. SECURITY DEFINER RPC — validates caller role before allowing assessment
CREATE OR REPLACE FUNCTION public.assess_player_risk(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := public.get_my_admin_role();
  IF v_role NOT IN ('super_admin', 'support_agent') THEN
    RAISE EXCEPTION 'Access denied: requires super_admin or support_agent role';
  END IF;
  -- Feature extraction and scoring are performed in the application layer.
  -- This RPC only validates authorization; it returns an auth token so the
  -- frontend knows it may proceed with the client-side riskEngine.assessPlayer().
  RETURN jsonb_build_object('authorized', true, 'user_id', p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.assess_player_risk(uuid) TO authenticated;
