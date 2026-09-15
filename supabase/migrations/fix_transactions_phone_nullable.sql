-- ============================================================
-- Fix: make transactions.phone nullable
-- Admin credits/debits are not M-Pesa transactions and have
-- no associated phone number. The NOT NULL constraint was
-- incorrectly blocking admin_credit_player and admin_debit_player.
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE public.transactions
  ALTER COLUMN phone DROP NOT NULL;

-- Also update the existing RPCs to include phone = NULL explicitly
-- (already implicit after the ALTER, but explicit is clearer)

CREATE OR REPLACE FUNCTION public.admin_credit_player(
  p_player_id  uuid,
  p_amount     numeric,
  p_reason     text,
  p_admin_id   uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_balance   numeric;
  v_casino_balance   numeric;
  v_new_player_bal   numeric;
  v_new_casino_bal   numeric;
  v_admin_role       text;
BEGIN
  v_admin_role := public.get_my_admin_role();
  IF v_admin_role NOT IN ('super_admin', 'finance_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin or finance_admin role required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  SELECT balance INTO v_player_balance
    FROM public.profiles
   WHERE id = p_player_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  SELECT balance INTO v_casino_balance
    FROM public.casino_account
   WHERE id = 1
     FOR UPDATE;

  v_new_player_bal := ROUND((v_player_balance + p_amount)::numeric, 2);
  v_new_casino_bal := ROUND((v_casino_balance - p_amount)::numeric, 2);

  UPDATE public.profiles
     SET balance    = v_new_player_bal,
         updated_at = now()
   WHERE id = p_player_id;

  UPDATE public.casino_account
     SET balance    = v_new_casino_bal,
         updated_at = now()
   WHERE id = 1;

  INSERT INTO public.transactions (
    user_id, amount, type, status, phone, approved_by, approved_at
  ) VALUES (
    p_player_id,
    p_amount,
    'admin_credit',
    'success',
    NULL,   -- no M-Pesa phone for admin adjustments
    COALESCE((SELECT username FROM public.profiles WHERE id = p_admin_id), 'admin'),
    now()
  );

  RETURN jsonb_build_object(
    'success',        true,
    'player_balance', v_new_player_bal,
    'casino_balance', v_new_casino_bal
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_debit_player(
  p_player_id  uuid,
  p_amount     numeric,
  p_reason     text,
  p_admin_id   uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_balance   numeric;
  v_casino_balance   numeric;
  v_new_player_bal   numeric;
  v_new_casino_bal   numeric;
  v_admin_role       text;
BEGIN
  v_admin_role := public.get_my_admin_role();
  IF v_admin_role NOT IN ('super_admin', 'finance_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin or finance_admin role required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  SELECT balance INTO v_player_balance
    FROM public.profiles
   WHERE id = p_player_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  IF v_player_balance < p_amount THEN
    RAISE EXCEPTION 'Debit amount exceeds player balance';
  END IF;

  SELECT balance INTO v_casino_balance
    FROM public.casino_account
   WHERE id = 1
     FOR UPDATE;

  v_new_player_bal := ROUND((v_player_balance - p_amount)::numeric, 2);
  v_new_casino_bal := ROUND((v_casino_balance + p_amount)::numeric, 2);

  UPDATE public.profiles
     SET balance    = v_new_player_bal,
         updated_at = now()
   WHERE id = p_player_id;

  UPDATE public.casino_account
     SET balance    = v_new_casino_bal,
         updated_at = now()
   WHERE id = 1;

  INSERT INTO public.transactions (
    user_id, amount, type, status, phone, approved_by, approved_at
  ) VALUES (
    p_player_id,
    p_amount,
    'admin_debit',
    'success',
    NULL,   -- no M-Pesa phone for admin adjustments
    COALESCE((SELECT username FROM public.profiles WHERE id = p_admin_id), 'admin'),
    now()
  );

  RETURN jsonb_build_object(
    'success',        true,
    'player_balance', v_new_player_bal,
    'casino_balance', v_new_casino_bal
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
