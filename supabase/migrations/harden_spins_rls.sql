-- ============================================================
-- SECURITY: Harden spins table RLS
--
-- Problem: RLS only checks auth.uid() = user_id on INSERT.
-- A player can call:
--   supabase.from('spins').insert({ user_id, game_id, bet: 1, payout: 999999 })
-- and log fabricated wins that corrupt GGR reporting.
--
-- Fix: Block direct client INSERTs entirely. Spins must be inserted
-- via the SECURITY DEFINER apply_spin_result RPC or the service role.
-- This is consistent with the slot machine flow where gameStore already
-- inserts spins inside the apply_spin_result async block.
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users insert own spins" ON public.spins;

-- Spins can only be inserted by:
-- a) The service role (Edge Functions, server operations)
-- b) The apply_spin_result SECURITY DEFINER function (current_user <> session_user)
--
-- Regular authenticated clients are blocked from direct INSERT.
CREATE POLICY "Server only inserts spins"
  ON public.spins FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR current_user <> session_user   -- inside a SECURITY DEFINER function
  );

-- Also add a CHECK constraint on payout to reject absurd values at the DB level
-- (belt-and-suspenders alongside the RPC validation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'spins_payout_sanity'
  ) THEN
    ALTER TABLE public.spins
      ADD CONSTRAINT spins_payout_sanity
      CHECK (payout >= 0 AND payout <= bet * 600);  -- 600× max multiplier
  END IF;
END $$;

-- Add a bet sanity constraint too
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'spins_bet_positive'
  ) THEN
    ALTER TABLE public.spins
      ADD CONSTRAINT spins_bet_positive
      CHECK (bet > 0 AND bet <= 70000);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
