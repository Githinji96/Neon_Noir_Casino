-- ============================================================
-- DIAGNOSTIC SCRIPT — Run this in Supabase SQL Editor
-- to confirm the mini game setup state.
-- DO NOT commit this as a real migration.
-- ============================================================

-- 1. Check if play_mini_game function exists
SELECT
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('play_mini_game', 'initiate_mini_game', 'get_mini_game_history', 'generate_mini_game_outcome')
ORDER BY p.proname;

-- 2. Check mini_game_config table contents
SELECT
  game_id,
  enabled,
  maintenance,
  min_bet,
  max_bet,
  jsonb_array_length(prize_tiers) AS tier_count
FROM public.mini_game_config
ORDER BY game_id;

-- 3. Check grants on play_mini_game
SELECT
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'play_mini_game'
  AND routine_schema = 'public';
