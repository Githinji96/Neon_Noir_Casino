-- ============================================================
-- Ensure spins table exists with correct structure and RLS.
-- The spins table was only in supabase-admin-schema.sql (manual run).
-- This migration guarantees it exists when run via the migrations folder.
-- Safe to re-run (all statements are idempotent).
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.spins (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  game_id      text        NOT NULL,
  bet          numeric(10, 2) NOT NULL,
  payout       numeric(10, 2) NOT NULL DEFAULT 0,
  is_free_spin boolean     NOT NULL DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

-- Indexes for fast aggregation by user, game, and date
CREATE INDEX IF NOT EXISTS spins_user_id_idx    ON public.spins (user_id);
CREATE INDEX IF NOT EXISTS spins_game_id_idx    ON public.spins (game_id);
CREATE INDEX IF NOT EXISTS spins_created_at_idx ON public.spins (created_at);

-- RLS
ALTER TABLE public.spins ENABLE ROW LEVEL SECURITY;

-- Players can insert their own spins
DROP POLICY IF EXISTS "Users can insert own spins" ON public.spins;
CREATE POLICY "Users can insert own spins"
  ON public.spins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Players can read their own spins
DROP POLICY IF EXISTS "Users can read own spins" ON public.spins;
CREATE POLICY "Users can read own spins"
  ON public.spins FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all spins
DROP POLICY IF EXISTS "Admins can read all spins" ON public.spins;
CREATE POLICY "Admins can read all spins"
  ON public.spins FOR SELECT
  USING (
    public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent','game_manager')
  );

-- Service role full access (used by edge functions)
DROP POLICY IF EXISTS "Service role manages spins" ON public.spins;
CREATE POLICY "Service role manages spins"
  ON public.spins FOR ALL
  USING (auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';
