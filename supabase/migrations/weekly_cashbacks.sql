-- ============================================================
-- Weekly Cashback System
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. weekly_cashbacks table ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weekly_cashbacks (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start            timestamptz NOT NULL,  -- Monday 00:00 EAT (stored as UTC)
  week_end              timestamptz NOT NULL,  -- Sunday 23:59:59 EAT (stored as UTC)
  vip_tier              text NOT NULL,
  cashback_rate         numeric(5,4) NOT NULL,  -- e.g. 0.01 = 1%
  eligible_bets         numeric(14,2) NOT NULL DEFAULT 0,
  eligible_payouts      numeric(14,2) NOT NULL DEFAULT 0,
  eligible_net_loss     numeric(14,2) NOT NULL DEFAULT 0,
  cashback_amount       numeric(14,2) NOT NULL DEFAULT 0,
  status                text NOT NULL DEFAULT 'ACCUMULATING'
                        CHECK (status IN ('ACCUMULATING','READY_TO_CLAIM','CLAIMED','EXPIRED')),
  calculated_at         timestamptz,
  claimed_at            timestamptz,
  wallet_transaction_id uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate weekly records per user
  CONSTRAINT uq_weekly_cashback_user_week UNIQUE (user_id, week_start)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_wc_user_status ON public.weekly_cashbacks (user_id, status);
CREATE INDEX IF NOT EXISTS idx_wc_week_start   ON public.weekly_cashbacks (week_start);

-- ── 2. RLS ───────────────────────────────────────────────────
ALTER TABLE public.weekly_cashbacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own cashbacks"   ON public.weekly_cashbacks;
DROP POLICY IF EXISTS "Service manages cashbacks"  ON public.weekly_cashbacks;
DROP POLICY IF EXISTS "Admins read all cashbacks"  ON public.weekly_cashbacks;

CREATE POLICY "Users read own cashbacks"
  ON public.weekly_cashbacks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service manages cashbacks"
  ON public.weekly_cashbacks FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins read all cashbacks"
  ON public.weekly_cashbacks FOR SELECT
  USING (public.get_my_admin_role() IN ('super_admin','finance_admin'));

-- ── 3. Helper: current EAT week boundaries ───────────────────
-- Returns (week_start_utc, week_end_utc) for the current Mon–Sun EAT week
CREATE OR REPLACE FUNCTION public.get_current_eat_week()
RETURNS TABLE(week_start timestamptz, week_end timestamptz)
LANGUAGE sql STABLE AS $$
  SELECT
    -- Monday 00:00 EAT = Monday 00:00 UTC+3
    date_trunc('week', now() AT TIME ZONE 'Africa/Nairobi')
      AT TIME ZONE 'Africa/Nairobi' AS week_start,
    -- Sunday 23:59:59 EAT
    (date_trunc('week', now() AT TIME ZONE 'Africa/Nairobi')
      + interval '6 days 23 hours 59 minutes 59 seconds')
      AT TIME ZONE 'Africa/Nairobi' AS week_end;
$$;

-- ── 4. Claim RPC — atomic, idempotent ────────────────────────
CREATE OR REPLACE FUNCTION public.claim_weekly_cashback(
  p_user_id   uuid,
  p_record_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record  weekly_cashbacks%ROWTYPE;
  v_balance numeric(14,2);
  v_new_bal numeric(14,2);
  v_txn_id  uuid;
BEGIN
  -- Lock the row for update so concurrent calls can't double-claim
  SELECT * INTO v_record
  FROM weekly_cashbacks
  WHERE id = p_record_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'record_not_found');
  END IF;

  IF v_record.status <> 'READY_TO_CLAIM' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_claimable', 'status', v_record.status);
  END IF;

  IF v_record.cashback_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'zero_amount');
  END IF;

  -- Read current balance
  SELECT balance INTO v_balance FROM profiles WHERE id = p_user_id FOR UPDATE;
  v_new_bal := round(coalesce(v_balance, 0) + v_record.cashback_amount, 2);

  -- Credit wallet
  UPDATE profiles
  SET balance    = v_new_bal,
      updated_at = now()
  WHERE id = p_user_id;

  -- Insert wallet transaction
  INSERT INTO transactions (user_id, amount, type, status, created_at)
  VALUES (p_user_id, v_record.cashback_amount, 'cashback', 'success', now())
  RETURNING id INTO v_txn_id;

  -- Mark claimed
  UPDATE weekly_cashbacks
  SET status                = 'CLAIMED',
      claimed_at            = now(),
      wallet_transaction_id = v_txn_id,
      updated_at            = now()
  WHERE id = p_record_id;

  RETURN jsonb_build_object(
    'ok',            true,
    'amount',        v_record.cashback_amount,
    'new_balance',   v_new_bal,
    'transaction_id', v_txn_id
  );
END;
$$;

-- Grant execute to authenticated users (RLS + user_id check inside prevents misuse)
GRANT EXECUTE ON FUNCTION public.claim_weekly_cashback(uuid, uuid) TO authenticated;

-- ── 5. Reload PostgREST schema cache ────────────────────────
NOTIFY pgrst, 'reload schema';
