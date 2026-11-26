-- ============================================================
-- Fix Lucky Wheel segment count mismatch
--
-- The segment_count in game_specific_rules was inconsistent with
-- prize_tiers.length, causing the wheel arrow to land on the wrong
-- segment after a spin.
--
-- Fix: remove segment_count from game_specific_rules so the client
-- always uses prize_tiers.length as the authoritative segment count.
-- Also ensure prize_tiers exactly match what the client renders.
-- ============================================================

UPDATE public.mini_game_config
SET
  game_specific_rules = '{}'::jsonb,
  prize_tiers = '[
    {"label": "No Win", "multiplier": 0.0,  "probability": 0.30, "symbol": "💫"},
    {"label": "0.5x",   "multiplier": 0.5,  "probability": 0.25, "symbol": "⭐"},
    {"label": "1x",     "multiplier": 1.0,  "probability": 0.20, "symbol": "🌟"},
    {"label": "2x",     "multiplier": 2.0,  "probability": 0.14, "symbol": "✨"},
    {"label": "5x",     "multiplier": 5.0,  "probability": 0.07, "symbol": "💎"},
    {"label": "10x",    "multiplier": 10.0, "probability": 0.03, "symbol": "👑"},
    {"label": "25x",    "multiplier": 25.0, "probability": 0.01, "symbol": "🏆"}
  ]'::jsonb,
  updated_at = now()
WHERE game_id = 'lucky-wheel';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
