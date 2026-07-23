-- ============================================================
-- player_stats table + admin reset functions
-- ============================================================

-- 1. Create player_stats table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.player_stats (
  user_id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_wins               numeric        NOT NULL DEFAULT 0,
  lifetime_wins            numeric        NOT NULL DEFAULT 0,
  current_session_wins     numeric        NOT NULL DEFAULT 0,
  daily_wins               numeric        NOT NULL DEFAULT 0,
  weekly_wins              numeric        NOT NULL DEFAULT 0,
  monthly_wins             numeric        NOT NULL DEFAULT 0,
  total_bets               integer        NOT NULL DEFAULT 0,
  total_bet_amount         numeric        NOT NULL DEFAULT 0,
  daily_bet_amount         numeric        NOT NULL DEFAULT 0,
  weekly_bet_amount        numeric        NOT NULL DEFAULT 0,
  monthly_bet_amount       numeric        NOT NULL DEFAULT 0,
  current_session_bets     integer        NOT NULL DEFAULT 0,
  current_session_bet_amount numeric      NOT NULL DEFAULT 0,
  updated_at               timestamptz    NOT NULL DEFAULT now()
);

-- 2. Enable RLS — players can only read/write their own row
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "player_stats_owner" ON public.player_stats;
CREATE POLICY "player_stats_owner"
  ON public.player_stats FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Helpful indexes
CREATE INDEX IF NOT EXISTS player_stats_user_id_idx ON public.player_stats(user_id);

-- ============================================================
-- SECURITY DEFINER functions — run as DB owner, bypass RLS.
-- The frontend is responsible for verifying the caller is a
-- super_admin before invoking these via supabase.rpc().
-- ============================================================

-- Reset win statistics for a player (wins + clears leaderboard rows)
CREATE OR REPLACE FUNCTION public.admin_reset_player_wins(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete all leaderboard entries for this user (bypasses RLS)
  DELETE FROM public.leaderboard WHERE user_id = target_user_id;

  -- Upsert: create the row if it doesn't exist, otherwise zero the win fields
  INSERT INTO public.player_stats (
    user_id,
    total_wins, lifetime_wins, current_session_wins,
    daily_wins, weekly_wins, monthly_wins
  )
  VALUES (target_user_id, 0, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET total_wins            = 0,
        lifetime_wins         = 0,
        current_session_wins  = 0,
        daily_wins            = 0,
        weekly_wins           = 0,
        monthly_wins          = 0,
        updated_at            = now();
END;
$$;

-- Reset bet statistics for a player
CREATE OR REPLACE FUNCTION public.admin_reset_player_bets(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.player_stats (
    user_id,
    total_bets, total_bet_amount,
    daily_bet_amount, weekly_bet_amount, monthly_bet_amount,
    current_session_bets, current_session_bet_amount
  )
  VALUES (target_user_id, 0, 0, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET total_bets                  = 0,
        total_bet_amount            = 0,
        daily_bet_amount            = 0,
        weekly_bet_amount           = 0,
        monthly_bet_amount          = 0,
        current_session_bets        = 0,
        current_session_bet_amount  = 0,
        updated_at                  = now();
END;
$$;

-- Reset ALL statistics for a player (wins + bets + clears leaderboard)
CREATE OR REPLACE FUNCTION public.admin_reset_player_stats(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete all leaderboard entries (bypasses RLS)
  DELETE FROM public.leaderboard WHERE user_id = target_user_id;

  INSERT INTO public.player_stats (user_id)
  VALUES (target_user_id)
  ON CONFLICT (user_id) DO UPDATE
    SET total_wins                  = 0,
        lifetime_wins               = 0,
        current_session_wins        = 0,
        daily_wins                  = 0,
        weekly_wins                 = 0,
        monthly_wins                = 0,
        total_bets                  = 0,
        total_bet_amount            = 0,
        daily_bet_amount            = 0,
        weekly_bet_amount           = 0,
        monthly_bet_amount          = 0,
        current_session_bets        = 0,
        current_session_bet_amount  = 0,
        updated_at                  = now();
END;
$$;

-- Revoke public execute, grant only to authenticated users
-- (The frontend still gate-keeps who can call these via admin_role check)
REVOKE EXECUTE ON FUNCTION public.admin_reset_player_wins(uuid)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_reset_player_bets(uuid)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_reset_player_stats(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_reset_player_wins(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_player_bets(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_player_stats(uuid) TO authenticated;
