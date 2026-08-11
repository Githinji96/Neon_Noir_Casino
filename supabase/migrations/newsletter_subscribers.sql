-- ============================================================
-- Newsletter Subscribers
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text        NOT NULL,
  status     text        NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'duplicate', 'unsubscribed')),
  source     text        NOT NULL DEFAULT 'footer',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint so duplicates are caught at the DB level as well
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_email_idx
  ON public.newsletter_subscribers (lower(email));

-- Index for lookups by status
CREATE INDEX IF NOT EXISTS newsletter_subscribers_status_idx
  ON public.newsletter_subscribers (status);

-- RLS
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Public can insert (the edge function uses the service role, but keeping this open is fine)
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can subscribe"
  ON public.newsletter_subscribers FOR INSERT
  WITH CHECK (true);

-- Only admins can read subscribers
DROP POLICY IF EXISTS "Admins read subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins read subscribers"
  ON public.newsletter_subscribers FOR SELECT
  USING (public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent','game_manager'));

-- Only admins can update/delete
DROP POLICY IF EXISTS "Admins manage subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins manage subscribers"
  ON public.newsletter_subscribers FOR ALL
  USING (public.get_my_admin_role() = 'super_admin');

NOTIFY pgrst, 'reload schema';
