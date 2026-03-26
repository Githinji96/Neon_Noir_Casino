# Requirements Document

## Introduction

The Casino Admin Panel is a secure, role-gated management interface for the Neon Noir Casino web application, accessible at `/admin`. It provides real-time operational control over users, finances (M-Pesa), RTP configuration, jackpot pools, live tables, analytics, fraud detection, and a full audit trail. The panel is built on the existing React + TypeScript + Tailwind CSS + Supabase stack and integrates with the platform's current auth, game, jackpot, and payment systems.

## Glossary

- **Admin_Panel**: The web application interface accessible at `/admin` that provides administrative control over the casino platform.
- **RBAC**: Role-Based Access Control — the permission system governing what each admin role can view and perform.
- **Super_Admin**: The highest-privilege admin role with unrestricted access to all Admin_Panel features.
- **Finance_Admin**: An admin role with access to financial reports, transaction management, and M-Pesa operations.
- **Support_Agent**: An admin role with access to user management and activity logs.
- **Game_Manager**: An admin role with access to game configuration, RTP controls, jackpot management, and live table management.
- **Auth_Guard**: The route-level component that enforces RBAC and session validity before rendering Admin_Panel pages.
- **Dashboard**: The Admin_Panel overview page displaying real-time platform metrics and alerts.
- **RTP_Controller**: The Admin_Panel module responsible for reading and writing Return-to-Player configuration values.
- **Jackpot_Manager**: The Admin_Panel module responsible for viewing and configuring jackpot pool parameters.
- **Audit_Logger**: The system component that records every admin action with timestamp, admin identity, and action details.
- **Fraud_Detector**: The system component that monitors player behaviour for anomalies and surfaces alerts to admins.
- **OTP**: One-Time Password used as the second factor in two-factor authentication.
- **STK_Push**: Safaricom M-Pesa Lipa Na M-Pesa Online payment initiation request sent to a customer's phone.
- **Session**: An authenticated admin browser session backed by a Supabase JWT and a refresh token.
- **Deviation**: The absolute percentage difference between `targetRTP` and `currentRTP`.

---

## Requirements

### Requirement 1: Access Control and Authentication

**User Story:** As a Super Admin, I want only authorised personnel with the correct role to access the Admin Panel, so that casino operations and sensitive data are protected from unauthorised access.

#### Acceptance Criteria

1. THE Auth_Guard SHALL restrict access to all `/admin` routes to users whose Supabase profile contains a valid `admin_role` value (`super_admin`, `finance_admin`, `support_agent`, or `game_manager`).
2. WHEN an unauthenticated user navigates to any `/admin` route, THE Auth_Guard SHALL redirect the user to `/admin/login`.
3. WHEN an authenticated user with no `admin_role` navigates to any `/admin` route, THE Auth_Guard SHALL redirect the user to `/` and display an "Access Denied" message.
4. WHEN an admin submits valid email and password credentials, THE Admin_Panel SHALL create a Session and redirect the admin to `/admin/dashboard`.
5. IF an admin submits invalid credentials, THEN THE Admin_Panel SHALL display a descriptive error message and SHALL NOT create a Session.
6. WHEN an admin enables two-factor authentication, THE Admin_Panel SHALL require a valid OTP before completing login.
7. IF an OTP is invalid or expired, THEN THE Admin_Panel SHALL reject the login attempt and display an error message.
8. WHILE a Session is active and idle for more than 30 minutes, THE Auth_Guard SHALL invalidate the Session and redirect the admin to `/admin/login`.
9. THE Admin_Panel SHALL use Supabase refresh tokens to silently renew Sessions that are active and not idle.
10. WHERE a route requires `super_admin` role, THE Auth_Guard SHALL deny access to admins with any other role and display an "Insufficient Permissions" message.

---

### Requirement 2: Dashboard — Real-Time Metrics

**User Story:** As a Super Admin or Finance Admin, I want a real-time overview of platform performance, so that I can monitor casino health at a glance.

#### Acceptance Criteria

1. THE Dashboard SHALL display the following metrics updated at intervals of no more than 10 seconds: total revenue for today, total revenue for the current week, total revenue for the current month, total bets vs total payouts, current global RTP percentage, count of active online players, count of running live tables, and current pool amounts for each jackpot tier (Mega, Daily, Hourly).
2. THE Dashboard SHALL render a line chart showing RTP trend data for the last 24 hours sampled at 1-hour intervals.
3. THE Dashboard SHALL render a line chart showing revenue trend data for the last 7 days sampled at 1-day intervals.
4. THE Dashboard SHALL render a pie chart showing bet distribution across game types for the current day.
5. WHEN the global RTP Deviation exceeds 5%, THE Dashboard SHALL display a high-priority alert in the alerts panel.
6. WHEN a single payout exceeds KES 50,000, THE Dashboard SHALL display a large-payout alert in the alerts panel.
7. WHEN the Fraud_Detector flags a user, THE Dashboard SHALL display a suspicious-activity alert in the alerts panel.
8. THE Dashboard SHALL be accessible to admins with roles `super_admin` and `finance_admin` only.

