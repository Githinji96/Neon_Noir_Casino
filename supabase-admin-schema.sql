-- ============================================================
-- CASINO ADMIN PANEL - Schema Migrations
-- Run this in Supabase SQL Editor
-- Safe to re-run - uses IF NOT EXISTS / OR REPLACE / DO blocks
-- This file is self-contained: jackpots/live_tables created here
-- if supabase-schema.sql was not run first.
-- ============================================================

-- ============================================================
-- 1. ALTER profiles - add admin_role + account_status
-- ============================================================
DO $col1$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='profiles' AND column_name='admin_role'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN admin_role text
        CHECK (admin_role IN ('super_admin','finance_admin','support_agent','game_manager'));
  END IF;
END $col1$;

DO $col2$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='profiles' AND column_name='account_status'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN account_status text NOT NULL DEFAULT 'active'
        CHECK (account_status IN ('active','suspended','banned'));
  END IF;
END $col2$;

-- ============================================================
-- 1b. Admin read policies on base tables
-- ============================================================

-- Users can always read their own profile row (covers admin_role column)
-- This is what adminStore.init() uses — no circular dependency
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Helper function: returns true if the calling user has an admin role
-- Uses SECURITY DEFINER so it bypasses RLS when checking the caller's own row
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND admin_role IS NOT NULL
  );
$$;

-- Admins can read ALL profiles (uses the helper to avoid circular RLS)
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

-- Admins can update all profiles (for balance adjust, suspend, ban)
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

-- Admins can read all transactions
DROP POLICY IF EXISTS "Admins can read all transactions" ON public.transactions;
CREATE POLICY "Admins can read all transactions"
  ON public.transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND admin_role IS NOT NULL
    )
  );

-- Admins can read all leaderboard entries
DROP POLICY IF EXISTS "Admins can read all leaderboard" ON public.leaderboard;
CREATE POLICY "Admins can read all leaderboard"
  ON public.leaderboard FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND admin_role IS NOT NULL
    )
  );

-- ============================================================
-- 2. ADMIN AUDIT LOGS (immutable - no UPDATE/DELETE allowed)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_role      text NOT NULL,
  action_type     text NOT NULL,
  target_entity   text,
  target_id       text,
  previous_value  jsonb,
  new_value       jsonb,
  ip_address      inet,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can insert audit logs"
  ON public.admin_audit_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND admin_role IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Admins can read audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can read audit logs"
  ON public.admin_audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND admin_role = 'super_admin'
    )
  );

-- NO UPDATE or DELETE policies - immutability enforced at DB level

-- ============================================================
-- 3. ADMIN RTP CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_rtp_config (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_rtp            numeric(5,4) NOT NULL DEFAULT 0.9650,
  adjustment_strength   numeric(5,4) NOT NULL DEFAULT 0.0300,
  updated_by            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE public.admin_rtp_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read rtp config" ON public.admin_rtp_config;
CREATE POLICY "Admins can read rtp config"
  ON public.admin_rtp_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND admin_role IN ('super_admin','game_manager')
    )
  );

DROP POLICY IF EXISTS "Admins can update rtp config" ON public.admin_rtp_config;
CREATE POLICY "Admins can update rtp config"
  ON public.admin_rtp_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND admin_role IN ('super_admin','game_manager')
    )
  );

DROP POLICY IF EXISTS "Service role manages rtp config" ON public.admin_rtp_config;
CREATE POLICY "Service role manages rtp config"
  ON public.admin_rtp_config FOR ALL
  USING (auth.role() = 'service_role');

-- Seed default RTP config row
INSERT INTO public.admin_rtp_config (target_rtp, adjustment_strength)
SELECT 0.9650, 0.0300
WHERE NOT EXISTS (SELECT 1 FROM public.admin_rtp_config);

-- ============================================================
-- 4. ADMIN GAME CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_game_config (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     text NOT NULL UNIQUE,
  enabled     boolean NOT NULL DEFAULT true,
  min_bet     numeric(10,2) NOT NULL DEFAULT 10.00,
  max_bet     numeric(10,2) NOT NULL DEFAULT 10000.00,
  volatility  text NOT NULL DEFAULT 'high',
  updated_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.admin_game_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read game config" ON public.admin_game_config;
CREATE POLICY "Admins can read game config"
  ON public.admin_game_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND admin_role IN ('super_admin','game_manager')
    )
  );

DROP POLICY IF EXISTS "Admins can manage game config" ON public.admin_game_config;
CREATE POLICY "Admins can manage game config"
  ON public.admin_game_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND admin_role IN ('super_admin','game_manager')
    )
  );

DROP POLICY IF EXISTS "Service role manages game config" ON public.admin_game_config;
CREATE POLICY "Service role manages game config"
  ON public.admin_game_config FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 5. ADMIN ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text NOT NULL CHECK (type IN ('rtp_deviation','large_payout','fraud_flag')),
  severity    text NOT NULL DEFAULT 'high' CHECK (severity IN ('high','medium','low')),
  message     text NOT NULL,
  metadata    jsonb DEFAULT '{}',
  resolved    boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read alerts" ON public.admin_alerts;
CREATE POLICY "Admins can read alerts"
  ON public.admin_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND admin_role IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Admins can update alerts" ON public.admin_alerts;
CREATE POLICY "Admins can update alerts"
  ON public.admin_alerts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND admin_role IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Service role manages alerts" ON public.admin_alerts;
CREATE POLICY "Service role manages alerts"
  ON public.admin_alerts FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can insert alerts" ON public.admin_alerts;
CREATE POLICY "Admins can insert alerts"
  ON public.admin_alerts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND admin_role IS NOT NULL
    )
  );

