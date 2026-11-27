-- ============================================================
-- Extend Admin Bet History RPCs to Include Mini Game Rounds
--
-- The existing admin_get_player_bet_summary, admin_get_player_bets,
-- and admin_get_player_bets_count RPCs only query the `spins` table.
-- This migration replaces them with versions that UNION `mini_game_rounds`
-- so all six Mini Jackpot games appear in the admin bet history.
--
-- Column mapping mini_game_rounds → spins:
--   stake   → bet
--   payout  → payout
--   game_id → game_id
--   outcome->>'label' used to derive result
--   phase = 'complete' only (exclude pending)
--
-- No existing records are modified. Purely additive.
-- ============================================================


-- Drop existing functions to allow return type changes
DROP FUNCTION IF EXISTS public.admin_get_player_bet_summary(uuid, timestamptz, timestamptz, text);
DROP FUNCTION IF EXISTS public.admin_get_player_bets(uuid, timestamptz, timestamptz, text, int, int);
DROP FUNCTION IF EXISTS public.admin_get_player_bets_count(uuid, timestamptz, timestamptz, text);

-- ── 1. admin_get_player_bet_summary ────────────────────────────────────────
--    Returns per-game aggregated GGR for a player.
--    Now unions spins + mini_game_rounds (settled only).
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
  IF public.get_my_admin_role() IS NULL THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_player_id) THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  RETURN QUERY
  SELECT
    src.game_id,
    COUNT(*)::bigint,
    COALESCE(SUM(src.bet), 0)::numeric,
    COALESCE(SUM(src.payout), 0)::numeric,
    COALESCE(SUM(src.bet) - SUM(src.payout), 0)::numeric
  FROM (
    -- Slot / jackpot / live table rounds
    SELECT
      s.game_id::text,
      s.bet::numeric   AS bet,
      s.payout::numeric AS payout,
      s.created_at
    FROM public.spins s
    WHERE s.user_id = p_player_id
      AND (p_start   IS NULL OR s.created_at >= p_start)
      AND (p_end     IS NULL OR s.created_at <= p_end)
      AND (p_game_id IS NULL OR p_game_id = '' OR s.game_id = p_game_id)

    UNION ALL

    -- Mini jackpot rounds (settled only)
    SELECT
      m.game_id::text,
      m.stake::numeric  AS bet,
      m.payout::numeric AS payout,
      m.created_at
    FROM public.mini_game_rounds m
    WHERE m.user_id = p_player_id
      AND m.phase = 'complete'
      AND (p_start   IS NULL OR m.created_at >= p_start)
      AND (p_end     IS NULL OR m.created_at <= p_end)
      AND (p_game_id IS NULL OR p_game_id = '' OR m.game_id = p_game_id)
  ) src
  GROUP BY src.game_id
  ORDER BY (SUM(src.bet) - SUM(src.payout)) DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_player_bet_summary(uuid, timestamptz, timestamptz, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_get_player_bet_summary(uuid, timestamptz, timestamptz, text) TO authenticated;


-- ── 2. admin_get_player_bets ────────────────────────────────────────────────
--    Returns paginated individual bet rows for a player.
--    Now unions spins + mini_game_rounds.
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
  result       text,
  multiplier   numeric,
  source       text   -- 'slot' or 'mini_game'
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
    src.id,
    src.created_at,
    src.game_id,
    src.bet,
    src.payout,
    (src.bet - src.payout) AS ggr,
    src.result,
    src.multiplier,
    src.source
  FROM (
    SELECT
      s.id,
      s.created_at,
      s.game_id::text,
      s.bet::numeric,
      s.payout::numeric,
      CASE
        WHEN s.payout > s.bet  THEN 'WIN'
        WHEN s.payout = s.bet  THEN 'PUSH'
        ELSE                        'LOSS'
      END AS result,
      NULL::numeric AS multiplier,
      'slot'::text  AS source
    FROM public.spins s
    WHERE s.user_id = p_player_id
      AND (p_start   IS NULL OR s.created_at >= p_start)
      AND (p_end     IS NULL OR s.created_at <= p_end)
      AND (p_game_id IS NULL OR p_game_id = '' OR s.game_id = p_game_id)

    UNION ALL

    SELECT
      m.id,
      m.created_at,
      m.game_id::text,
      m.stake::numeric   AS bet,
      m.payout::numeric,
      CASE
        WHEN m.payout > m.stake  THEN 'WIN'
        WHEN m.payout = m.stake  THEN 'PUSH'
        ELSE                          'LOSS'
      END AS result,
      COALESCE((m.outcome->>'multiplier')::numeric, 0) AS multiplier,
      'mini_game'::text AS source
    FROM public.mini_game_rounds m
    WHERE m.user_id = p_player_id
      AND m.phase = 'complete'
      AND (p_start   IS NULL OR m.created_at >= p_start)
      AND (p_end     IS NULL OR m.created_at <= p_end)
      AND (p_game_id IS NULL OR p_game_id = '' OR m.game_id = p_game_id)
  ) src
  ORDER BY src.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_player_bets(uuid, timestamptz, timestamptz, text, int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_get_player_bets(uuid, timestamptz, timestamptz, text, int, int) TO authenticated;


-- ── 3. admin_get_player_bets_count ──────────────────────────────────────────
--    Returns total count for pagination.
--    Now counts spins + mini_game_rounds.
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
  FROM (
    SELECT id FROM public.spins
    WHERE user_id = p_player_id
      AND (p_start   IS NULL OR created_at >= p_start)
      AND (p_end     IS NULL OR created_at <= p_end)
      AND (p_game_id IS NULL OR p_game_id = '' OR game_id = p_game_id)

    UNION ALL

    SELECT id FROM public.mini_game_rounds
    WHERE user_id = p_player_id
      AND phase = 'complete'
      AND (p_start   IS NULL OR created_at >= p_start)
      AND (p_end     IS NULL OR created_at <= p_end)
      AND (p_game_id IS NULL OR p_game_id = '' OR game_id = p_game_id)
  ) src;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_player_bets_count(uuid, timestamptz, timestamptz, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_get_player_bets_count(uuid, timestamptz, timestamptz, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
