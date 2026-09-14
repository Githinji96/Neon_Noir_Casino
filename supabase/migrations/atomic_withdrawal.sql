-- ============================================================
-- SECURITY: Atomic withdrawal submission RPC
-- Atomically validates, inserts transaction, and deducts balance
-- in a single DB transaction with FOR UPDATE lock.
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_withdrawal(
  p_amount  numeric,
  p_phone   text DEFAULT NULL   -- ignored; always reads verified phone from profiles
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id          uuid    := auth.uid();
  v_balance          numeric;
  v_phone            text;
  v_account_status   text;
  v_today_total      numeric;
  v_txn_id           uuid;
  v_normalized_phone text;
  v_digits           text;
  v_min_withdrawal   numeric := 50;
  v_max_withdrawal   numeric := 70000;
  v_daily_limit      numeric := 150000;
BEGIN
  -- ── 1. Must be authenticated ─────────────────────────────────────────
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- ── 2. Validate amount ───────────────────────────────────────────────
  IF p_amount IS NULL OR p_amount < v_min_withdrawal THEN
    RAISE EXCEPTION 'Minimum withdrawal is KES %', v_min_withdrawal;
  END IF;
  IF p_amount > v_max_withdrawal THEN
    RAISE EXCEPTION 'Maximum single withdrawal is KES %', v_max_withdrawal;
  END IF;

  -- ── 3. Lock and read player profile ─────────────────────────────────
  SELECT balance, phone, account_status
    INTO v_balance, v_phone, v_account_status
    FROM profiles
   WHERE id = v_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player profile not found';
  END IF;

  IF v_account_status IN ('banned', 'suspended') THEN
    RAISE EXCEPTION 'Account is not active';
  END IF;

  IF v_phone IS NULL OR v_phone = '' THEN
    RAISE EXCEPTION 'No verified M-Pesa number on your account';
  END IF;

  -- ── 4. Check sufficient balance ──────────────────────────────────────
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: KES %', v_balance;
  END IF;

  -- ── 5. Check daily limit ─────────────────────────────────────────────
  SELECT COALESCE(SUM(amount), 0)
    INTO v_today_total
    FROM transactions
   WHERE user_id = v_user_id
     AND type    = 'withdrawal'
     AND status NOT IN ('rejected', 'failed')
     AND created_at >= CURRENT_DATE;

  IF v_today_total + p_amount > v_daily_limit THEN
    RAISE EXCEPTION 'Daily withdrawal limit of KES % exceeded. Already used: KES %',
      v_daily_limit, v_today_total;
  END IF;

  -- ── 6. Check cooldown (1 hour between requests) ──────────────────────
  IF EXISTS (
    SELECT 1 FROM transactions
     WHERE user_id = v_user_id
       AND type    = 'withdrawal'
       AND status IN ('pending', 'approved', 'processing')
       AND created_at > now() - interval '1 hour'
  ) THEN
    RAISE EXCEPTION 'A withdrawal is already pending. Please wait 1 hour between requests.';
  END IF;

  -- ── 7. Normalise phone to 2547XXXXXXXX ──────────────────────────────
  v_digits := regexp_replace(v_phone, '[^0-9]', '', 'g');
  IF left(v_digits, 3) = '254' THEN
    v_normalized_phone := left(v_digits, 12);
  ELSIF left(v_digits, 1) = '0' THEN
    v_normalized_phone := '254' || substring(v_digits from 2 for 9);
  ELSE
    v_normalized_phone := '254' || left(v_digits, 9);
  END IF;

  -- ── 8. Atomically insert transaction + deduct balance ────────────────
  INSERT INTO transactions (user_id, amount, phone, type, status)
  VALUES (v_user_id, p_amount, v_normalized_phone, 'withdrawal', 'pending')
  RETURNING id INTO v_txn_id;

  UPDATE profiles
     SET balance    = ROUND((v_balance - p_amount)::numeric, 2),
         updated_at = now()
   WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success',        true,
    'transaction_id', v_txn_id,
    'new_balance',    ROUND((v_balance - p_amount)::numeric, 2)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_withdrawal(numeric, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submit_withdrawal(numeric, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
