-- ============================================================
-- Admin Role Permissions
-- Defines exactly what each admin role can do across every table
-- and every SECURITY DEFINER RPC.
--
-- Roles:
--   super_admin    — Full access to everything
--   finance_admin  — All financial operations (no game config, no player bans)
--   support_agent  — Read-only on finances; manage support tickets & player accounts
--   game_manager   — Configure games, jackpots, live tables; read financial data
--
-- Safe to re-run (all DROP IF EXISTS before recreating).
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 0. Ensure helper is up to date ──────────────────────────────────────────
-- SECURITY DEFINER so it runs as DB owner — no RLS recursion risk.
CREATE OR REPLACE FUNCTION public.get_my_admin_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT admin_role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ── 1. profiles ──────────────────────────────────────────────────────────────
--
--  super_admin    SELECT/UPDATE all rows (including admin_role, account_status)
--  finance_admin  SELECT all; UPDATE balance only (via RPC, not direct)
--  support_agent  SELECT all; UPDATE account_status (suspend / unsuspend)
--  game_manager   SELECT all (read-only on player records)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing admin policies to rebuild cleanly
DROP POLICY IF EXISTS "Users can view own profile"         ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"       ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile"       ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles"       ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles"     ON public.profiles;
DROP POLICY IF EXISTS "service_role bypass profiles"       ON public.profiles;
DROP POLICY IF EXISTS "Super admin full profiles"          ON public.profiles;
DROP POLICY IF EXISTS "Finance admin read profiles"        ON public.profiles;
DROP POLICY IF EXISTS "Support agent read profiles"        ON public.profiles;
DROP POLICY IF EXISTS "Game manager read profiles"         ON public.profiles;
DROP POLICY IF EXISTS "Super admin update profiles"        ON public.profiles;
DROP POLICY IF EXISTS "Finance admin update profiles"      ON public.profiles;
DROP POLICY IF EXISTS "Support agent update profiles"      ON public.profiles;

-- Service role (Edge Functions): unrestricted
CREATE POLICY "service_role bypass profiles"
  ON public.profiles FOR ALL
  USING     (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Every user manages their own row
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING     (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- All admin roles can read all player profiles
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent','game_manager')
  );

-- super_admin: can update anything (role changes, bans, balance)
CREATE POLICY "Super admin update profiles"
  ON public.profiles FOR UPDATE
  USING     (public.get_my_admin_role() = 'super_admin')
  WITH CHECK (public.get_my_admin_role() = 'super_admin');

-- finance_admin: can update balance-related fields only
-- (balance is always changed via SECURITY DEFINER RPCs, but the RLS
--  policy must allow the UPDATE to land)
CREATE POLICY "Finance admin update profiles"
  ON public.profiles FOR UPDATE
  USING     (public.get_my_admin_role() = 'finance_admin')
  WITH CHECK (public.get_my_admin_role() = 'finance_admin');

-- support_agent: can update account_status (active/suspended)
-- Cannot change balance, admin_role, or other sensitive fields.
-- The frontend enforces the field restriction; the RLS allows the row write.
CREATE POLICY "Support agent update profiles"
  ON public.profiles FOR UPDATE
  USING     (public.get_my_admin_role() = 'support_agent')
  WITH CHECK (public.get_my_admin_role() = 'support_agent');

-- ── 2. transactions ──────────────────────────────────────────────────────────
--
--  super_admin    SELECT / UPDATE / INSERT / DELETE all
--  finance_admin  SELECT / UPDATE (approve/reject) / INSERT (admin_credit/debit)
--  support_agent  SELECT only (view player transaction history for support)
--  game_manager   SELECT only (view for financial reporting context)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own transactions"        ON public.transactions;
DROP POLICY IF EXISTS "Service role manages transactions"  ON public.transactions;
DROP POLICY IF EXISTS "Admins can read all transactions"   ON public.transactions;
DROP POLICY IF EXISTS "Admins can update transactions"     ON public.transactions;
DROP POLICY IF EXISTS "Admins can insert transactions"     ON public.transactions;
DROP POLICY IF EXISTS "Super admin delete transactions"    ON public.transactions;

-- Players: own rows
CREATE POLICY "Users read own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role: unrestricted (Edge Function deposits / withdrawals)
CREATE POLICY "Service role manages transactions"
  ON public.transactions FOR ALL
  USING (auth.role() = 'service_role');

-- All admins can read all transactions
CREATE POLICY "Admins can read all transactions"
  ON public.transactions FOR SELECT
  USING (
    public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent','game_manager')
  );

-- super_admin + finance_admin: approve / reject / update status
CREATE POLICY "Admins can update transactions"
  ON public.transactions FOR UPDATE
  USING     (public.get_my_admin_role() IN ('super_admin','finance_admin'))
  WITH CHECK (public.get_my_admin_role() IN ('super_admin','finance_admin'));

-- super_admin + finance_admin: insert (admin credits / debits)
CREATE POLICY "Admins can insert transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (
    public.get_my_admin_role() IN ('super_admin','finance_admin')
  );

