-- ============================================================
-- Support Tickets System
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number   text NOT NULL UNIQUE,
  name            text NOT NULL,
  email           text NOT NULL,
  subject         text NOT NULL,
  message         text NOT NULL,
  status          text NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new','open','pending','resolved','closed')),
  priority        text NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high','critical')),
  assigned_admin  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_ticket_replies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  message     text NOT NULL,
  is_admin    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS support_tickets_status_idx    ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS support_tickets_email_idx     ON public.support_tickets(email);
CREATE INDEX IF NOT EXISTS support_tickets_created_idx   ON public.support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS support_replies_ticket_idx    ON public.support_ticket_replies(ticket_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.touch_support_ticket()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS support_ticket_updated ON public.support_tickets;
CREATE TRIGGER support_ticket_updated
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.touch_support_ticket();

-- RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a ticket (public contact form)
DROP POLICY IF EXISTS "Anyone can submit ticket" ON public.support_tickets;
CREATE POLICY "Anyone can submit ticket"
  ON public.support_tickets FOR INSERT
  WITH CHECK (true);

-- Admins can read all tickets
DROP POLICY IF EXISTS "Admins read tickets" ON public.support_tickets;
CREATE POLICY "Admins read tickets"
  ON public.support_tickets FOR SELECT
  USING (public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent','game_manager'));

-- Admins can update tickets (status, priority, assign)
DROP POLICY IF EXISTS "Admins update tickets" ON public.support_tickets;
CREATE POLICY "Admins update tickets"
  ON public.support_tickets FOR UPDATE
  USING (public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent'));

-- Admins can delete tickets
DROP POLICY IF EXISTS "Admins delete tickets" ON public.support_tickets;
CREATE POLICY "Admins delete tickets"
  ON public.support_tickets FOR DELETE
  USING (public.get_my_admin_role() = 'super_admin');

-- Admins read/write replies
DROP POLICY IF EXISTS "Admins manage replies" ON public.support_ticket_replies;
CREATE POLICY "Admins manage replies"
  ON public.support_ticket_replies FOR ALL
  USING (public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent'));

-- Anyone can insert a reply (for player responses — future)
DROP POLICY IF EXISTS "Anyone can insert reply" ON public.support_ticket_replies;
CREATE POLICY "Anyone can insert reply"
  ON public.support_ticket_replies FOR INSERT
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
