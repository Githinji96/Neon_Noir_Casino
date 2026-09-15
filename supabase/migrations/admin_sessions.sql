-- ============================================================
-- Admin Sessions Table
-- Tracks server-side session start time for admin users.
-- This is the authoritative source — frontend cannot bypass it.
--
-- ADMIN_SESSION_TIMEOUT = 30 minutes (enforced in check/refresh RPCs)
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  user_id      uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  last_extended_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Only service role and the user themselves can read their session row
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin reads own session" ON public.admin_sessions;
CREATE POLICY "Admin reads own session"
  ON public.admin_sessions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service manages sessions" ON public.admin_sessions;
CREATE POLICY "Service manages sessions"
  ON public.admin_sessions FOR ALL
  USING (auth.role() = 'service_role');

-- ── RPC: start_admin_session ─────────────────────────────────────────────────
-- Called on successful admin login.
-- Creates or replaces the session row.
CREATE OR REPLACE FUNCTION public.start_admin_session(p_timeout_minutes int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_expires  timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only allow admins to create sessions
  IF public.get_my_admin_role() NOT IN ('super_admin','finance_admin','support_agent','game_manager') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  v_expires := now() + (p_timeout_minutes || ' minutes')::interval;

  INSERT INTO admin_sessions (user_id, started_at, expires_at)
  VALUES (v_user_id, now(), v_expires)
  ON CONFLICT (user_id) DO UPDATE
    SET started_at = now(),
        expires_at = v_expires,
        last_extended_at = NULL;

  RETURN jsonb_build_object(
    'authenticated', true,
    'expiresAt',     v_expires
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_admin_session(int) TO authenticated;

-- ── RPC: check_admin_session ─────────────────────────────────────────────────
-- Validates the current admin session against the server clock.
-- Returns the session status — frontend polls this every 60 seconds.
CREATE OR REPLACE FUNCTION public.check_admin_session()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_session admin_sessions%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_session
  FROM admin_sessions
  WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'no_session');
  END IF;

  IF now() >= v_session.expires_at THEN
    -- Expired — delete the row so future checks also fail
    DELETE FROM admin_sessions WHERE user_id = v_user_id;
    RETURN jsonb_build_object('valid', false, 'reason', 'expired', 'expiredAt', v_session.expires_at);
  END IF;

  RETURN jsonb_build_object(
    'valid',     true,
    'expiresAt', v_session.expires_at,
    'secondsRemaining', EXTRACT(EPOCH FROM (v_session.expires_at - now()))::int
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_admin_session() TO authenticated;

-- ── RPC: refresh_admin_session ───────────────────────────────────────────────
-- Extends the session by another 30 minutes IF the session is still valid.
-- A user cannot extend an already-expired session.
CREATE OR REPLACE FUNCTION public.refresh_admin_session(p_timeout_minutes int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_session  admin_sessions%ROWTYPE;
  v_expires  timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_session
  FROM admin_sessions
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_session');
  END IF;

  IF now() >= v_session.expires_at THEN
    DELETE FROM admin_sessions WHERE user_id = v_user_id;
    RETURN jsonb_build_object('success', false, 'reason', 'already_expired');
  END IF;

  v_expires := now() + (p_timeout_minutes || ' minutes')::interval;

  UPDATE admin_sessions
  SET expires_at = v_expires,
      last_extended_at = now()
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'success',   true,
    'expiresAt', v_expires
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_admin_session(int) TO authenticated;

-- ── RPC: end_admin_session ───────────────────────────────────────────────────
-- Explicitly ends the session on logout.
CREATE OR REPLACE FUNCTION public.end_admin_session()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM admin_sessions WHERE user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_admin_session() TO authenticated;

NOTIFY pgrst, 'reload schema';