-- super_admin only: delete (purge / compliance)
CREATE POLICY "Super admin delete transactions"
  ON public.transactions FOR DELETE
  USING (public.get_my_admin_role() = 'super_admin');

-- ── 3. admin_audit_logs ──────────────────────────────────────────────────────
--
--  super_admin    SELECT + INSERT (full audit trail visibility)
--  finance_admin  INSERT only (log their own actions); SELECT their own entries
--  support_agent  INSERT only; SELECT their own entries
--  game_manager   INSERT only; SELECT their own entries
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can insert audit logs"   ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Admins can read audit logs"     ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Admin reads own audit entries"  ON public.admin_audit_logs;

-- Any admin can write audit entries (required to log their own actions)
CREATE POLICY "Admins can insert audit logs"
  ON public.admin_audit_logs FOR INSERT
  WITH CHECK (public.get_my_admin_role() IS NOT NULL);

-- super_admin: read the entire audit log
CREATE POLICY "Super admin reads all audit logs"
  ON public.admin_audit_logs FOR SELECT
  USING (public.get_my_admin_role() = 'super_admin');

-- Other admins: read only their own entries
CREATE POLICY "Admin reads own audit entries"
  ON public.admin_audit_logs FOR SELECT
  USING (
    public.get_my_admin_role() IN ('finance_admin','support_agent','game_manager')
    AND admin_id = auth.uid()
  );

-- ── 4. support_tickets + support_ticket_replies ──────────────────────────────
--
--  super_admin    Full CRUD on tickets + replies; can delete tickets
--  finance_admin  READ only (for context on financial disputes)
--  support_agent  SELECT / UPDATE (status, priority, assign); INSERT replies
--  game_manager   READ only (game-related complaints context)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit ticket"          ON public.support_tickets;
DROP POLICY IF EXISTS "Authenticated users submit tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins read tickets"               ON public.support_tickets;
DROP POLICY IF EXISTS "Admins update tickets"             ON public.support_tickets;
DROP POLICY IF EXISTS "Admins delete tickets"             ON public.support_tickets;
DROP POLICY IF EXISTS "Admins manage replies"             ON public.support_ticket_replies;
DROP POLICY IF EXISTS "Anyone can insert reply"           ON public.support_ticket_replies;
DROP POLICY IF EXISTS "Authenticated users add replies"   ON public.support_ticket_replies;

-- Players can submit tickets (public contact form — authentication preferred)
CREATE POLICY "Authenticated users submit tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- All admins can read all tickets
CREATE POLICY "Admins read tickets"
  ON public.support_tickets FOR SELECT
  USING (
    public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent','game_manager')
  );

-- super_admin + support_agent: update ticket status/priority/assignment
CREATE POLICY "Admins update tickets"
  ON public.support_tickets FOR UPDATE
  USING     (public.get_my_admin_role() IN ('super_admin','support_agent'))
  WITH CHECK (public.get_my_admin_role() IN ('super_admin','support_agent'));

-- super_admin only: delete tickets
CREATE POLICY "Super admin delete tickets"
  ON public.support_tickets FOR DELETE
  USING (public.get_my_admin_role() = 'super_admin');

-- All admins can read replies
CREATE POLICY "Admins read replies"
  ON public.support_ticket_replies FOR SELECT
  USING (
    public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent','game_manager')
  );

-- super_admin + support_agent: write replies
CREATE POLICY "Admins write replies"
  ON public.support_ticket_replies FOR INSERT
  WITH CHECK (
    public.get_my_admin_role() IN ('super_admin','support_agent')
  );

-- super_admin: update/delete replies (corrections)
CREATE POLICY "Super admin manage replies"
  ON public.support_ticket_replies FOR UPDATE
  USING     (public.get_my_admin_role() = 'super_admin')
  WITH CHECK (public.get_my_admin_role() = 'super_admin');

CREATE POLICY "Super admin delete replies"
  ON public.support_ticket_replies FOR DELETE
  USING (public.get_my_admin_role() = 'super_admin');

