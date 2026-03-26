# Implementation Plan: Casino Admin Panel

## Overview

Build a role-gated admin panel at `/admin` on top of the existing React + TypeScript + Vite + Supabase stack. Tasks are ordered by dependency: DB schema → types/store → auth guard → layout → pages → property tests.

## Tasks

- [x] 1. Database schema migrations
  - Run SQL to add `admin_role` and `account_status` columns to `profiles`
  - Create tables: `admin_audit_logs`, `admin_rtp_config`, `admin_game_config`, `admin_alerts`, `fraud_flags`
  - Add RLS policies: insert-only on `admin_audit_logs` (no UPDATE/DELETE for any role), service-role policies on config tables, admin-read policies
  - Seed one row into `admin_rtp_config` with defaults (`target_rtp=0.965`, `adjustment_strength=0.03`)
  - _Requirements: 1.1, 6.1, 10.1, 11.1, 11.5_


- [x] 2. TypeScript types and adminStore (`src/store/adminStore.ts`)
  - [x] 2.1 Define all TypeScript types: `AdminRole`, `AdminProfile`, `AuditLogEntry`, `AuditActionType`, `RTPConfig`, `FraudFlag`, `AdminAlert`, `GameConfig`, `JackpotPool`
    - _Requirements: 1.1, 6.1, 7.1, 10.1, 11.1_
  - [x] 2.2 Implement `adminStore` with Zustand: `adminProfile`, `loading`, `alerts`, `unreadAlertCount`, `init()`, `signOut()`, `subscribeToAlerts()`, `auditLog()`, `dismissAlert()`
    - `init()` fetches the current user's profile and verifies `admin_role` is non-null
    - `auditLog()` inserts into `admin_audit_logs`; failures are `console.error` only (best-effort)
    - `subscribeToAlerts()` opens a Supabase Realtime channel on `admin_alerts` and returns an unsubscribe function
    - _Requirements: 1.1, 2.1, 11.1_
  - [x] 2.3 Write property test for `auditLog()` completeness (Property 27)
    - **Property 27: For any admin action, audit log row has all required non-null fields**
    - **Validates: Requirements 11.1, 11.4**


- [x] 3. AdminAuthGuard and idle session timeout (`src/components/admin/AdminAuthGuard.tsx`)
  - Implement `AdminAuthGuard` component accepting `requiredRoles: AdminRole[]`
  - Render `<Outlet />` if `adminProfile.admin_role` is in `requiredRoles`
  - Redirect to `/admin/login` if unauthenticated; redirect to `/` with "Access Denied" toast if authenticated but wrong role
  - Track `mousemove`/`keydown` events; `setInterval` every 60s checks idle > 30 min → `supabase.auth.signOut()` + redirect to `/admin/login?reason=timeout`
  - _Requirements: 1.1, 1.2, 1.3, 1.8, 1.10_
  - [ ]* 3.1 Write property test for RBAC route access (Property 1)
    - **Property 1: For any role + route combination, AuthGuard grants/denies correctly**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.10, 2.8, 3.10, 4.8, 5.8, 6.7, 7.7, 8.6, 9.6, 10.6, 11.6**


- [x] 4. Admin routes wired into App.tsx
  - Add all 12 `/admin/*` routes to `src/App.tsx` wrapped in `AdminAuthGuard` with correct `requiredRoles` per route
  - `/admin` redirects to `/admin/dashboard`; `/admin/login` is public (no guard)
  - _Requirements: 1.1, 1.2, 1.4_

