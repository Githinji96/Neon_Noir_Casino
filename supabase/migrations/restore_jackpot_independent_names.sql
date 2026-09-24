-- ============================================================
-- Restore jackpot pool names to their own independent names,
-- distinct from the slot game titles they are linked to.
--
-- Jackpots and the slot games they unlock are separate concepts:
--   - The jackpot NAME is shown on the jackpot cards / admin panel
--   - The gameTitle is the underlying slot game navigated to on SPIN NOW
--
-- Before → After:
--   Electric Storm    → Electric Pulse   (id: electric-pulse)
--   Quantum Vault     → Crystal Vault    (id: crystal-vault)
--   Dark Matter Reels → Shadow Fortune   (id: shadow-fortune)
--   Neon Samurai      → Neon Nexus       (id: neon-nexus)
--   Mega Moolah Noir  → Mega Moolah Noir (unchanged)
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

UPDATE public.jackpots SET name = 'Electric Pulse'  WHERE id = 'electric-pulse';
UPDATE public.jackpots SET name = 'Crystal Vault'   WHERE id = 'crystal-vault';
UPDATE public.jackpots SET name = 'Shadow Fortune'  WHERE id = 'shadow-fortune';
UPDATE public.jackpots SET name = 'Neon Nexus'      WHERE id = 'neon-nexus';
