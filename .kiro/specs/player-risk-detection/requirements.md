# Requirements Document

## Introduction

This feature introduces an AI-powered Player Risk & Fraud Detection Engine for the Neon Noir Casino admin panel. The engine analyzes player activity from existing data sources (spins, transactions, profiles, player stats) using a rules-based/heuristic scoring model. For each player, the engine produces an overall risk score from 0 to 100 with three sub-scores: Fraud Risk, Responsible Gaming (RG) Risk, and Account Risk. The engine also generates descriptive risk signals and recommended actions, which are surfaced to admins through the existing Fraud & Risk admin page and the admin alerts system.

The engine does NOT modify existing casino game logic, betting logic, jackpot logic, wallet/balance calculations, or the Neon Noir color scheme. It is a read-only analysis and reporting layer that consumes existing data and presents risk assessments to authorized administrators.

## Glossary

- **Risk_Engine**: The rules-based/heuristic scoring system that analyzes player behavior data and produces a Risk_Assessment.
- **Risk_Assessment**: The complete output object produced by the Risk_Engine for a single player, containing the overall Risk_Score, three Sub_Scores, a list of Risk_Signals, and a Recommended_Action.
- **Risk_Score**: An integer from 0 to 100 representing the overall risk level of a player, where 0 indicates no risk and 100 indicates maximum risk.
- **Sub_Score**: An integer from 0 to 100 representing risk within a specific category. The three Sub_Scores are Fraud_Risk, RG_Risk, and Account_Risk.
- **Fraud_Risk**: The Sub_Score measuring the likelihood of fraudulent activity, derived from transaction patterns, deposit/withdrawal velocity, and betting anomalies.
- **RG_Risk**: The Sub_Score measuring Responsible Gaming risk, derived from deposit frequency, session duration, chase-betting patterns, and loss-chasing behavior.
- **Account_Risk**: The Sub_Score measuring account-level risk, derived from device changes, login frequency, account status, and withdrawal fraud logs.
- **Risk_Signal**: A human-readable string describing a specific detected risk indicator, such as "8 deposits within 30 minutes" or "New device detected."
- **Risk_Level**: A categorical label derived from the Risk_Score: LOW (0-29), MEDIUM (30-59), HIGH (60-84), or CRITICAL (85-100).
- **Recommended_Action**: A suggested admin action string derived from the Risk_Level and Sub_Scores, such as "Review account" or "Suspend pending review."
- **Feature_Extractor**: The component within the Risk_Engine that queries and aggregates player data from spins, transactions, profiles, and player_stats tables into a structured Player_Features object.
- **Player_Features**: The structured input to the scoring rules, containing fields such as deposit_frequency, withdrawal_frequency, average_bet, bet_velocity, session_duration, number_of_sessions, win_loss_pattern, device_changes, login_frequency, and transaction_frequency.
- **Admin_Panel**: The existing React-based admin interface in the Neon Noir Casino application, accessible to users with admin_role.
- **Fraud_Page**: The existing admin page at `/admin/fraud` that displays fraud flags and risk information.
- **Admin_Alert**: An entry in the admin_alerts table surfaced to admins via the admin alerts panel and realtime subscription.
- **Admin_Store**: The existing Zustand store (`adminStore.ts`) that manages admin session state, alerts, and audit logging.
- **Heuristic_Rule**: A single scoring rule within the Risk_Engine that evaluates one or more Player_Features and contributes points to one or more Sub_Scores.
- **Risk_Assessment_Store**: A new Zustand store that manages the state of risk assessments displayed in the Admin_Panel, including the list of assessed players, selected player detail, loading states, and refresh control.

## Requirements

### Requirement 1: Feature Extraction from Player Data

**User Story:** As an admin, I want the Risk_Engine to extract behavioral features from existing player data, so that risk scoring can be performed without manual data collection.

#### Acceptance Criteria

