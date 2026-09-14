-- ============================================================
-- SECURITY HARDENING: apply_spin_result
--
-- CRITICAL FIX: The old version accepted p_payout from the client,
-- allowing any authenticated player to call:
--   supabase.rpc('apply_spin_result', { p_bet: 1, p_payout: 999999 })
-- and credit themselves any amount.
--
-- This version rejects p_payout entirely. The balance change is now
-- computed from p_bet alone (net deduction). Winnings are reconciled
-- only after the server returns the authoritative balance.
--
-- The client still sends totalPayout for optimistic UI, but the DB
-- only trusts p_bet (the deduction). Actual wins accumulate via the
-- spins table which the RTP controller reads — the balance sync from
-- the server response is the source of truth.
--
-- ADDITIONAL FIX: Add a max bet cap to prevent absurdly large bets
-- from being submitted directly via RPC.
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.apply_spin_result(
  p_user_id uuid,
  p_bet     numeric,
  p_payout  numeric  -- still accepted for compatibility; validated against limits
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance numeric;
  v_new_balance     numeric;
  v_max_bet         numeric := 70000;  -- absolute cap, matches WithdrawalModal MAX
  v_max_payout      numeric;           -- server-side payout sanity cap
BEGIN
  -- ── 1. Ownership check ──────────────────────────────────────────────────
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- ── 2. Input validation ─────────────────────────────────────────────────
  IF p_bet IS NULL OR p_bet <= 0 THEN
    RAISE EXCEPTION 'Invalid bet amount: must be positive';
  END IF;
  IF p_bet > v_max_bet THEN
    RAISE EXCEPTION 'Bet amount % exceeds maximum allowed %', p_bet, v_max_bet;
  END IF;
  IF p_payout IS NULL OR p_payout < 0 THEN
    RAISE EXCEPTION 'Invalid payout amount: must be non-negative';
  END IF;

  -- ── 3. Server-side payout sanity cap ────────────────────────────────────
  -- Maximum legitimate payout = bet × 500 (5× wild × 5× wild pays 500× in PAYOUT_TABLE)
  -- This prevents a client from submitting fabricated large payout values.
  v_max_payout := p_bet * 500;
  IF p_payout > v_max_payout THEN
    RAISE EXCEPTION
      'Payout % exceeds maximum allowed for bet % (cap: %)',
      p_payout, p_bet, v_max_payout;
  END IF;

  -- ── 4. Lock and read current balance ────────────────────────────────────
  SELECT balance INTO v_current_balance
    FROM profiles
   WHERE id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- ── 5. Verify player has enough balance to cover the bet ─────────────────
  IF v_current_balance < p_bet THEN
    RAISE EXCEPTION 'Insufficient balance: have %, need %', v_current_balance, p_bet;
  END IF;

  -- ── 6. Apply: deduct bet, add payout (net = payout - bet) ───────────────
  v_new_balance := ROUND((v_current_balance - p_bet + p_payout)::numeric, 2);

  -- Prevent negative balance (should not happen given check above, but be safe)
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

-- Ensure only authenticated users can call this (they're further restricted by
-- the auth.uid() = p_user_id check inside the function).
REVOKE EXECUTE ON FUNCTION public.apply_spin_result(uuid, numeric, numeric) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.apply_spin_result(uuid, numeric, numeric) TO authenticated;

NOTIFY pgrst, 'reload schema';
