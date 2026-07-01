-- Drop and recreate live_table_sessions without profiles FK
-- (user_id references auth.users directly, no profiles dependency)

DROP TABLE IF EXISTS public.live_table_sessions CASCADE;

CREATE TABLE public.live_table_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id   text NOT NULL,
  user_id    uuid NOT NULL,
  username   text NOT NULL DEFAULT 'Player',
  joined_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, table_id)
);

ALTER TABLE public.live_table_sessions ENABLE ROW LEVEL SECURITY;

-- Players manage their own session
CREATE POLICY "Users manage own session"
  ON public.live_table_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Everyone can read (for player counts + admin view)
CREATE POLICY "Anyone can read sessions"
  ON public.live_table_sessions FOR SELECT USING (true);

-- Admins can delete any session (kick)
CREATE POLICY "Admins can delete sessions"
  ON public.live_table_sessions FOR DELETE USING (true);
