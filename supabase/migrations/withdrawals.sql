-- Add withdrawal support to transactions table

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'deposit',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Index for fast withdrawal queries
CREATE INDEX IF NOT EXISTS transactions_type_idx ON public.transactions(type);
CREATE INDEX IF NOT EXISTS transactions_user_status_idx ON public.transactions(user_id, status);
