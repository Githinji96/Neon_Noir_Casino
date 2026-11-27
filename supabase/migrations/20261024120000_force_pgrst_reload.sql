-- Force PostgREST schema cache reload
-- This migration exists solely to trigger a cache refresh.
-- The play_mini_game function was created in 20261024104702 but
-- PostgREST did not pick up the NOTIFY. This re-issues the NOTIFY.

-- Re-grant to ensure visibility
GRANT EXECUTE ON FUNCTION public.play_mini_game(text, uuid, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.initiate_mini_game(text, uuid, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mini_game_result(uuid, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mini_game_history(text, int, uuid) TO authenticated;

-- Force reload
NOTIFY pgrst, 'reload schema';
