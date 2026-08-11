-- ============================================================
-- Notifications System
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. notifications table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('WIN','JACKPOT','DEPOSIT','WITHDRAWAL','VIP','PROMOTION','SECURITY','SYSTEM')),
  title       text NOT NULL,
  message     text NOT NULL,
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  read_at     timestamptz,
  target_url  text,
  metadata    jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id      ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread  ON public.notifications (user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at   ON public.notifications (created_at DESC);

-- ── 2. RLS ───────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications"    ON public.notifications;
DROP POLICY IF EXISTS "Users update own notifications"  ON public.notifications;
DROP POLICY IF EXISTS "Users delete own notifications"  ON public.notifications;
DROP POLICY IF EXISTS "Service manages notifications"   ON public.notifications;
DROP POLICY IF EXISTS "Admins read notifications"       ON public.notifications;

-- Players can only read their own notifications
CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Players can only mark their own as read / delete their own
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Service role (Edge Functions, triggers) manages all
CREATE POLICY "Service manages notifications"
  ON public.notifications FOR ALL
  USING (auth.role() = 'service_role');

-- Admins can read all (support)
CREATE POLICY "Admins read notifications"
  ON public.notifications FOR SELECT
  USING (public.get_my_admin_role() IN ('super_admin', 'support_agent'));

-- ── 3. Enable Realtime for notifications table ───────────────
-- Must be enabled in Supabase Dashboard → Database → Replication
-- OR run this (requires supabase_realtime publication to exist):
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ── 4. Helper: create_notification() ─────────────────────────
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id   uuid,
  p_type      text,
  p_title     text,
  p_message   text,
  p_target_url text DEFAULT NULL,
  p_metadata  jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, target_url, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_target_url, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, jsonb) TO service_role;

-- ── 5. Auto-notify on transaction status changes ─────────────
CREATE OR REPLACE FUNCTION public.notify_on_transaction_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deposit succeeded
  IF NEW.type = 'deposit' AND NEW.status = 'success' AND (OLD.status IS DISTINCT FROM 'success') THEN
    PERFORM create_notification(
      NEW.user_id, 'DEPOSIT',
      'Deposit Successful',
      'Your deposit of KES ' || TO_CHAR(NEW.amount, 'FM999,999,999.00') || ' has been processed.',
      NULL, NULL
    );
  END IF;

  -- Withdrawal completed
  IF NEW.type = 'withdrawal' AND NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    PERFORM create_notification(
      NEW.user_id, 'WITHDRAWAL',
      'Withdrawal Processed',
      'Your withdrawal of KES ' || TO_CHAR(NEW.amount, 'FM999,999,999.00') || ' has been sent to your M-Pesa.',
      NULL, NULL
    );
  END IF;

  -- Withdrawal rejected
  IF NEW.type = 'withdrawal' AND NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    PERFORM create_notification(
      NEW.user_id, 'WITHDRAWAL',
      'Withdrawal Rejected',
      'Your withdrawal of KES ' || TO_CHAR(NEW.amount, 'FM999,999,999.00') || ' was rejected. Your balance has been refunded.',
      NULL, NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_transaction ON public.transactions;
CREATE TRIGGER trg_notify_transaction
  AFTER UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION notify_on_transaction_change();

-- Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
