-- ============================================================
-- Spin Balance Update RPC
-- Atomically applies the net result of a slot spin (bet - payout)
-- to the player's balance. Runs as SECURITY DEFINER so it bypasses
-- the guard_balance_update trigger which blocks client-side increases.
--
-- Security: validates caller owns the row (auth.uid() = p_user_id).
-- The bet/payout values come from the game engine — we don't re-validate
-- them here but the RLS on `spins` INSERT ensures the spin record is
-- also owned by the same user.
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.apply_spin_result(
  p_user_id uuid,
  p_bet     numeric,
  p_payout  numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance numeric;
  v_new_balance     numeric;
BEGIN
  -- Caller must be the player themselves
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Validate amounts
  IF p_bet IS NULL OR p_bet <= 0 THEN
    RAISE EXCEPTION 'Invalid bet amount';
  END IF;
  IF p_payout IS NULL OR p_payout < 0 THEN
    RAISE EXCEPTION 'Invalid payout amount';
  END IF;

  -- Lock and read current balance
  SELECT balance INTO v_current_balance
    FROM profiles
   WHERE id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Apply: deduct bet then add payout (net = payout - bet)
  v_new_balance := ROUND((v_current_balance - p_bet + p_payout)::numeric, 2);

  -- Prevent going negative
  IF v_new_balance < 0 THEN
    v_new_balance := 0;
  END IF;

  UPDATE profiles
     SET balance    = v_new_balance,
         updated_at = now()
   WHERE id = p_user_id;

  RETURN jsonb_build_object('balance', v_new_balance);
END;
$$;

-- Grant to authenticated users (they can only call it for themselves due to auth.uid() check)
GRANT EXECUTE ON FUNCTION public.apply_spin_result(uuid, numeric, numeric) TO authenticated;

NOTIFY pgrst, 'reload schema';