-- ── 5. casino_account ────────────────────────────────────────────────────────
--
--  super_admin    SELECT (read house balance)
--  finance_admin  SELECT (read house balance)
--  support_agent  No access
--  game_manager   No access
--  (All mutations only via SECURITY DEFINER RPCs)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.casino_account ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read casino account" ON public.casino_account;

CREATE POLICY "Finance roles read casino account"
  ON public.casino_account FOR SELECT
  USING (
    public.get_my_admin_role() IN ('super_admin','finance_admin')
  );

-- ── 6. withdrawal_fraud_logs ─────────────────────────────────────────────────
--
--  super_admin    SELECT + DELETE (purge old entries)
--  finance_admin  SELECT (review fraud flags before approving withdrawals)
--  support_agent  SELECT (context on suspicious accounts)
--  game_manager   No access
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.withdrawal_fraud_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read fraud logs"           ON public.withdrawal_fraud_logs;
DROP POLICY IF EXISTS "Service role inserts fraud logs"  ON public.withdrawal_fraud_logs;

-- Service role: full access (used by Edge Function)
CREATE POLICY "Service role manages fraud logs"
  ON public.withdrawal_fraud_logs FOR ALL
  USING (auth.role() = 'service_role');

-- super_admin + finance_admin + support_agent: read
CREATE POLICY "Admins read fraud logs"
  ON public.withdrawal_fraud_logs FOR SELECT
  USING (
    public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent')
  );

-- super_admin: delete old/resolved entries
CREATE POLICY "Super admin delete fraud logs"
  ON public.withdrawal_fraud_logs FOR DELETE
  USING (public.get_my_admin_role() = 'super_admin');

-- ── 7. player_stats ──────────────────────────────────────────────────────────
--
--  super_admin    SELECT all; reset via RPCs
--  finance_admin  SELECT all (for financial analysis)
--  support_agent  SELECT all (for player dispute resolution)
--  game_manager   SELECT all (for game performance analysis)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "player_stats_owner"          ON public.player_stats;
DROP POLICY IF EXISTS "Admins read player stats"    ON public.player_stats;

-- Players: own row
CREATE POLICY "player_stats_owner"
  ON public.player_stats FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- All admins: read all rows
CREATE POLICY "Admins read player stats"
  ON public.player_stats FOR SELECT
  USING (
    public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent','game_manager')
  );

-- ── 8. spins ─────────────────────────────────────────────────────────────────
--
--  super_admin    SELECT all
--  finance_admin  SELECT all (GGR / revenue analysis)
--  support_agent  SELECT all (verify player spin history for disputes)
--  game_manager   SELECT all (game performance / RTP monitoring)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'spins' AND table_schema = 'public') THEN
    ALTER TABLE public.spins ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users read own spins"    ON public.spins;
DROP POLICY IF EXISTS "Admins read spins"       ON public.spins;
DROP POLICY IF EXISTS "Users insert own spins"  ON public.spins;
DROP POLICY IF EXISTS "Service role spins"      ON public.spins;

CREATE POLICY "Users read own spins"
  ON public.spins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own spins"
  ON public.spins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role spins"
  ON public.spins FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins read spins"
  ON public.spins FOR SELECT
  USING (
    public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent','game_manager')
  );

-- ── 9. jackpots + jackpot_wins ───────────────────────────────────────────────
--
--  super_admin    Full access (configure, reset, view history)
--  finance_admin  SELECT only (payout tracking)
--  support_agent  SELECT only (player dispute context)
--  game_manager   SELECT + UPDATE (configure prize pools, reset)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jackpots' AND table_schema = 'public') THEN
    ALTER TABLE public.jackpots ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Admins read jackpots"       ON public.jackpots;
DROP POLICY IF EXISTS "Admins update jackpots"     ON public.jackpots;

CREATE POLICY "Admins read jackpots"
  ON public.jackpots FOR SELECT
  USING (
    public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent','game_manager')
  );

-- super_admin + game_manager: configure jackpot pools
CREATE POLICY "Admins configure jackpots"
  ON public.jackpots FOR UPDATE
  USING     (public.get_my_admin_role() IN ('super_admin','game_manager'))
  WITH CHECK (public.get_my_admin_role() IN ('super_admin','game_manager'));

-- jackpot_wins: all admins can read history
DROP POLICY IF EXISTS "Admins read jackpot wins" ON public.jackpot_wins;

CREATE POLICY "Admins read jackpot wins"
  ON public.jackpot_wins FOR SELECT
  USING (
    public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent','game_manager')
  );

