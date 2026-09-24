-- ============================================================
-- Fix jackpots where current_amount has fallen below base_amount.
--
-- This happens when an admin raises base_amount but the pool
-- hasn't been reset yet, or when the engine was seeded from the
-- old hardcoded seedAmount before syncFromSupabase ran.
--
-- Rule: current_amount must never be less than base_amount.
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

UPDATE public.jackpots
   SET current_amount = base_amount
 WHERE current_amount < base_amount;

-- Verify
SELECT id, name, base_amount, current_amount,
       CASE WHEN current_amount >= base_amount THEN 'ok' ELSE 'STILL BROKEN' END AS status
  FROM public.jackpots
 ORDER BY id;
