-- ============================================================
-- Enable Mini Jackpot Games with default prize tiers
--
-- The initial seed in create_mini_game_config.sql inserted all
-- games with enabled = false and empty prize_tiers = [].
--
-- This migration enables all six games and seeds sensible
-- default prize tiers that sum to exactly 1.0000 probability.
--
-- Safe to re-run: uses ON CONFLICT (game_id) DO UPDATE.
-- ============================================================

-- ── lucky-wheel ───────────────────────────────────────────────────────────────
INSERT INTO public.mini_game_config
  (game_id, enabled, min_bet, max_bet, prize_tiers, outcome_probabilities, maintenance, game_specific_rules, updated_at)
VALUES (
  'lucky-wheel',
  true,
  10.00,
  1000.00,
  '[
    {"label": "0.5x",  "multiplier": 0.5,  "probability": 0.35, "symbol": "💫"},
    {"label": "1x",    "multiplier": 1.0,  "probability": 0.30, "symbol": "⭐"},
    {"label": "2x",    "multiplier": 2.0,  "probability": 0.20, "symbol": "🌟"},
    {"label": "5x",    "multiplier": 5.0,  "probability": 0.10, "symbol": "✨"},
    {"label": "10x",   "multiplier": 10.0, "probability": 0.04, "symbol": "💎"},
    {"label": "25x",   "multiplier": 25.0, "probability": 0.01, "symbol": "👑"}
  ]'::jsonb,
  '{}'::jsonb,
  false,
  '{"segment_count": 6}'::jsonb,
  now()
)
ON CONFLICT (game_id) DO UPDATE SET
  enabled             = true,
  min_bet             = 10.00,
  max_bet             = 1000.00,
  prize_tiers         = EXCLUDED.prize_tiers,
  game_specific_rules = EXCLUDED.game_specific_rules,
  updated_at          = now();

-- ── scratch-cards ─────────────────────────────────────────────────────────────
INSERT INTO public.mini_game_config
  (game_id, enabled, min_bet, max_bet, prize_tiers, outcome_probabilities, maintenance, game_specific_rules, updated_at)
VALUES (
  'scratch-cards',
  true,
  10.00,
  500.00,
  '[
    {"label": "No Prize", "multiplier": 0.0, "probability": 0.50, "symbol": "💔"},
    {"label": "0.5x",     "multiplier": 0.5, "probability": 0.25, "symbol": "🎴"},
    {"label": "2x",       "multiplier": 2.0, "probability": 0.15, "symbol": "🎰"},
    {"label": "5x",       "multiplier": 5.0, "probability": 0.08, "symbol": "💰"},
    {"label": "10x",      "multiplier": 10.0,"probability": 0.02, "symbol": "💎"}
  ]'::jsonb,
  '{}'::jsonb,
  false,
  '{"card_design": 0}'::jsonb,
  now()
)
ON CONFLICT (game_id) DO UPDATE SET
  enabled             = true,
  min_bet             = 10.00,
  max_bet             = 500.00,
  prize_tiers         = EXCLUDED.prize_tiers,
  game_specific_rules = EXCLUDED.game_specific_rules,
  updated_at          = now();

-- ── treasure-chest ────────────────────────────────────────────────────────────
INSERT INTO public.mini_game_config
  (game_id, enabled, min_bet, max_bet, prize_tiers, outcome_probabilities, maintenance, game_specific_rules, updated_at)
VALUES (
  'treasure-chest',
  true,
  10.00,
  1000.00,
  '[
    {"label": "Empty", "multiplier": 0.0,  "probability": 0.60, "symbol": "📦"},
    {"label": "1x",    "multiplier": 1.0,  "probability": 0.20, "symbol": "💰"},
    {"label": "3x",    "multiplier": 3.0,  "probability": 0.12, "symbol": "💎"},
    {"label": "10x",   "multiplier": 10.0, "probability": 0.08, "symbol": "👑"}
  ]'::jsonb,
  '{}'::jsonb,
  false,
  '{"chest_count": 3}'::jsonb,
  now()
)
ON CONFLICT (game_id) DO UPDATE SET
  enabled             = true,
  min_bet             = 10.00,
  max_bet             = 1000.00,
  prize_tiers         = EXCLUDED.prize_tiers,
  game_specific_rules = EXCLUDED.game_specific_rules,
  updated_at          = now();

