-- Allow super admins to delete leaderboard entries (needed for Reset Wins)
-- Run in: Supabase Dashboard → SQL Editor

DROP POLICY IF EXISTS "Super admins can delete leaderboard" ON public.leaderboard;
CREATE POLICY "Super admins can delete leaderboard"
  ON public.leaderboard FOR DELETE
  USING (
    public.has_any_admin_role(ARRAY['super_admin'])
  );