- [x] 5. Shared UI components (`src/components/admin/`)
  - [x] 5.1 `AdminLayout.tsx` — sidebar + topbar + `<Outlet />`; sidebar collapses to hamburger below 768px
    - _Requirements: 12.3, 12.4, 12.5_
  - [x] 5.2 `AdminSidebar.tsx` — renders only nav items whose `allowedRoles` includes the current admin's role
    - _Requirements: 12.3_
  - [ ]* 5.3 Write property test for sidebar role filtering (Property 30)
    - **Property 30: For any role, sidebar items = exactly the permitted sections for that role**
    - **Validates: Requirements 12.3**
  - [x] 5.4 `AdminTopbar.tsx` — username, role badge, unread alert count bell, sign-out button
    - _Requirements: 12.4_
  - [x] 5.5 `StatCard.tsx` — glassmorphism metric card (semi-transparent bg, backdrop-blur, neon border)
    - _Requirements: 12.1, 12.2_
  - [x] 5.6 `DataTable.tsx` — sortable, filterable, paginated table with page number + total count display
    - _Requirements: 12.6_
  - [x] 5.7 `ConfirmModal.tsx` — confirmation dialog for destructive actions (ban, force reset, round restart)
    - _Requirements: 12.7_
  - [x] 5.8 `AlertsPanel.tsx` — real-time list of unresolved `admin_alerts` rows
    - _Requirements: 2.5, 2.6, 2.7_
  - [x] 5.9 `LoadingSkeleton.tsx` — shimmer placeholder for async data
    - _Requirements: 12.8_
  - [x] 5.10 `ToastProvider.tsx` — toast notification context; used for async error messages
    - _Requirements: 12.9_


- [x] 6. Admin login page (`src/pages/admin/AdminLoginPage.tsx`)
  - Email + password form using `react-hook-form` + `zod`
  - On success, call `adminStore.init()` then redirect to `/admin/dashboard`
  - Display inline error on invalid credentials; never create a session on failure
  - _Requirements: 1.4, 1.5, 1.6, 1.7_
  - [ ]* 6.1 Write property test for invalid credentials (Property 2)
    - **Property 2: For any invalid credential pair, login returns error and null session**
    - **Validates: Requirements 1.5**

- [x] 7. Dashboard page (`src/pages/admin/DashboardPage.tsx`)
  - [x] 7.1 Implement metrics grid using `StatCard` — today/week/month revenue, bets vs payouts, global RTP %, active players, running tables, jackpot pool amounts; refresh via Supabase Realtime ≤10s
    - _Requirements: 2.1_
  - [x] 7.2 Implement RTP trend line chart (Recharts `LineChart`) — last 24h at 1h intervals
    - _Requirements: 2.2_
  - [x] 7.3 Implement revenue trend line chart — last 7 days at 1-day intervals
    - _Requirements: 2.3_
  - [x] 7.4 Implement bet distribution pie chart (Recharts `PieChart`) — current day by game type
    - _Requirements: 2.4_
  - [x] 7.5 Wire `AlertsPanel` into dashboard; show RTP deviation, large payout, and fraud flag alerts
    - _Requirements: 2.5, 2.6, 2.7_
  - [ ] 7.6 Write property test for RTP deviation alert threshold (Property 4)
    - **Property 4: For any targetRTP/currentRTP pair, alert exists iff |target - current| > 0.05**
    - **Validates: Requirements 2.5**
  - [ ]* 7.7 Write property test for large payout alert threshold (Property 5)
    - **Property 5: For any payout amount, large-payout alert generated iff amount > 50000**
    - **Validates: Requirements 2.6**
  - [ ]* 7.8 Write property test for fraud flag propagation to alerts (Property 6)
    - **Property 6: For any undismissed fraud flag, alert appears in dashboard**
    - **Validates: Requirements 2.7, 10.3**


