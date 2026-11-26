-- ============================================================
-- Raise jackpot current_amount values to meet minimumThreshold
--
-- The client-side engine requires current_amount >= minimumThreshold
-- before a jackpot can enter ACTIVE state and trigger.
--
-- Thresholds are defined in jackpotConfig.ts GAMEPLAY_DEFAULTS:
--   mega-moolah-noir  → 5 000 000
--   electric-pulse    → 500 000      (already met: 1 253 671)
--   crystal-vault     → 2 000 000    (locked in DB anyway)
--   shadow-fortune    → 1 000 000
--   neon-nexus        → 200 000      (already met: 253 709)
--
-- Only rows where current_amount < threshold are updated.
-- The existing jackpot_floor_trigger (base_amount floor) still applies.
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

UPDATE public.jackpots
SET current_amount = CASE id
  WHEN 'mega-moolah-noir' THEN GREATEST(current_amount, 5000000.00)
  WHEN 'electric-pulse'   THEN GREATEST(current_amount,  500000.00)
  WHEN 'crystal-vault'    THEN GREATEST(current_amount, 2000000.00)
  WHEN 'shadow-fortune'   THEN GREATEST(current_amount, 1000000.00)
  WHEN 'neon-nexus'       THEN GREATEST(current_amount,  200000.00)
  ELSE current_amount
END
WHERE id IN ('mega-moolah-noir', 'electric-pulse', 'crystal-vault', 'shadow-fortune', 'neon-nexus');

-- Verify — all non-locked jackpots should now show current_amount >= threshold
SELECT
  id,
  name,
  locked,
  base_amount,
  current_amount,
  CASE id
    WHEN 'mega-moolah-noir' THEN 5000000
    WHEN 'electric-pulse'   THEN  500000
    WHEN 'crystal-vault'    THEN 2000000
    WHEN 'shadow-fortune'   THEN 1000000
    WHEN 'neon-nexus'       THEN  200000
    ELSE 0
  END                                                        AS min_threshold,
  CASE
    WHEN locked THEN 'LOCKED (ok)'
    WHEN current_amount >= CASE id
      WHEN 'mega-moolah-noir' THEN 5000000
      WHEN 'electric-pulse'   THEN  500000
      WHEN 'crystal-vault'    THEN 2000000
      WHEN 'shadow-fortune'   THEN 1000000
      WHEN 'neon-nexus'       THEN  200000
      ELSE 0
    END THEN 'ACTIVE ✓'
    ELSE 'STILL BUILDING ✗'
  END AS expected_state
FROM public.jackpots
ORDER BY id;