-- ── mini-slot ─────────────────────────────────────────────────────────────────
INSERT INTO public.mini_game_config
  (game_id, enabled, min_bet, max_bet, prize_tiers, outcome_probabilities, maintenance, game_specific_rules, updated_at)
VALUES (
  'mini-slot',
  true,
  10.00,
  1000.00,
  '[
    {"label": "No Win",          "multiplier": 0.0,  "probability": 0.55},
    {"label": "Pair",            "multiplier": 1.5,  "probability": 0.25},
    {"label": "Two Pair",        "multiplier": 3.0,  "probability": 0.12},
    {"label": "Three of a Kind", "multiplier": 10.0, "probability": 0.07},
    {"label": "Jackpot",         "multiplier": 50.0, "probability": 0.01}
  ]'::jsonb,
  '{}'::jsonb,
  false,
  '{"reel_symbols": ["🍒","🍋","🍊","🔔","⭐","💎"], "wild_enabled": false, "bonus_enabled": false}'::jsonb,
  now()
)
ON CONFLICT (game_id) DO UPDATE SET
  enabled             = true,
  min_bet             = 10.00,
  max_bet             = 1000.00,
  prize_tiers         = EXCLUDED.prize_tiers,
  game_specific_rules = EXCLUDED.game_specific_rules,
  updated_at          = now();

-- ── mystery-multiplier ────────────────────────────────────────────────────────
INSERT INTO public.mini_game_config
  (game_id, enabled, min_bet, max_bet, prize_tiers, outcome_probabilities, maintenance, game_specific_rules, updated_at)
VALUES (
  'mystery-multiplier',
  true,
  10.00,
  1000.00,
  '[
    {"label": "0.5x",  "multiplier": 0.5,  "probability": 0.35},
    {"label": "1x",    "multiplier": 1.0,  "probability": 0.30},
    {"label": "2x",    "multiplier": 2.0,  "probability": 0.20},
    {"label": "5x",    "multiplier": 5.0,  "probability": 0.10},
    {"label": "10x",   "multiplier": 10.0, "probability": 0.04},
    {"label": "20x",   "multiplier": 20.0, "probability": 0.01}
  ]'::jsonb,
  '{}'::jsonb,
  false,
  '{}'::jsonb,
  now()
)
ON CONFLICT (game_id) DO UPDATE SET
  enabled             = true,
  min_bet             = 10.00,
  max_bet             = 1000.00,
  prize_tiers         = EXCLUDED.prize_tiers,
  game_specific_rules = EXCLUDED.game_specific_rules,
  updated_at          = now();

-- ── crystal-match ─────────────────────────────────────────────────────────────
INSERT INTO public.mini_game_config
  (game_id, enabled, min_bet, max_bet, prize_tiers, outcome_probabilities, maintenance, game_specific_rules, updated_at)
VALUES (
  'crystal-match',
  true,
  10.00,
  1000.00,
  '[
    {"label": "No Match", "multiplier": 0.0,  "probability": 0.50, "symbol": "🔮"},
    {"label": "Bronze",   "multiplier": 1.5,  "probability": 0.25, "symbol": "🟤"},
    {"label": "Silver",   "multiplier": 3.0,  "probability": 0.15, "symbol": "⚪"},
    {"label": "Gold",     "multiplier": 8.0,  "probability": 0.08, "symbol": "🟡"},
    {"label": "Diamond",  "multiplier": 25.0, "probability": 0.02, "symbol": "💎"}
  ]'::jsonb,
  '{}'::jsonb,
  false,
  '{"grid_size": [3, 3], "min_match_count": 3}'::jsonb,
  now()
)
ON CONFLICT (game_id) DO UPDATE SET
  enabled             = true,
  min_bet             = 10.00,
  max_bet             = 1000.00,
  prize_tiers         = EXCLUDED.prize_tiers,
  game_specific_rules = EXCLUDED.game_specific_rules,
  updated_at          = now();

-- ── Reload PostgREST schema cache ─────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
