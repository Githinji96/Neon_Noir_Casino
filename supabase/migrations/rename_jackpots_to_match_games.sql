-- ============================================================
-- Rename jackpot pool names to match their linked slot games.
--
-- The frontend JACKPOT_CONFIGS was updated so name = gameTitle
-- for consistency (players see the same name everywhere).
-- This migration syncs the DB rows to match.
--
-- Before → After:
--   Electric Pulse  → Electric Storm
--   Crystal Vault   → Quantum Vault
--   Shadow Fortune  → Dark Matter Reels
--   Neon Nexus      → Neon Samurai
--   Mega Moolah Noir → Mega Moolah Noir  (unchanged)
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

UPDATE public.jackpots SET name = 'Electric Storm'    WHERE id = 'electric-pulse';
UPDATE public.jackpots SET name = 'Quantum Vault'     WHERE id = 'crystal-vault';
UPDATE public.jackpots SET name = 'Dark Matter Reels' WHERE id = 'shadow-fortune';
UPDATE public.jackpots SET name = 'Neon Samurai'      WHERE id = 'neon-nexus';