---

### Requirement 3: User Management

**User Story:** As a Support Agent or Super Admin, I want to view and manage player accounts, so that I can resolve issues and enforce platform policies.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a paginated list of all player profiles with columns for username, email, balance, registration date, and account status.
2. WHEN an admin enters a search term, THE Admin_Panel SHALL filter the player list to profiles whose username or email contains the search term, returning results within 500ms.
3. WHEN an admin selects a player, THE Admin_Panel SHALL display the player's profile including: current balance, total lifetime bets, total lifetime wins, total lifetime losses, and a paginated session history.
4. WHEN a `super_admin` or `support_agent` submits a balance adjustment with a valid amount and reason, THE Admin_Panel SHALL update the player's balance in the `profiles` table and record the action in the Audit_Logger.
5. IF a balance adjustment would result in a negative balance, THEN THE Admin_Panel SHALL reject the adjustment and display a validation error.
6. WHEN a `super_admin` or `support_agent` suspends a player account, THE Admin_Panel SHALL set the player's `account_status` to `suspended`, terminate any active sessions for that player, and record the action in the Audit_Logger.
7. WHEN a `super_admin` bans a player account, THE Admin_Panel SHALL set the player's `account_status` to `banned` and record the action in the Audit_Logger.
8. WHEN a `super_admin` or `support_agent` triggers a password reset for a player, THE Admin_Panel SHALL send a Supabase password-reset email to the player's registered address and record the action in the Audit_Logger.
9. THE Admin_Panel SHALL display a paginated activity log for each player showing action type, timestamp, and associated metadata.
10. THE User Management section SHALL be accessible to admins with roles `super_admin` and `support_agent` only.

---

### Requirement 4: Finance and Payments (M-Pesa)

**User Story:** As a Finance Admin or Super Admin, I want to monitor and manage all financial transactions, so that I can ensure payment integrity and resolve issues promptly.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a paginated transaction list with columns for transaction ID, player username, amount, type (deposit/withdrawal), status (pending/success/failed), M-Pesa receipt number, and timestamp.
2. WHEN an admin applies date-range or status filters, THE Admin_Panel SHALL update the transaction list to show only matching records within 500ms.
3. THE Admin_Panel SHALL display the STK_Push status and callback log for each M-Pesa transaction.
4. WHEN a `finance_admin` or `super_admin` approves a pending withdrawal, THE Admin_Panel SHALL update the transaction status to `approved`, trigger the M-Pesa payout flow, and record the action in the Audit_Logger.
5. WHEN a `finance_admin` or `super_admin` rejects a pending withdrawal, THE Admin_Panel SHALL update the transaction status to `rejected`, restore the player's reserved balance, and record the action in the Audit_Logger.
6. WHEN a `finance_admin` or `super_admin` retries a failed M-Pesa transaction, THE Admin_Panel SHALL re-initiate the STK_Push and record the retry attempt in the Audit_Logger.
7. WHEN an admin requests a financial report export, THE Admin_Panel SHALL generate and download a CSV file containing all transactions matching the current filters within 5 seconds.
8. THE Finance section SHALL be accessible to admins with roles `super_admin` and `finance_admin` only.

---

### Requirement 5: Game Management

**User Story:** As a Game Manager or Super Admin, I want to configure and control individual games, so that I can manage the game catalogue and betting parameters.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a list of all games with their current enabled/disabled status, minimum bet, maximum bet, payout multiplier, and volatility level.
2. WHEN a `game_manager` or `super_admin` toggles a game's enabled status, THE Admin_Panel SHALL update the game's status in the database and record the action in the Audit_Logger.
3. WHEN a `game_manager` or `super_admin` submits updated game configuration (min/max bet, payout multipliers, volatility), THE Admin_Panel SHALL validate that `min_bet` is greater than 0, `max_bet` is greater than `min_bet`, and payout multipliers are positive, then persist the changes and record the action in the Audit_Logger.
4. IF game configuration validation fails, THEN THE Admin_Panel SHALL display field-level validation errors and SHALL NOT persist the changes.
5. THE Admin_Panel SHALL display a live tables management section showing all tables with their name, dealer name, max players, and current status.
6. WHEN a `game_manager` or `super_admin` creates a new live table with a name, dealer name, and max players value, THE Admin_Panel SHALL persist the table record and record the action in the Audit_Logger.
7. WHEN a `game_manager` or `super_admin` edits an existing live table's configuration, THE Admin_Panel SHALL persist the updated record and record the action in the Audit_Logger.
8. THE Game Management section SHALL be accessible to admins with roles `super_admin` and `game_manager` only.