1. WHEN a risk assessment is requested for a player, THE Feature_Extractor SHALL query the spins table for that player's bet and payout records within the assessment lookback window.
2. WHEN a risk assessment is requested for a player, THE Feature_Extractor SHALL query the transactions table for that player's deposit and withdrawal records within the assessment lookback window.
3. WHEN a risk assessment is requested for a player, THE Feature_Extractor SHALL query the profiles table for that player's account status, phone verification status, and registration date.
4. WHEN a risk assessment is requested for a player, THE Feature_Extractor SHALL query the player_stats table for that player's cumulative betting and win statistics.
5. WHEN a risk assessment is requested for a player, THE Feature_Extractor SHALL query the withdrawal_fraud_logs table for that player's recorded fraud attempts.
6. THE Feature_Extractor SHALL produce a Player_Features object containing deposit_frequency, withdrawal_frequency, average_bet, bet_velocity, session_duration, number_of_sessions, win_loss_pattern, device_changes, login_frequency, and transaction_frequency.
7. WHEN a player has no activity records within the lookback window, THE Feature_Extractor SHALL return a Player_Features object with all numeric fields set to zero and all pattern fields set to empty.

### Requirement 2: Risk Score Calculation

**User Story:** As an admin, I want the Risk_Engine to calculate an overall risk score and three sub-scores, so that I can understand the type and severity of risk for each player.

#### Acceptance Criteria

1. THE Risk_Engine SHALL calculate a Fraud_Risk Sub_Score as an integer from 0 to 100 using Heuristic_Rules that evaluate deposit patterns, withdrawal velocity relative to deposits, transaction frequency anomalies, and win/loss pattern inconsistencies.
2. THE Risk_Engine SHALL calculate an RG_Risk Sub_Score as an integer from 0 to 100 using Heuristic_Rules that evaluate deposit frequency, session duration, number_of_sessions, average_bet relative to historical baseline, and loss-chasing behavior.
3. THE Risk_Engine SHALL calculate an Account_Risk Sub_Score as an integer from 0 to 100 using Heuristic_Rules that evaluate device_changes, login_frequency anomalies, account status, and withdrawal_fraud_logs entries.
4. THE Risk_Engine SHALL calculate the overall Risk_Score as an integer from 0 to 100 derived from a weighted combination of the three Sub_Scores, where Fraud_Risk carries the highest weight, RG_Risk carries a moderate weight, and Account_Risk carries a moderate weight.
5. THE Risk_Engine SHALL ensure that the overall Risk_Score never falls below 0 and never exceeds 100 for any combination of Sub_Scores.
6. THE Risk_Engine SHALL map the overall Risk_Score to a Risk_Level using the thresholds: LOW for 0 to 29, MEDIUM for 30 to 59, HIGH for 60 to 84, and CRITICAL for 85 to 100.

### Requirement 3: Risk Signal Generation

**User Story:** As an admin, I want the Risk_Engine to generate descriptive risk signals, so that I can understand the specific behaviors contributing to a player's risk score.

#### Acceptance Criteria

1. WHEN a Heuristic_Rule contributes points to any Sub_Score, THE Risk_Engine SHALL generate a Risk_Signal containing a human-readable description of the detected behavior.
2. THE Risk_Engine SHALL include in each Risk_Signal a category field identifying whether the signal relates to Fraud_Risk, RG_Risk, or Account_Risk.
3. THE Risk_Engine SHALL include in each Risk_Signal a severity field with the value "high," "medium," or "low" indicating the relative importance of that signal.
4. WHEN a player has multiple contributing Heuristic_Rules, THE Risk_Engine SHALL generate a separate Risk_Signal for each triggered rule.
5. WHEN no Heuristic_Rules are triggered for a player, THE Risk_Engine SHALL produce an empty list of Risk_Signals.
6. THE Risk_Engine SHALL sort Risk_Signals by severity in descending order, with "high" severity signals appearing before "medium" and "low" severity signals.

### Requirement 4: Recommended Action Generation

**User Story:** As an admin, I want the Risk_Engine to recommend an action for each assessed player, so that I can take appropriate intervention steps based on risk level.

#### Acceptance Criteria

