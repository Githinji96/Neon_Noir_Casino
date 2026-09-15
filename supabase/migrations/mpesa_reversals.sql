-- ============================================================
-- M-Pesa Reversal Support
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add reversal tracking columns to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS reversal_status    text,     -- null | 'reversed' | 'partial_reversal'
  ADD COLUMN IF NOT EXISTS reversed_amount    numeric(12,2),
  ADD COLUMN IF NOT EXISTS reversed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS reversal_receipt   text;     -- M-Pesa reversal receipt number

-- 2. Index for fast lookup by mpesa_receipt (used by reversal handler)
CREATE INDEX IF NOT EXISTS idx_transactions_mpesa_receipt
  ON public.transactions (mpesa_receipt)
  WHERE mpesa_receipt IS NOT NULL;

-- 3. Atomic reversal function — deducts balance and marks transaction reversed
CREATE OR REPLACE FUNCTION public.process_mpesa_reversal(
  p_mpesa_receipt     text,      -- original transaction MpesaReceiptNumber
  p_reversal_receipt  text,      -- reversal confirmation receipt
  p_reversed_amount   numeric    -- amount being reversed (may be partial)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn     transactions%ROWTYPE;
  v_balance numeric(12,2);
  v_new_bal numeric(12,2);
BEGIN
  -- Lock the transaction row to prevent concurrent reversals
  SELECT * INTO v_txn
  FROM transactions
  WHERE mpesa_receipt = p_mpesa_receipt
    AND status = 'success'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'transaction_not_found_or_not_credited');
  END IF;

  -- Idempotency: if already reversed with the same receipt, return ok
  IF v_txn.reversal_status IS NOT NULL AND v_txn.reversal_receipt = p_reversal_receipt THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_reversed');
  END IF;

  -- Do not double-reverse
  IF v_txn.reversal_status = 'reversed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_fully_reversed');
  END IF;

  -- Use the minimum of (reversed_amount, original amount) to avoid over-deduction
  DECLARE
    v_deduct numeric(12,2) := LEAST(p_reversed_amount, v_txn.amount);
  BEGIN
    -- Lock the user's balance
    SELECT balance INTO v_balance
    FROM profiles
    WHERE id = v_txn.user_id
    FOR UPDATE;

    v_new_bal := GREATEST(0, ROUND(COALESCE(v_balance, 0) - v_deduct, 2));

    -- Deduct from wallet
    UPDATE profiles
    SET balance    = v_new_bal,
        updated_at = now()
    WHERE id = v_txn.user_id;

    -- Mark the transaction as reversed
    UPDATE transactions
    SET reversal_status  = CASE WHEN v_deduct < v_txn.amount THEN 'partial_reversal' ELSE 'reversed' END,
        reversed_amount  = v_deduct,
        reversed_at      = now(),
        reversal_receipt = p_reversal_receipt,
        status           = 'reversed'
    WHERE id = v_txn.id;

    -- Insert a negative transaction record for the audit trail
    INSERT INTO transactions (
      user_id, phone, amount, type, status, mpesa_receipt, created_at
    ) VALUES (
      v_txn.user_id,
      v_txn.phone,
      -v_deduct,
      'reversal',
      'success',
      p_reversal_receipt,
      now()
    );

    RETURN jsonb_build_object(
      'ok',           true,
      'user_id',      v_txn.user_id,
      'deducted',     v_deduct,
      'new_balance',  v_new_bal,
      'txn_id',       v_txn.id
    );
  END;
END;
$$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