---

### Requirement 6: RTP Control Panel

**User Story:** As a Game Manager or Super Admin, I want to monitor and adjust the platform's Return-to-Player settings, so that I can maintain regulatory compliance and profitability targets.

#### Acceptance Criteria

1. THE RTP_Controller SHALL display the current `targetRTP`, `currentRTP`, and Deviation percentage, refreshed at intervals of no more than 10 seconds.
2. WHEN a `game_manager` or `super_admin` submits a new `targetRTP` value, THE RTP_Controller SHALL validate that the value is between 85% and 99% inclusive, persist the change, and record the action in the Audit_Logger.
3. IF the submitted `targetRTP` is outside the range 85%–99%, THEN THE RTP_Controller SHALL reject the change and display a validation error.
4. WHEN a `game_manager` or `super_admin` submits a new adjustment strength value, THE RTP_Controller SHALL validate that the value is between 0.1% and 10% inclusive, persist the change, and record the action in the Audit_Logger.
5. IF the submitted adjustment strength is outside the range 0.1%–10%, THEN THE RTP_Controller SHALL reject the change and display a validation error.
6. THE RTP_Controller SHALL display a paginated historical log of all RTP changes including the previous value, new value, admin who made the change, and timestamp.
7. THE RTP Control Panel SHALL be accessible to admins with roles `super_admin` and `game_manager` only.

---

### Requirement 7: Jackpot Management

**User Story:** As a Game Manager or Super Admin, I want to view and configure jackpot pools, so that I can control jackpot growth, payouts, and resets.

#### Acceptance Criteria

1. THE Jackpot_Manager SHALL display all jackpot pools (Mega, Daily, Hourly) with their current amount, base amount, contribution rate, trigger probability, last win timestamp, and last reset timestamp.
2. WHEN a `game_manager` or `super_admin` submits updated jackpot configuration (base amount, contribution rate, trigger probability), THE Jackpot_Manager SHALL validate that base amount is greater than 0, contribution rate is between 0.001 and 0.1 inclusive, and trigger probability is between 0.000001 and 0.01 inclusive, then persist the changes and record the action in the Audit_Logger.
3. IF jackpot configuration validation fails, THEN THE Jackpot_Manager SHALL display field-level validation errors and SHALL NOT persist the changes.
4. WHEN a `super_admin` triggers a force reset on a jackpot pool, THE Jackpot_Manager SHALL reset the pool's `current_amount` to its `base_amount`, record the reset event in `jackpot_wins` with a zero winner, and record the action in the Audit_Logger.
5. THE Jackpot_Manager SHALL display a line chart showing the growth of each jackpot pool's `current_amount` over the last 7 days.
6. THE Jackpot_Manager SHALL display a paginated winner history showing jackpot ID, winner username, amount won, and timestamp.
7. THE Jackpot Management section SHALL be accessible to admins with roles `super_admin` and `game_manager` only.

---

### Requirement 8: Live Tables Monitoring

**User Story:** As a Game Manager or Super Admin, I want real-time visibility and control over active live tables, so that I can ensure smooth game operations.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display all active live tables with their current player count, round status, and total bets for the current round, refreshed at intervals of no more than 5 seconds.
2. WHEN a `game_manager` or `super_admin` pauses a live table, THE Admin_Panel SHALL set the table's status to `paused`, prevent new bets from being placed, and record the action in the Audit_Logger.
3. WHEN a `game_manager` or `super_admin` resumes a paused live table, THE Admin_Panel SHALL set the table's status to `active` and record the action in the Audit_Logger.
4. WHEN a `game_manager` or `super_admin` kicks an inactive player from a table, THE Admin_Panel SHALL remove the player from the table session and record the action in the Audit_Logger.
5. WHEN a `game_manager` or `super_admin` restarts a game round on a live table, THE Admin_Panel SHALL reset the current round state, refund all bets placed in the current round to the respective players, and record the action in the Audit_Logger.
6. THE Live Tables Monitoring section SHALL be accessible to admins with roles `super_admin` and `game_manager` only.

---

### Requirement 9: Analytics and Reporting

**User Story:** As a Finance Admin or Super Admin, I want detailed analytics and exportable reports, so that I can make data-driven business decisions.

#### Acceptance Criteria

