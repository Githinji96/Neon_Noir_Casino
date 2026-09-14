-- ============================================================
-- Fix: Cyber Strike 777 — remove fixed KES 100 bet constraint
-- It is now a normal slot game (min KES 1, max KES 10,000).
-- Mega Moolah Noir is the mega jackpot with fixed KES 100 bet.
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Upsert cyber-strike-777 as a normal slot
INSERT INTO public.admin_game_config (game_id, enabled, min_bet, max_bet, volatility)
VALUES ('cyber-strike-777', true, 1, 10000, 'high')
ON CONFLICT (game_id) DO UPDATE
  SET min_bet    = 1,
      max_bet    = 10000,
      updated_at = now();

-- Ensure mega-moolah-noir keeps fixed KES 100 bet
INSERT INTO public.admin_game_config (game_id, enabled, min_bet, max_bet, volatility)
VALUES ('mega-moolah-noir', true, 100, 100, 'high')
ON CONFLICT (game_id) DO UPDATE
  SET min_bet    = 100,
      max_bet    = 100,
      updated_at = now();

-- Verify
SELECT game_id, min_bet, max_bet, enabled
FROM public.admin_game_config
WHERE game_id IN ('cyber-strike-777', 'mega-moolah-noir')
ORDER BY game_id;

NOTIFY pgrst, 'reload schema';
