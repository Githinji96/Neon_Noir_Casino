-- ============================================================
-- Enable Realtime on the spins table so the admin financial
-- dashboard auto-refreshes when slot spins are recorded.
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.spins;
