-- ============================================================
-- admin_get_player_email
--
-- Returns the email address for a single player from auth.users.
-- Only callable by authenticated users with an admin role.
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_get_player_email(p_player_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  -- Verify caller has an admin role
  IF public.get_my_admin_role() IS NULL THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT email INTO v_email
    FROM auth.users
   WHERE id = p_player_id;

  RETURN v_email;
END;
$$;

REVOKE ALL   ON FUNCTION public.admin_get_player_email(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_player_email(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
