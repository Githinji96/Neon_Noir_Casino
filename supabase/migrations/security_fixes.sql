-- ============================================================
-- Security Fixes
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Admin-reset RPCs: add DB-level role check ─────────────────────────────
-- Any authenticated user could previously call these via supabase.rpc()
-- regardless of their admin_role. These are now enforced at the DB level.

CREATE OR REPLACE FUNCTION public.admin_reset_player_wins(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_my_admin_role() NOT IN ('super_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin role required';
  END IF;
  UPDATE player_stats
  SET total_wins = 0, total_win_amount = 0, biggest_win = 0, updated_at = now()
  WHERE user_id = target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_player_bets(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_my_admin_role() NOT IN ('super_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin role required';
  END IF;
  UPDATE player_stats
  SET total_bets = 0, total_bet_amount = 0,
      daily_bet_amount = 0, weekly_bet_amount = 0, monthly_bet_amount = 0,
      current_session_bets = 0, current_session_bet_amount = 0,
      updated_at = now()
  WHERE user_id = target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_player_stats(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_my_admin_role() NOT IN ('super_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin role required';
  END IF;
  UPDATE player_stats
  SET total_bets = 0, total_bet_amount = 0, total_wins = 0,
      total_win_amount = 0, biggest_win = 0,
      daily_bet_amount = 0, weekly_bet_amount = 0, monthly_bet_amount = 0,
      current_session_bets = 0, current_session_bet_amount = 0,
      updated_at = now()
  WHERE user_id = target_user_id;
END;
$$;

-- ── 2. Restrict balance updates — users cannot set arbitrary balance values ───
-- Add a BEFORE UPDATE trigger on profiles that rejects any balance
-- increase originating from the authenticated role (only service_role
-- or SECURITY DEFINER functions may increase balances).

CREATE OR REPLACE FUNCTION public.guard_balance_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role and SECURITY DEFINER functions are exempt
  IF current_setting('role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Authenticated users may ONLY decrease their own balance (withdrawal deduction)
  -- They must NOT be able to increase it from the client side
  IF NEW.balance > OLD.balance THEN
    RAISE EXCEPTION 'Balance increases must be performed by the server';
  END IF;

  -- Ensure they cannot set a negative balance
  IF NEW.balance < 0 THEN
    NEW.balance := 0;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_balance ON public.profiles;
CREATE TRIGGER trg_guard_balance
  BEFORE UPDATE OF balance ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_balance_update();

-- ── 3. Tighten support_tickets INSERT — require authentication ────────────────
DROP POLICY IF EXISTS "Anyone can submit ticket" ON public.support_tickets;

CREATE POLICY "Authenticated users submit tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Also restrict replies to authenticated users only
DROP POLICY IF EXISTS "Anyone can add reply" ON public.support_ticket_replies;

CREATE POLICY "Authenticated users add replies"
  ON public.support_ticket_replies FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ── 4. Reload schema ──────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
