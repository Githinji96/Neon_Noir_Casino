-- ============================================================
-- admin_delete_player RPC  (v2 — hard delete, no soft-ban)
--
-- Permanently removes a player:
--   1. Deletes the public.profiles row  (cascades to related rows
--      that have ON DELETE CASCADE: vip_users, player_stats, etc.)
--   2. Deletes the auth.users row       (revokes all sessions)
--
-- Financial safety:
--   transactions, spins, leaderboard, jackpot_wins, audit_logs
--   use ON DELETE SET NULL or ON DELETE RESTRICT — they are
--   intentionally preserved for financial/audit integrity.
--
-- Authorization:
--   Caller must be authenticated with admin_role = 'super_admin'.
--   Cannot delete yourself.
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_delete_player(p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  -- 1. Verify the caller is an authenticated super_admin
  SELECT admin_role
    INTO v_caller_role
    FROM public.profiles
   WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Forbidden: only super_admin can delete players';
  END IF;

  -- 2. Prevent self-deletion
  IF p_player_id = auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: cannot delete your own account';
  END IF;

  -- 3. Delete the profile row.
  --    Rows with ON DELETE CASCADE (vip_users, player_stats, etc.)
  --    are removed automatically.
  --    Rows with ON DELETE SET NULL (transactions, leaderboard, etc.)
  --    retain their data but lose the foreign-key link — preserving
  --    financial and audit records as required.
  DELETE FROM public.profiles WHERE id = p_player_id;

  -- 4. Delete the auth identity — revokes all active sessions and
  --    prevents the player from signing back in.
  DELETE FROM auth.users WHERE id = p_player_id;

END;
$$;

REVOKE ALL   ON FUNCTION public.admin_delete_player(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_player(uuid) TO authenticated;

-- Reload PostgREST schema cache so the RPC is immediately callable
NOTIFY pgrst, 'reload schema';