- [x] 8. User management pages (`src/pages/admin/UsersPage.tsx`, `UserDetailPage.tsx`)
  - [x] 8.1 `UsersPage` — paginated player list (username, email, balance, registration date, account_status) with search input filtering by username/email
    - _Requirements: 3.1, 3.2_
  - [ ]* 8.2 Write property test for player search filtering (Property 7)
    - **Property 7: For any search term, filtered profiles contain only matching records (case-insensitive)**
    - **Validates: Requirements 3.2**
  - [x] 8.3 `UserDetailPage` — display balance, lifetime bets/wins/losses, paginated session history, paginated activity log; balance adjustment form with amount + reason fields
    - _Requirements: 3.3, 3.4, 3.9_
  - [x] 8.4 Implement balance adjustment: validate `balance + adjustment >= 0`, update `profiles`, call `auditLog('balance_adjust')`
    - _Requirements: 3.4, 3.5_
  - [ ]* 8.5 Write property test for balance adjustment validity (Property 8)
    - **Property 8: For any balance + adjustment, result is correct or rejected if it would go negative**
    - **Validates: Requirements 3.4, 3.5**
  - [x] 8.6 Implement suspend/ban actions with `ConfirmModal`; update `account_status`, call `auditLog('user_suspend'/'user_ban')`
    - _Requirements: 3.6, 3.7_
  - [ ]* 8.7 Write property test for account status transitions (Property 9)
    - **Property 9: For any player, suspend sets status=suspended; ban sets status=banned**
    - **Validates: Requirements 3.6, 3.7**
  - [x] 8.8 Implement password reset trigger: call `supabase.auth.admin.generateLink`, call `auditLog('password_reset')`
    - _Requirements: 3.8_

- [ ] 9. Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [x] 10. Finance page (`src/pages/admin/FinancePage.tsx`)
  - [x] 10.1 Paginated transaction list (ID, username, amount, type, status, M-Pesa receipt, timestamp) with date-range and status filters
    - _Requirements: 4.1, 4.2_
  - [ ]* 10.2 Write property test for transaction filter correctness (Property 10)
    - **Property 10: For any transactions + filter, result contains only matching records**
    - **Validates: Requirements 4.2**
  - [x] 10.3 Transaction detail view showing STK Push status and callback log
    - _Requirements: 4.3_
  - [x] 10.4 Approve withdrawal: update status to `approved`, invoke M-Pesa payout Edge Function, call `auditLog('withdrawal_approve')`
    - _Requirements: 4.4_
  - [x] 10.5 Reject withdrawal: update status to `rejected`, restore reserved balance, call `auditLog('withdrawal_reject')`
    - _Requirements: 4.5_
  - [ ]* 10.6 Write property test for withdrawal approval/rejection state transitions (Property 11)
    - **Property 11: For any pending withdrawal, approve/reject transitions are correct**
    - **Validates: Requirements 4.4, 4.5**
  - [x] 10.7 Retry failed transaction: re-invoke STK Push Edge Function, call `auditLog('payment_retry')`
    - _Requirements: 4.6_
  - [x] 10.8 CSV export: generate RFC 4180 CSV from filtered transactions, trigger browser download within 5s
    - _Requirements: 4.7_
  - [ ]* 10.9 Write property test for CSV export correctness (Property 12)
    - **Property 12: For any filtered transaction set, CSV has correct rows and columns**
    - **Validates: Requirements 4.7, 9.5**


- [x] 11. Game management page (`src/pages/admin/GamesPage.tsx`)
  - [x] 11.1 Game list with enabled/disabled toggle, min/max bet, payout multiplier, volatility; toggle calls `auditLog('game_toggle')`
    - _Requirements: 5.1, 5.2_
  - [ ]* 11.2 Write property test for game toggle idempotency (Property 14)
    - **Property 14: For any game, toggling twice returns to original enabled status**
    - **Validates: Requirements 5.2**
  - [x] 11.3 Game config edit form: validate `min_bet > 0`, `max_bet > min_bet`, multipliers > 0; persist to `admin_game_config`, call `auditLog('game_config_update')`; show field-level errors on failure
    - _Requirements: 5.3, 5.4_
  - [ ]* 11.4 Write property test for game config validation (Property 13)
    - **Property 13: For any game config, valid configs persist; invalid configs are rejected with field errors**
    - **Validates: Requirements 5.3, 5.4**
  - [x] 11.5 Live tables management sub-section: list tables (name, dealer, max players, status); create/edit table forms; call `auditLog('table_create'/'table_edit')`
    - _Requirements: 5.5, 5.6, 5.7_