1. THE Admin_Panel SHALL provide a revenue report view showing total revenue, total deposits, total withdrawals, and net profit, filterable by date range and game type.
2. THE Admin_Panel SHALL provide an RTP report view showing average RTP, minimum RTP, maximum RTP, and RTP Deviation over a selected date range.
3. THE Admin_Panel SHALL provide a player behaviour analytics view showing new registrations, active players, average session duration, and average bet size, filterable by date range and player segment.
4. THE Admin_Panel SHALL provide a game performance stats view showing total bets, total payouts, RTP, and player count per game, filterable by date range.
5. WHEN an admin requests a report export, THE Admin_Panel SHALL generate and download a CSV file containing the data matching the current filters within 5 seconds.
6. THE Analytics section SHALL be accessible to admins with roles `super_admin` and `finance_admin` only.

---

### Requirement 10: Fraud and Risk Management

**User Story:** As a Super Admin, I want automated detection of suspicious player behaviour, so that I can protect the platform from exploitation and fraud.

#### Acceptance Criteria

1. THE Fraud_Detector SHALL flag a player when the player places more than 20 bets within any 60-second window where each bet exceeds KES 5,000.
2. THE Fraud_Detector SHALL flag a player when the player's win rate exceeds 80% over any 50-bet rolling window.
3. WHEN a player is flagged by the Fraud_Detector, THE Admin_Panel SHALL display a fraud alert in the Dashboard alerts panel and in the player's profile.
4. WHEN a `super_admin` applies an auto-limit to a flagged player, THE Admin_Panel SHALL cap the player's maximum bet at KES 1,000 and record the action in the Audit_Logger.
5. WHEN a `super_admin` dismisses a fraud flag, THE Admin_Panel SHALL remove the flag from the alerts panel and record the dismissal in the Audit_Logger.
6. THE Fraud and Risk Management section SHALL be accessible to admins with role `super_admin` only.

---

### Requirement 11: Audit Logs

**User Story:** As a Super Admin, I want a complete, tamper-evident log of all admin actions, so that I can maintain accountability and support compliance audits.

#### Acceptance Criteria

1. THE Audit_Logger SHALL record every admin action with the following fields: `id`, `admin_id`, `admin_role`, `action_type`, `target_entity`, `target_id`, `previous_value`, `new_value`, `ip_address`, and `created_at`.
2. THE Admin_Panel SHALL display a paginated audit log view showing all recorded actions, filterable by admin ID, action type, and date range.
3. WHEN an admin applies filters to the audit log, THE Admin_Panel SHALL return matching records within 500ms.
4. THE Audit_Logger SHALL record entries for the following action types: `balance_adjust`, `user_suspend`, `user_ban`, `password_reset`, `withdrawal_approve`, `withdrawal_reject`, `payment_retry`, `game_toggle`, `game_config_update`, `table_create`, `table_edit`, `rtp_update`, `jackpot_config_update`, `jackpot_force_reset`, `table_pause`, `table_resume`, `player_kick`, `round_restart`, `bet_limit_apply`, `fraud_flag_dismiss`.
5. THE Audit_Logger records SHALL be immutable — no admin role SHALL have permission to delete or modify audit log entries.
6. THE Audit Logs section SHALL be accessible to admins with role `super_admin` only.

---

### Requirement 12: Admin Panel UI/UX

**User Story:** As any admin role, I want a consistent, readable, and responsive interface, so that I can operate the panel efficiently across devices.

#### Acceptance Criteria

1. THE Admin_Panel SHALL render in dark mode with neon yellow (`#FFE600`) and neon purple (`#A855F7`) accent colours consistent with the Neon Noir Casino theme.
2. THE Admin_Panel SHALL use glassmorphism-style cards (semi-transparent background, backdrop blur, subtle border) for metric panels and modal dialogs.
3. THE Admin_Panel SHALL include a persistent sidebar navigation listing all sections accessible to the current admin's role.
4. THE Admin_Panel SHALL include a topbar displaying the current admin's username, role badge, a notifications bell showing unread alert count, and a sign-out button.
5. WHEN the viewport width is less than 768px, THE Admin_Panel SHALL collapse the sidebar into a hamburger menu and maintain full functionality.
6. THE Admin_Panel SHALL display all tabular data in sortable, filterable data tables with pagination controls showing page number and total record count.
7. WHEN an admin performs a destructive action (ban, force reset, round restart), THE Admin_Panel SHALL display a confirmation modal dialog before executing the action.
8. THE Admin_Panel SHALL display a loading skeleton while asynchronous data is being fetched.
9. WHEN an asynchronous operation fails, THE Admin_Panel SHALL display a toast notification with a descriptive error message.
