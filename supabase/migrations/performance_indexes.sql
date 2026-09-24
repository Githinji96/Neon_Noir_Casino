-- Performance indexes for Neon Noir Casino
-- Applied to improve query performance for the most frequently hit tables.
-- All indexes use IF NOT EXISTS so this migration is idempotent.

-- ── profiles ─────────────────────────────────────────────────────────────────
-- balance-refresh poll (every 30s per logged-in user) and account-status checks
CREATE INDEX IF NOT EXISTS idx_profiles_id
  ON profiles(id);

-- ── notifications ─────────────────────────────────────────────────────────────
-- per-user ordered fetch — runs on every page load for logged-in users
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

-- unread count sub-query (is_read = false)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read) WHERE is_read = false;

-- ── transactions ─────────────────────────────────────────────────────────────
-- WithdrawalsPage: type=withdrawal ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_transactions_type_created
  ON transactions(type, created_at DESC);

-- FinancePage: date-range queries with status filter
CREATE INDEX IF NOT EXISTS idx_transactions_created_status
  ON transactions(created_at DESC, status);

-- ── spins ─────────────────────────────────────────────────────────────────────
-- Dashboard + Analytics trend queries: date range aggregation
CREATE INDEX IF NOT EXISTS idx_spins_created_at
  ON spins(created_at DESC);

-- Per-game analytics (AnalyticsPage Games tab)
CREATE INDEX IF NOT EXISTS idx_spins_game_created
  ON spins(game_id, created_at DESC);

-- ── admin_alerts ──────────────────────────────────────────────────────────────
-- Unresolved alerts query — fires on every admin page load
CREATE INDEX IF NOT EXISTS idx_admin_alerts_unresolved
  ON admin_alerts(resolved, created_at DESC) WHERE resolved = false;

-- ── vip_users ─────────────────────────────────────────────────────────────────
-- VIP leaderboard ORDER BY total_points DESC
CREATE INDEX IF NOT EXISTS idx_vip_users_points
  ON vip_users(total_points DESC);

-- ── weekly_cashbacks ──────────────────────────────────────────────────────────
-- Current-week lookup per user (runs on every VIP page load)
CREATE INDEX IF NOT EXISTS idx_weekly_cashbacks_user_week
  ON weekly_cashbacks(user_id, week_start DESC);

-- ── live_tables ───────────────────────────────────────────────────────────────
-- Status filter used by liveTablesStore and admin Live Tables page
CREATE INDEX IF NOT EXISTS idx_live_tables_status
  ON live_tables(status);