1. WHEN the Risk_Level is LOW, THE Risk_Engine SHALL set the Recommended_Action to "No action required."
2. WHEN the Risk_Level is MEDIUM, THE Risk_Engine SHALL set the Recommended_Action to "Monitor activity."
3. WHEN the Risk_Level is HIGH, THE Risk_Engine SHALL set the Recommended_Action to "Review account."
4. WHEN the Risk_Level is CRITICAL, THE Risk_Engine SHALL set the Recommended_Action to "Suspend pending review."
5. WHEN the Fraud_Risk Sub_Score is 80 or above and the Risk_Level is HIGH, THE Risk_Engine SHALL override the Recommended_Action to "Investigate fraud."
6. WHEN the RG_Risk Sub_Score is 80 or above and the Risk_Level is HIGH, THE Risk_Engine SHALL override the Recommended_Action to "Apply RG limits."

### Requirement 5: Risk Assessment Data Persistence

**User Story:** As an admin, I want risk assessments to be stored in the database, so that historical assessments can be reviewed and compared over time.

#### Acceptance Criteria

1. WHEN a risk assessment is completed for a player, THE Risk_Engine SHALL persist the Risk_Assessment to a risk_assessments table in Supabase.
2. THE risk_assessments table SHALL store the player's user_id, overall Risk_Score, Fraud_Risk Sub_Score, RG_Risk Sub_Score, Account_Risk Sub_Score, Risk_Level, Risk_Signals as JSON, Recommended_Action, and the assessment timestamp.
3. THE risk_assessments table SHALL enforce row-level security so that only authenticated users with an admin_role can read risk assessment records.
4. THE risk_assessments table SHALL NOT allow direct writes from non-admin authenticated users.
5. WHEN a risk assessment is persisted, THE Risk_Engine SHALL store the Player_Features used to compute the assessment as a JSON metadata field for auditability.
6. WHEN the Player_Features metadata cannot be stored as valid JSON during persistence, THE Risk_Engine SHALL reject and roll back the entire persistence operation so that no partial risk_assessments record is saved.

### Requirement 6: Admin Alerts for High-Risk Players

**User Story:** As an admin, I want to receive alerts when a player is assessed as high or critical risk, so that I can respond promptly to potential fraud or responsible gaming issues.

#### Acceptance Criteria

1. WHEN a risk assessment produces a Risk_Level of HIGH, THE Risk_Engine SHALL insert an Admin_Alert with type "fraud_flag," severity "high," and a message containing the player identifier and Risk_Score.
2. WHEN a risk assessment produces a Risk_Level of CRITICAL, THE Risk_Engine SHALL insert an Admin_Alert with type "fraud_flag," severity "high," and a message containing the player identifier, Risk_Score, and Recommended_Action.
3. WHEN a risk assessment produces a Risk_Level of LOW or MEDIUM, THE Risk_Engine SHALL NOT insert an Admin_Alert.
4. WHEN an Admin_Alert already exists for a player with the same risk level within the last 24 hours, THE Risk_Engine SHALL NOT insert a duplicate Admin_Alert.
5. THE Admin_Alert metadata SHALL contain the Risk_Score, all three Sub_Scores, and the player's user_id.
6. WHEN the Risk_Engine inserts an Admin_Alert, THE Admin_Store realtime subscription SHALL surface the alert to all connected admin sessions.

### Requirement 7: Fraud Page Integration

**User Story:** As an admin, I want the Fraud_Page to display risk assessments alongside existing fraud flags, so that I have a unified view of player risk.

#### Acceptance Criteria

1. THE Fraud_Page SHALL display a risk assessment summary panel showing the count of players at each Risk_Level (LOW, MEDIUM, HIGH, CRITICAL).
2. THE Fraud_Page SHALL display a sortable, searchable table of assessed players with columns for player username, Risk_Score, Risk_Level, Fraud_Risk Sub_Score, RG_Risk Sub_Score, Account_Risk Sub_Score, and assessment timestamp.
3. WHEN an admin clicks a player row in the risk assessment table, THE Fraud_Page SHALL navigate to a risk detail view showing the full Risk_Assessment including all Risk_Signals and the Recommended_Action.
4. THE Fraud_Page SHALL use the existing DataTable, StatCard, and LoadingSkeleton admin components for consistent styling.
5. THE Fraud_Page SHALL maintain the existing Neon Noir color scheme and visual design without introducing new color palettes.
6. THE Fraud_Page SHALL display existing fraud flags in a separate section from risk assessments, preserving the current fraud flag management interface.

