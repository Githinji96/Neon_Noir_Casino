-- ============================================================
-- Extend get_ggr_summary to include Mini Jackpot Game rounds.
--
-- Previously this function only queried the `spins` table.
-- Mini game rounds are stored in `mini_game_rounds` with:
--   stake  → equivalent of `bet`
--   payout → equivalent of `payout`
--   phase = 'complete' → settled rounds only
--
-- The updated function UNIONs both tables so the admin dashboard
-- GGR, total bets, total payouts, and spin counts all reflect
-- actual casino-wide activity.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_ggr_summary(
  today_start timestamptz,
  week_start  timestamptz,
  month_start timestamptz
)
RETURNS TABLE (
  ggr_today           numeric,
  ggr_week            numeric,
  ggr_month           numeric,
  total_bets_month    numeric,
  total_payouts_month numeric,
  spins_today         bigint,
  spins_month         bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Admin role check
  IF public.get_my_admin_role() IS NULL THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    -- GGR Today (bets - payouts for today, both spins and mini games)
    COALESCE(SUM(CASE WHEN src.created_at >= today_start THEN src.bet - src.payout ELSE 0 END), 0)::numeric,
    -- GGR This Week
    COALESCE(SUM(CASE WHEN src.created_at >= week_start  THEN src.bet - src.payout ELSE 0 END), 0)::numeric,
    -- GGR Last 30 Days
    COALESCE(SUM(CASE WHEN src.created_at >= month_start THEN src.bet - src.payout ELSE 0 END), 0)::numeric,
    -- Total bets last 30 days
    COALESCE(SUM(CASE WHEN src.created_at >= month_start THEN src.bet ELSE 0 END), 0)::numeric,
    -- Total payouts last 30 days
    COALESCE(SUM(CASE WHEN src.created_at >= month_start THEN src.payout ELSE 0 END), 0)::numeric,
    -- Spins today (count of rounds today)
    COUNT(CASE WHEN src.created_at >= today_start THEN 1 END)::bigint,
    -- Spins last 30 days
    COUNT(CASE WHEN src.created_at >= month_start THEN 1 END)::bigint
  FROM (
    -- Slot / jackpot / live table rounds
    SELECT
      bet::numeric    AS bet,
      payout::numeric AS payout,
      created_at
    FROM public.spins

    UNION ALL

    -- Mini jackpot game rounds (settled only)
    SELECT
      stake::numeric  AS bet,
      payout::numeric AS payout,
      created_at
    FROM public.mini_game_rounds
    WHERE phase = 'complete'
  ) src;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_ggr_summary(timestamptz, timestamptz, timestamptz) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_ggr_summary(timestamptz, timestamptz, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
