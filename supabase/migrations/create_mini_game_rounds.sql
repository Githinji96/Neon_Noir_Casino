-- ============================================================
-- Mini Game Rounds Table
-- Records every mini jackpot game round — bet, outcome, payout.
-- Supports both single-phase rounds (phase = 'complete' on insert)
-- and two-phase rounds (phase = 'pending' until player reveals).
--
-- idempotency_key is UNIQUE — prevents duplicate debits/credits
-- when the same request is retried after a network failure.
--
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS,
-- DROP POLICY IF EXISTS, and CREATE INDEX IF NOT EXISTS.
-- ============================================================

-- ── 1. Table ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mini_game_rounds (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key   uuid          NOT NULL UNIQUE,
  user_id           uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  game_id           text          NOT NULL,
  stake             numeric(10,2) NOT NULL,
  outcome           jsonb         NOT NULL DEFAULT '{}',
  payout            numeric(10,2) NOT NULL DEFAULT 0,
  phase             text          NOT NULL DEFAULT 'complete'
                                  CHECK (phase IN ('pending', 'complete')),
  created_at        timestamptz   NOT NULL DEFAULT now(),
  settled_at        timestamptz
);

-- ── 2. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS mini_game_rounds_user_id_idx
  ON public.mini_game_rounds (user_id);

CREATE INDEX IF NOT EXISTS mini_game_rounds_game_id_idx
  ON public.mini_game_rounds (game_id);

CREATE INDEX IF NOT EXISTS mini_game_rounds_created_at_idx
  ON public.mini_game_rounds (created_at);

-- ── 3. Row-Level Security ────────────────────────────────────────────────────
ALTER TABLE public.mini_game_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players read own rounds"           ON public.mini_game_rounds;
DROP POLICY IF EXISTS "Service role manages rounds"       ON public.mini_game_rounds;
DROP POLICY IF EXISTS "Admins read all rounds"            ON public.mini_game_rounds;

-- Players can only read their own round history
CREATE POLICY "Players read own rounds"
  ON public.mini_game_rounds FOR SELECT
  USING (auth.uid() = user_id);

-- Service role (Edge Functions / SECURITY DEFINER RPCs): unrestricted
CREATE POLICY "Service role manages rounds"
  ON public.mini_game_rounds FOR ALL
  USING     (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- All admin roles can read all rounds (disputes, auditing, game analytics)
CREATE POLICY "Admins read all rounds"
  ON public.mini_game_rounds FOR SELECT
  USING (
    public.get_my_admin_role() IN ('super_admin', 'finance_admin', 'support_agent', 'game_manager')
  );

-- ── 4. Reload PostgREST schema cache ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
