/**
 * Risk Engine — Type Definitions
 *
 * Core interfaces for the Player Risk & Fraud Detection Engine.
 * These types are used by the feature extractor, risk rules, and risk engine
 * to produce a Risk Assessment for each player.
 */

/** Structured input extracted from player activity data. */
export interface PlayerFeatures {
  depositFrequency: number;       // deposits per 24h in lookback window
  withdrawalFrequency: number;     // withdrawals per 24h in lookback window
  averageBet: number;              // average bet amount in lookback window
  betVelocity: number;             // bets per minute (current session avg)
  sessionDuration: number;         // total session duration in hours
  numberOfSessions: number;        // count of distinct sessions
  winLossPattern: string;          // e.g. "win_rate_85pct_over_50" or ""
  deviceChanges: number;           // count of new device logins
  loginFrequency: number;          // logins per 24h
  transactionFrequency: number;    // total transactions per 24h
  rapidDeposits: number;           // max deposits in any 30-min window
  withdrawalAfterDeposit: boolean; // withdrawal within 10 min of a deposit
  fraudLogCount: number;            // entries in withdrawal_fraud_logs
  accountStatus: string;            // 'active' | 'suspended' | 'banned'
  historicalAvgBet: number;         // avg bet before lookback window (baseline)
  recentLossSession: boolean;      // had a losing session recently
  betIncreaseAfterLoss: number;    // % increase in avg bet after loss session (0 if none)
}

/** A single detected risk indicator with human-readable description. */
export interface RiskSignal {
  description: string;
  category: 'fraud' | 'rg' | 'account';
  severity: 'high' | 'medium' | 'low';
  points: number;
}

/** Complete risk evaluation output for a single player. */
export interface RiskAssessment {
  userId: string;
  overallScore: number;        // 0-100
  fraudRisk: number;           // 0-100
  rgRisk: number;              // 0-100
  accountRisk: number;         // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  signals: RiskSignal[];
  recommendedAction: string;
  features: PlayerFeatures;
  assessedAt: string;         // ISO timestamp
}

/** Result of evaluating a single heuristic rule. */
export interface RuleResult {
  points: number;
  signal: RiskSignal | null;
}

/** A heuristic rule function. */
export type RiskRule = (features: PlayerFeatures) => RuleResult;

/** Severity thresholds for risk signals (based on points contributed). */
export const SEVERITY_THRESHOLDS = {
  HIGH: 30,
  MEDIUM: 15,
  LOW: 1,
} as const;

/** Risk level thresholds for overall score. */
export const RISK_LEVEL_THRESHOLDS = {
  LOW: 0,
  MEDIUM: 30,
  HIGH: 60,
  CRITICAL: 85,
} as const;

/** Sub-score weights for overall score calculation. */
export const SCORE_WEIGHTS = {
  fraud: 0.50,
  rg: 0.30,
  account: 0.20,
} as const;