### Requirement 8: Risk Assessment Store

**User Story:** As an admin, I want the Admin_Panel to manage risk assessment state through a dedicated store, so that risk data loading, refresh, and selection are handled consistently.

#### Acceptance Criteria

1. THE Risk_Assessment_Store SHALL be a Zustand store that manages the list of recent risk assessments, the selected player's detailed Risk_Assessment, loading state, and error state.
2. WHEN the Fraud_Page loads, THE Risk_Assessment_Store SHALL fetch the list of recent risk assessments from the risk_assessments table.
3. WHEN an admin selects a player for detailed review, THE Risk_Assessment_Store SHALL fetch the full Risk_Assessment including Risk_Signals for that player.
4. WHEN a risk assessment fetch encounters an error, THE Risk_Assessment_Store SHALL set an error state with a descriptive message, SHALL retain any previously loaded list and detail data for continued display, and SHALL NOT crash the Admin_Panel.
5. THE Risk_Assessment_Store SHALL provide a refresh action that re-fetches the risk assessment list and the currently selected player detail.

### Requirement 9: On-Demand and Batch Assessment

**User Story:** As an admin, I want to trigger risk assessments on-demand for individual players and in batch for all active players, so that I can assess specific suspicious players and maintain ongoing monitoring.

#### Acceptance Criteria

1. WHEN an admin requests a risk assessment for a specific player, THE Risk_Engine SHALL execute the Feature_Extractor, scoring rules, signal generation, and recommended action generation for that player and return the complete Risk_Assessment.
2. WHEN an admin triggers a batch assessment, THE Risk_Engine SHALL query all players with activity in the lookback window and produce a Risk_Assessment for each player.
3. WHEN a batch assessment is in progress, THE Risk_Engine SHALL process players sequentially and SHALL update the Risk_Assessment_Store with each completed assessment.
4. WHEN a batch assessment encounters an error for one player, THE Risk_Engine SHALL log the error and SHALL halt batch processing if the error logging itself fails, preventing remaining players from being processed until the log write succeeds.
5. THE Risk_Engine SHALL use a SECURITY DEFINER RPC function for batch assessment execution to ensure the database queries run with elevated privileges for cross-table aggregation.

### Requirement 10: Risk Assessment Audit Trail

**User Story:** As an admin, I want risk assessment actions to be logged in the audit trail, so that I can track when and by whom assessments were triggered.

#### Acceptance Criteria

1. WHEN an admin triggers an on-demand risk assessment, THE Admin_Store SHALL record an audit log entry with action_type "risk_assessment_manual" and target_id set to the assessed player's user_id.
2. WHEN an admin triggers a batch risk assessment, THE Admin_Store SHALL record an audit log entry with action_type "risk_assessment_batch" and target_entity "batch."
3. WHEN the Risk_Engine generates an Admin_Alert for a high-risk player, THE Admin_Store SHALL record an audit log entry with action_type "risk_alert_generated" and metadata containing the Risk_Score and Risk_Level.
4. THE audit log entries for risk assessments SHALL include the admin_id, admin_role, timestamp, and relevant target identifiers.

### Requirement 11: Heuristic Rule Definitions

**User Story:** As an admin, I want the Risk_Engine to use specific, documented heuristic rules, so that risk scoring is transparent and consistent.

#### Acceptance Criteria