- [x] 12. RTP control page (`src/pages/admin/RTPPage.tsx`)
  - [x] 12.1 Display `targetRTP`, `currentRTP`, deviation %; refresh ≤10s via Supabase Realtime
    - _Requirements: 6.1_
  - [ ]* 12.2 Write property test for RTP deviation calculation (Property 17)
    - **Property 17: For any targetRTP/currentRTP, deviation = |target - current| * 100 rounded to 2dp**
    - **Validates: Requirements 6.1**
  - [x] 12.3 Target RTP update form: validate `0.85 <= value <= 0.99`; persist to `admin_rtp_config`, call `auditLog('rtp_update')`; show validation error on out-of-range
    - _Requirements: 6.2, 6.3_
  - [ ]* 12.4 Write property test for RTP target range validation (Property 15)
    - **Property 15: For any targetRTP value, accepted iff in [0.85, 0.99]**
    - **Validates: Requirements 6.2, 6.3**
  - [x] 12.5 Adjustment strength update form: validate `0.001 <= value <= 0.1`; persist, call `auditLog('rtp_update')`
    - _Requirements: 6.4, 6.5_
  - [ ]* 12.6 Write property test for adjustment strength range validation (Property 16)
    - **Property 16: For any adjustment strength, accepted iff in [0.001, 0.1]**
    - **Validates: Requirements 6.4, 6.5**
  - [x] 12.7 Paginated RTP change history table (previous value, new value, admin, timestamp)
    - _Requirements: 6.6_


- [x] 13. Jackpot management page (`src/pages/admin/JackpotsPage.tsx`)
  - [x] 13.1 Display all jackpot pools with current amount, base amount, contribution rate, trigger probability, last win, last reset
    - _Requirements: 7.1_
  - [x] 13.2 Jackpot config edit form: validate `base_amount > 0`, `0.001 <= contribution_rate <= 0.1`, `0.000001 <= trigger_probability <= 0.01`; persist, call `auditLog('jackpot_config_update')`
    - _Requirements: 7.2, 7.3_
  - [ ]* 13.3 Write property test for jackpot config validation (Property 18)
    - **Property 18: For any jackpot config, valid configs persist; invalid configs are rejected**
    - **Validates: Requirements 7.2, 7.3**
  - [x] 13.4 Force reset button (behind `ConfirmModal`): set `current_amount = base_amount`, insert zero-winner row in `jackpot_wins`, call `auditLog('jackpot_force_reset')`
    - _Requirements: 7.4_
  - [ ]* 13.5 Write property test for jackpot force reset (Property 19)
    - **Property 19: For any jackpot, force reset sets current_amount = base_amount**
    - **Validates: Requirements 7.4**
  - [x] 13.6 Jackpot growth line chart (Recharts) — last 7 days per pool; paginated winner history table
    - _Requirements: 7.5, 7.6_

- [x] 14. Live tables admin page (`src/pages/admin/LiveTablesAdminPage.tsx`)
  - [x] 14.1 Real-time table list (player count, round status, total bets); refresh ≤5s via Supabase Realtime
    - _Requirements: 8.1_
  - [x] 14.2 Pause/resume table: update status, call `auditLog('table_pause'/'table_resume')`
    - _Requirements: 8.2, 8.3_
  - [ ]* 14.3 Write property test for live table pause/resume round-trip (Property 20)
    - **Property 20: For any active table, pause then resume restores active status**
    - **Validates: Requirements 8.2, 8.3**
  - [x] 14.4 Kick player: remove from table session, call `auditLog('player_kick')`
    - _Requirements: 8.4_
  - [ ]* 14.5 Write property test for player kick (Property 21)
    - **Property 21: For any table + player, kick removes player from participant list**
    - **Validates: Requirements 8.4**
  - [x] 14.6 Restart round (behind `ConfirmModal`): reset round state, refund all bets to respective players, call `auditLog('round_restart')`
    - _Requirements: 8.5_
  - [ ]* 14.7 Write property test for round restart refunds (Property 22)
    - **Property 22: For any round with bets, restart refunds each player exactly their bet amount**
    - **Validates: Requirements 8.5**

