-- Enable Realtime for profiles table so balance changes propagate to clients.
-- Run in: Supabase Dashboard → SQL Editor

-- Add profiles to the supabase_realtime publication
-- (safe to run multiple times — ADD TABLE is idempotent on already-added tables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END;
$$;
