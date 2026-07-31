-- Add approved_by column to transactions for admin accountability
-- Run in: Supabase Dashboard → SQL Editor

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS approved_by text;