-- ============================================================
-- 6. FRAUD FLAGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fraud_flags (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason              text NOT NULL CHECK (reason IN ('rapid_high_bets','high_win_rate')),
  metadata            jsonb DEFAULT '{}',
  dismissed           boolean NOT NULL DEFAULT false,
  bet_limit_applied   boolean NOT NULL DEFAULT false,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage fraud flags" ON public.fraud_flags;
CREATE POLICY "Admins can manage fraud flags"
  ON public.fraud_flags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND admin_role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Service role manages fraud flags" ON public.fraud_flags;
CREATE POLICY "Service role manages fraud flags"
  ON public.fraud_flags FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 7. JACKPOTS + JACKPOT_WINS (self-contained, safe to re-run)
-- ============================================================

-- Create jackpots table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS public.jackpots (
  id                  text PRIMARY KEY,
  name                text NOT NULL,
  type                text NOT NULL DEFAULT 'daily',
  base_amount         numeric(14, 2) NOT NULL,
  current_amount      numeric(14, 2) NOT NULL,
  contribution_rate   numeric(5, 4) NOT NULL DEFAULT 0.02,
  trigger_probability numeric(10, 8) NOT NULL DEFAULT 0.00010000,
  last_reset          timestamptz DEFAULT now()
);

-- Add trigger_probability column if table already existed without it
DO $jp1$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jackpots' AND column_name = 'trigger_probability'
  ) THEN
    ALTER TABLE public.jackpots
      ADD COLUMN trigger_probability numeric(10,8) NOT NULL DEFAULT 0.00010000;
  END IF;
END $jp1$;

-- Create jackpot_wins table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS public.jackpot_wins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  jackpot_id  text REFERENCES public.jackpots(id),
  amount      numeric(14, 2) NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- RLS for jackpots
ALTER TABLE public.jackpots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read jackpots" ON public.jackpots;
CREATE POLICY "Anyone can read jackpots"
  ON public.jackpots FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role manages jackpots" ON public.jackpots;
CREATE POLICY "Service role manages jackpots"
  ON public.jackpots FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can manage jackpots" ON public.jackpots;
CREATE POLICY "Admins can manage jackpots"
  ON public.jackpots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND admin_role IN ('super_admin','game_manager')
    )
  );

-- RLS for jackpot_wins
ALTER TABLE public.jackpot_wins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read jackpot wins" ON public.jackpot_wins;
CREATE POLICY "Anyone can read jackpot wins"
  ON public.jackpot_wins FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role manages jackpot wins" ON public.jackpot_wins;
CREATE POLICY "Service role manages jackpot wins"
  ON public.jackpot_wins FOR ALL USING (auth.role() = 'service_role');

-- Seed jackpot data (skips rows that already exist)
INSERT INTO public.jackpots (id, name, type, base_amount, current_amount, contribution_rate, trigger_probability)
VALUES
  ('mega-moolah-noir', 'Mega Moolah Noir', 'mega',   3000000.00, 3429102.55, 0.05, 0.00001000),
  ('electric-pulse',   'Electric Pulse',   'hourly',  100000.00, 1253671.36, 0.03, 0.00050000),
  ('crystal-vault',    'Crystal Vault',    'daily',   500000.00,  879129.61, 0.02, 0.00010000),
  ('shadow-fortune',   'Shadow Fortune',   'weekly',  200000.00,  515125.45, 0.04, 0.00005000),
  ('neon-nexus',       'Neon Nexus',       'hourly',   50000.00,  253709.99, 0.01, 0.00100000)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 8. SPINS TABLE (per-spin bet + payout tracking for real RTP/GGR)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.spins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  game_id     text NOT NULL,
  bet         numeric(10, 2) NOT NULL,
  payout      numeric(10, 2) NOT NULL DEFAULT 0,
  is_free_spin boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- Index for fast aggregation by user, game, and date
CREATE INDEX IF NOT EXISTS spins_user_id_idx ON public.spins (user_id);
CREATE INDEX IF NOT EXISTS spins_game_id_idx ON public.spins (game_id);
CREATE INDEX IF NOT EXISTS spins_created_at_idx ON public.spins (created_at);

ALTER TABLE public.spins ENABLE ROW LEVEL SECURITY;

-- Users can insert their own spins (client-side recording)
DROP POLICY IF EXISTS "Users can insert own spins" ON public.spins;
CREATE POLICY "Users can insert own spins"
  ON public.spins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can read all spins
DROP POLICY IF EXISTS "Admins can read all spins" ON public.spins;
CREATE POLICY "Admins can read all spins"
  ON public.spins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND admin_role IS NOT NULL
    )
  );

-- Service role full access
DROP POLICY IF EXISTS "Service role manages spins" ON public.spins;
CREATE POLICY "Service role manages spins"
  ON public.spins FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 9. LIVE TABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.live_tables (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  game_type   text NOT NULL DEFAULT 'blackjack',
  min_bet     numeric(10,2) NOT NULL DEFAULT 100.00,
  max_bet     numeric(10,2) NOT NULL DEFAULT 50000.00,
  seats       int NOT NULL DEFAULT 7,
  occupied    int NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','maintenance')),
  dealer_name text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.live_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read live tables" ON public.live_tables;
CREATE POLICY "Anyone can read live tables"
  ON public.live_tables FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage live tables" ON public.live_tables;
CREATE POLICY "Admins can manage live tables"
  ON public.live_tables FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND admin_role IN ('super_admin','game_manager')
    )
  );

-- ============================================================
-- DONE
-- After running this file:
--   UPDATE profiles SET admin_role = 'super_admin' WHERE id = '<your-user-id>';
--   Then navigate to /admin/login
-- ============================================================