1. THE Risk_Engine SHALL include a Fraud_Risk heuristic rule that evaluates rapid deposit patterns, adding points to the Fraud_Risk Sub_Score if and only if a player makes 5 or more deposits within a 30-minute window, and adding zero points when the deposit count in that window is fewer than 5.
2. THE Risk_Engine SHALL include a Fraud_Risk heuristic rule that evaluates withdrawal velocity relative to deposits, adding points to the Fraud_Risk Sub_Score when a player makes a withdrawal within 10 minutes of a deposit.
3. THE Risk_Engine SHALL include a Fraud_Risk heuristic rule that evaluates win/loss pattern anomalies, adding points to the Fraud_Risk Sub_Score when a player's win rate exceeds 80% over a 50-bet rolling window.
4. THE Risk_Engine SHALL include a Fraud_Risk heuristic rule that evaluates bet velocity, adding points to the Fraud_Risk Sub_Score when a player's bet velocity exceeds twice their historical baseline.
5. THE Risk_Engine SHALL include an RG_Risk heuristic rule that evaluates deposit frequency, adding points to the RG_Risk Sub_Score when a player makes more than 10 deposits within 24 hours.
6. THE Risk_Engine SHALL include an RG_Risk heuristic rule that evaluates session duration, adding points to the RG_Risk Sub_Score when a player's session duration exceeds 4 hours.
7. THE Risk_Engine SHALL include an RG_Risk heuristic rule that evaluates loss-chasing behavior, adding points to the RG_Risk Sub_Score if and only if a player increases their average bet by 50% or more after a losing session, and adding zero points when the increase is below 50%.
8. THE Risk_Engine SHALL include an Account_Risk heuristic rule that evaluates device changes, adding points to the Account_Risk Sub_Score when a player logs in from a new device.
9. THE Risk_Engine SHALL include an Account_Risk heuristic rule that evaluates login frequency anomalies, adding points to the Account_Risk Sub_Score when a player's login frequency exceeds 20 logins within 24 hours.
10. THE Risk_Engine SHALL include an Account_Risk heuristic rule that evaluates withdrawal fraud logs, adding points to the Account_Risk Sub_Score when a player has one or more entries in the withdrawal_fraud_logs table.
11. THE Risk_Engine SHALL cap each Sub_Score at 100, ensuring that the sum of points from multiple Heuristic_Rules for a single category does not exceed 100.

### Requirement 12: Non-Modification of Existing Systems

**User Story:** As a developer, I want the Risk_Engine to operate as a read-only analysis layer, so that existing casino game logic, financial calculations, and player balances are not affected.

#### Acceptance Criteria

1. THE Risk_Engine SHALL NOT modify the spins table, transactions table, profiles balance column, player_stats table, jackpots table, or any existing game configuration tables.
2. THE Risk_Engine SHALL NOT modify the existing gameStore, authStore, jackpotStore, or any player-facing Zustand store logic.
3. THE Risk_Engine SHALL NOT introduce changes to the existing casino game logic, betting logic, RNG, payline evaluation, payout calculation, or jackpot trigger mechanisms.
4. THE Risk_Engine SHALL NOT alter the Neon Noir color scheme, CSS classes, or visual design system used in the Admin_Panel.
5. THE Risk_Engine SHALL NOT implement Playwright end-to-end tests.
6. THE Risk_Engine SHALL NOT depend on any external machine learning service, API, or third-party inference endpoint.
7. THE Risk_Engine SHALL use the existing Supabase client, Zustand store pattern, and React admin component architecture established in the codebase.

### Requirement 13: Risk Assessment Security

**User Story:** As an admin, I want risk assessment data and operations to be secured, so that only authorized administrators can access and trigger assessments.

#### Acceptance Criteria

1. THE risk_assessments table SHALL enforce row-level security allowing reads only by authenticated users whose admin_role is "super_admin" or "support_agent."
2. WHEN an on-demand or batch risk assessment is triggered, THE Risk_Engine SHALL verify that the requesting user has an admin_role of "super_admin" or "support_agent" before executing.
3. THE batch assessment RPC function SHALL be a SECURITY DEFINER function that checks the caller's admin_role using the existing get_my_admin_role helper before processing.
4. WHEN a non-admin user attempts to access risk assessment data, THE Supabase RLS policy SHALL deny the request and return no rows.
5. THE Risk_Engine SHALL NOT expose player personally identifiable information beyond username and user_id in the Admin_Panel risk displays.
