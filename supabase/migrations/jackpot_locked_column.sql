-- ============================================================
-- Add locked column to jackpots table
--
-- This column is the DB-authoritative lock flag.
-- When an admin locks a jackpot:
--   1. The admin panel writes locked = true here.
--   2. All player browsers read this column in syncFromSupabase()
--      and apply jackpotEngine.setMode(id, 'locked'), preventing
--      wins in the client-side engine.
--
-- Previously the lock only existed in localStorage of the admin's
-- browser, so players on other browsers were unaffected.
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE public.jackpots
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;

-- Expose it to authenticated reads (the existing "Anyone can read jackpots"
-- policy already covers SELECT, this is just documentation).
COMMENT ON COLUMN public.jackpots.locked IS
  'When true, the jackpot cannot trigger on any player spin. '
  'Set by admins via the admin panel and synced to all clients.';

NOTIFY pgrst, 'reload schema';
