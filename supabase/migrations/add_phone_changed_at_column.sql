-- ============================================================
-- Add phone_changed_at column to profiles
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_changed_at timestamptz;

-- Reload PostgREST schema cache so the column is immediately visible
NOTIFY pgrst, 'reload schema';