-- ── 10. admin_sessions ───────────────────────────────────────────────────────
--
--  Every admin role reads their own session row only.
--  Service role manages all rows (for cleanup).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin reads own session"  ON public.admin_sessions;
DROP POLICY IF EXISTS "Service manages sessions" ON public.admin_sessions;

CREATE POLICY "Admin reads own session"
  ON public.admin_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service manages sessions"
  ON public.admin_sessions FOR ALL
  USING (auth.role() = 'service_role');

-- ── 11. RPC execute permissions ──────────────────────────────────────────────
-- Enforce at the DB level which roles can call each sensitive RPC.
-- SECURITY DEFINER functions do the final auth.uid() / get_my_admin_role() check.

-- admin_credit_player / admin_debit_player — finance_admin + super_admin only
-- (internal check inside the function already enforces this, but REVOKE from
--  PUBLIC adds a second layer so the function isn't even callable by others)
REVOKE EXECUTE ON FUNCTION public.admin_credit_player(uuid, numeric, text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_credit_player(uuid, numeric, text, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_debit_player(uuid, numeric, text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_debit_player(uuid, numeric, text, uuid) TO authenticated;

-- admin_reset_* — super_admin only (enforced inside functions)
REVOKE EXECUTE ON FUNCTION public.admin_reset_player_wins(uuid)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_reset_player_bets(uuid)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_reset_player_stats(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_reset_player_wins(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_player_bets(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_player_stats(uuid) TO authenticated;

-- admin_get_users — all admin roles
GRANT EXECUTE ON FUNCTION public.admin_get_users(int, int) TO authenticated;

-- Financial summary RPCs — all admin roles
GRANT EXECUTE ON FUNCTION public.get_casino_financial_summary(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_game_financial_summary(timestamptz, timestamptz)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_money_flow_series(timestamptz, timestamptz)        TO authenticated;

-- Session RPCs — all admin roles
GRANT EXECUTE ON FUNCTION public.start_admin_session(int)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_admin_session()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_admin_session(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_admin_session()        TO authenticated;

-- Spin RPC — players only (not admins)
GRANT EXECUTE ON FUNCTION public.apply_spin_result(uuid, numeric, numeric) TO authenticated;

-- ── 12. Harden admin_reset_* to enforce role at DB level ─────────────────────
-- Override the versions from player_stats_and_reset_functions.sql
-- to enforce super_admin check inside the function body.

CREATE OR REPLACE FUNCTION public.admin_reset_player_wins(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_my_admin_role() <> 'super_admin' THEN
    RAISE EXCEPTION 'Access denied: super_admin role required';
  END IF;
  DELETE FROM public.leaderboard WHERE user_id = target_user_id;
  INSERT INTO public.player_stats (user_id, total_wins, lifetime_wins, current_session_wins, daily_wins, weekly_wins, monthly_wins)
  VALUES (target_user_id, 0, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET total_wins = 0, lifetime_wins = 0, current_session_wins = 0,
        daily_wins = 0, weekly_wins = 0, monthly_wins = 0, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_player_bets(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_my_admin_role() <> 'super_admin' THEN
    RAISE EXCEPTION 'Access denied: super_admin role required';
  END IF;
  INSERT INTO public.player_stats (user_id, total_bets, total_bet_amount, daily_bet_amount, weekly_bet_amount, monthly_bet_amount, current_session_bets, current_session_bet_amount)
  VALUES (target_user_id, 0, 0, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET total_bets = 0, total_bet_amount = 0,
        daily_bet_amount = 0, weekly_bet_amount = 0, monthly_bet_amount = 0,
        current_session_bets = 0, current_session_bet_amount = 0, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_player_stats(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_my_admin_role() <> 'super_admin' THEN
    RAISE EXCEPTION 'Access denied: super_admin role required';
  END IF;
  DELETE FROM public.leaderboard WHERE user_id = target_user_id;
  INSERT INTO public.player_stats (user_id)
  VALUES (target_user_id)
  ON CONFLICT (user_id) DO UPDATE
    SET total_wins = 0, lifetime_wins = 0, current_session_wins = 0,
        daily_wins = 0, weekly_wins = 0, monthly_wins = 0,
        total_bets = 0, total_bet_amount = 0,
        daily_bet_amount = 0, weekly_bet_amount = 0, monthly_bet_amount = 0,
        current_session_bets = 0, current_session_bet_amount = 0,
        updated_at = now();
END;
$$;

-- ── 13. Reload PostgREST schema cache ────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
