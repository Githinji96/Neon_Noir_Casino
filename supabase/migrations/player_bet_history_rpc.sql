-- ============================================================
-- Player Bet History RPCs for Admin Panel
-- Provides admin-gated, player-scoped bet history queries.
-- Security: caller must be an admin; player ownership enforced
-- server-side — not trusting frontend-supplied user IDs.
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Per-game aggregated summary ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_player_bet_summary(
  p_player_id  uuid,
  p_start      timestamptz DEFAULT NULL,
  p_end        timestamptz DEFAULT NULL,
  p_game_id    text        DEFAULT NULL
)
RETURNS TABLE (
  game_id       text,
  spin_count    bigint,
  total_wagered numeric,
  total_wins    numeric,
  ggr           numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- ── Auth: caller must be an admin ────────────────────────────────────────
  IF public.get_my_admin_role() IS NULL THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  -- ── Verify the requested player exists ───────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_player_id) THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  RETURN QUERY
  SELECT
    s.game_id,
    COUNT(*)::bigint                                        AS spin_count,
    COALESCE(SUM(s.bet),    0)::numeric                    AS total_wagered,
    COALESCE(SUM(s.payout), 0)::numeric                    AS total_wins,
    COALESCE(SUM(s.bet) - SUM(s.payout), 0)::numeric      AS ggr
  FROM public.spins s
  WHERE s.user_id = p_player_id
    AND (p_start  IS NULL OR s.created_at >= p_start)
    AND (p_end    IS NULL OR s.created_at <= p_end)
    AND (p_game_id IS NULL OR s.game_id = p_game_id)
  GROUP BY s.game_id
  ORDER BY ggr DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_player_bet_summary(uuid, timestamptz, timestamptz, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_get_player_bet_summary(uuid, timestamptz, timestamptz, text) TO authenticated;

-- ── 2. Individual spin records (paginated) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_player_bets(
  p_player_id  uuid,
  p_start      timestamptz DEFAULT NULL,
  p_end        timestamptz DEFAULT NULL,
  p_game_id    text        DEFAULT NULL,
  p_limit      int         DEFAULT 25,
  p_offset     int         DEFAULT 0
)
RETURNS TABLE (
  id           uuid,
  created_at   timestamptz,
  game_id      text,
  bet          numeric,
  payout       numeric,
  ggr          numeric,
  result       text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF public.get_my_admin_role() IS NULL THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_player_id) THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.created_at,
    s.game_id,
    s.bet::numeric,
    s.payout::numeric,
    (s.bet - s.payout)::numeric           AS ggr,
    CASE
      WHEN s.payout > s.bet  THEN 'WIN'
      WHEN s.payout = s.bet  THEN 'PUSH'
      ELSE                        'LOSS'
    END                                   AS result
  FROM public.spins s
  WHERE s.user_id = p_player_id
    AND (p_start   IS NULL OR s.created_at >= p_start)
    AND (p_end     IS NULL OR s.created_at <= p_end)
    AND (p_game_id IS NULL OR s.game_id    = p_game_id)
  ORDER BY s.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_player_bets(uuid, timestamptz, timestamptz, text, int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_get_player_bets(uuid, timestamptz, timestamptz, text, int, int) TO authenticated;

-- ── 3. Total count for pagination ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_player_bets_count(
  p_player_id  uuid,
  p_start      timestamptz DEFAULT NULL,
  p_end        timestamptz DEFAULT NULL,
  p_game_id    text        DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE v_count bigint;
BEGIN
  IF public.get_my_admin_role() IS NULL THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.spins
  WHERE user_id = p_player_id
    AND (p_start   IS NULL OR created_at >= p_start)
    AND (p_end     IS NULL OR created_at <= p_end)
    AND (p_game_id IS NULL OR game_id    = p_game_id);

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_player_bets_count(uuid, timestamptz, timestamptz, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_get_player_bets_count(uuid, timestamptz, timestamptz, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
