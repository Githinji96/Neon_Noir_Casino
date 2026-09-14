-- ============================================================
-- SECURITY: Callback idempotency and duplicate-credit guard
--
-- The mpesa-callback edge function already has an idempotency guard
-- (.eq('status', 'pending')) but we add a unique constraint on
-- mpesa_receipt to prevent double-credits at the DB level.
--
-- Also adds a unique constraint on checkout_request_id to prevent
-- two transactions from being created for the same STK push.
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Unique constraint: one successful credit per M-Pesa receipt
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'transactions'
      AND constraint_name = 'transactions_mpesa_receipt_unique'
  ) THEN
    -- Only enforce uniqueness on non-null receipts (nulls are allowed for pending)
    CREATE UNIQUE INDEX transactions_mpesa_receipt_unique
      ON public.transactions (mpesa_receipt)
      WHERE mpesa_receipt IS NOT NULL;
  END IF;
END $$;

-- Unique constraint: one transaction per STK push checkout request
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'transactions'
      AND constraint_name = 'transactions_checkout_request_unique'
  ) THEN
    CREATE UNIQUE INDEX transactions_checkout_request_unique
      ON public.transactions (checkout_request_id)
      WHERE checkout_request_id IS NOT NULL;
  END IF;
END $$;

-- Add non-negative amount constraint to transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'transactions_amount_positive'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_amount_positive
      CHECK (amount > 0);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