- [ ] 15. Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [x] 16. Analytics page (`src/pages/admin/AnalyticsPage.tsx`)
  - [x] 16.1 Revenue report: total revenue, deposits, withdrawals, net profit; filterable by date range and game type
    - _Requirements: 9.1_
  - [x] 16.2 RTP report: average, min, max RTP and deviation over selected date range
    - _Requirements: 9.2_
  - [x] 16.3 Player behaviour view: new registrations, active players, avg session duration, avg bet size; filterable by date range and segment
    - _Requirements: 9.3_
  - [x] 16.4 Game performance stats: bets, payouts, RTP, player count per game; filterable by date range
    - _Requirements: 9.4_
  - [x] 16.5 CSV export for each report view; trigger browser download within 5s
    - _Requirements: 9.5_

- [~] 17. Fraud and risk management page (`src/pages/admin/FraudPage.tsx`)
  - [x] 17.1 Implement `detectRapidHighBets(bets)` utility: flag if >20 bets >KES 5,000 in any 60s window; insert into `fraud_flags` and `admin_alerts`
    - _Requirements: 10.1_
  - [ ]* 17.2 Write property test for rapid high bets detection (Property 23)
    - **Property 23: For any bet sequence, player flagged iff >20 bets >5000 in any 60s window**
    - **Validates: Requirements 10.1**
  - [x] 17.3 Implement `detectHighWinRate(bets)` utility: flag if win rate > 80% over any 50-bet rolling window; insert into `fraud_flags` and `admin_alerts`
    - _Requirements: 10.2_
  - [ ]* 17.4 Write property test for high win rate detection (Property 24)
    - **Property 24: For any 50-bet window, player flagged iff win rate > 80%**
    - **Validates: Requirements 10.2**
  - [x] 17.5 Fraud flags list page: show active flags with player info, reason, metadata; apply auto-limit action (cap max_bet at KES 1,000, call `auditLog('bet_limit_apply')`)
    - _Requirements: 10.3, 10.4_
  - [ ]* 17.6 Write property test for auto-limit (Property 25)
    - **Property 25: For any flagged player, auto-limit sets max_bet = 1000**
    - **Validates: Requirements 10.4**
  - [x] 17.7 Dismiss fraud flag: set `dismissed = true`, remove from alerts panel, call `auditLog('fraud_flag_dismiss')`
    - _Requirements: 10.5_
  - [ ]* 17.8 Write property test for fraud flag dismissal (Property 26)
    - **Property 26: For any dismissed flag, flag absent from active alerts and dismissed=true**
    - **Validates: Requirements 10.5**


- [x] 18. Audit log page (`src/pages/admin/AuditPage.tsx`)
  - [x] 18.1 Paginated audit log table filterable by admin ID, action type, and date range; return results within 500ms
    - _Requirements: 11.2, 11.3_
  - [ ]* 18.2 Write property test for audit log filter correctness (Property 28)
    - **Property 28: For any audit log + filter, result contains only matching entries**
    - **Validates: Requirements 11.2, 11.3**
  - [ ]* 18.3 Write property test for audit log immutability (Property 29)
    - **Property 29: For any role, UPDATE/DELETE on admin_audit_logs is rejected by RLS**
    - **Validates: Requirements 11.5**

- [ ] 19. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Install required packages before starting: `npm install recharts` and `npm install --save-dev fast-check` (fast-check is already in devDependencies per package.json)
- Each property test file should live at `src/components/admin/__tests__/` or `src/pages/admin/__tests__/` and use the comment format `// Feature: casino-admin-panel, Property N: <property_text>`
- Property tests use `fc.assert(fc.property(...))` with minimum 100 runs
- All admin mutations must call `auditLog()` — failures are best-effort (console.error only, never block the primary action)
- Supabase RLS enforces immutability of `admin_audit_logs` at the DB level; the React layer should never attempt UPDATE/DELETE on that table
