-- ============================================================
-- Mini Game Config Table
-- Stores configuration for each mini jackpot game variant.
-- Enabled flag controls player visibility; all games start
-- as COMING SOON (enabled = false) until activated via admin.
--
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS,
-- DROP POLICY IF EXISTS, and INSERT ... ON CONFLICT DO NOTHING.
-- ============================================================

-- ── 1. Table ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mini_game_config (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id               text          NOT NULL UNIQUE,
  enabled               boolean       NOT NULL DEFAULT false,
  min_bet               numeric(10,2) NOT NULL DEFAULT 10,
  max_bet               numeric(10,2) NOT NULL DEFAULT 1000,
  prize_tiers           jsonb         NOT NULL DEFAULT '[]',
  outcome_probabilities jsonb         NOT NULL DEFAULT '{}',
  maintenance           boolean       NOT NULL DEFAULT false,
  game_specific_rules   jsonb         NOT NULL DEFAULT '{}',
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now()
);

-- ── 2. Index ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS mini_game_config_game_id_idx
  ON public.mini_game_config (game_id);

-- ── 3. Row-Level Security ────────────────────────────────────────────────────
ALTER TABLE public.mini_game_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can read mini game configs"          ON public.mini_game_config;
DROP POLICY IF EXISTS "Service role manages mini game configs"      ON public.mini_game_config;
DROP POLICY IF EXISTS "Admins can read all mini game configs"       ON public.mini_game_config;

-- Authenticated players can read all configs (to show COMING SOON vs PLAY NOW)
CREATE POLICY "Players can read mini game configs"
  ON public.mini_game_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Service role (Edge Functions): unrestricted
CREATE POLICY "Service role manages mini game configs"
  ON public.mini_game_config FOR ALL
  USING     (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Admin roles: read all configs (game_manager can also update via RPC)
CREATE POLICY "Admins can read all mini game configs"
  ON public.mini_game_config FOR SELECT
  USING (
    public.get_my_admin_role() IN ('super_admin', 'finance_admin', 'support_agent', 'game_manager')
  );

-- ── 4. Seed rows ─────────────────────────────────────────────────────────────
-- All games start disabled (COMING SOON). Enable via the admin panel.
INSERT INTO public.mini_game_config
  (game_id, enabled, min_bet, max_bet, prize_tiers, outcome_probabilities, game_specific_rules)
VALUES
  ('lucky-wheel',        false, 10.00, 1000.00, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('scratch-cards',      false, 10.00, 1000.00, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('treasure-chest',     false, 10.00, 1000.00, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('mini-slot',          false, 10.00, 1000.00, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('mystery-multiplier', false, 10.00, 1000.00, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('crystal-match',      false, 10.00, 1000.00, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb)
ON CONFLICT (game_id) DO NOTHING;

-- ── 5. Reload PostgREST schema cache ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
