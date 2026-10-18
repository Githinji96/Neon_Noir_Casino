/**
 * Risk Engine — Heuristic Rules
 *
 * 10 rules across 3 categories (Fraud, RG, Account).
 * Each rule evaluates PlayerFeatures and returns points + an optional signal.
 * Sub-scores are capped at 100 in riskEngine.ts.
 */
import type { PlayerFeatures, RuleResult } from './types';

// ── Fraud Risk Rules (4) ──────────────────────────────────────────────────────

/** Rule F1: 5+ deposits in any 30-minute window */
export function rapidDepositRule(f: PlayerFeatures): RuleResult {
  if (f.rapidDeposits >= 5) {
    return {
      points: 30,
      signal: {
        description: `${f.rapidDeposits} deposits detected within a 30-minute window`,
        category: 'fraud',
        severity: 'high',
        points: 30,
      },
    };
  }
  return { points: 0, signal: null };
}

/** Rule F2: Withdrawal within 10 minutes of a deposit */
export function withdrawalVelocityRule(f: PlayerFeatures): RuleResult {
  if (f.withdrawalAfterDeposit) {
    return {
      points: 25,
      signal: {
        description: 'Withdrawal made within 10 minutes of a deposit',
        category: 'fraud',
        severity: 'high',
        points: 25,
      },
    };
  }
  return { points: 0, signal: null };
}

/** Rule F3: Win rate >80% over a 50-bet rolling window */
export function winRateAnomalyRule(f: PlayerFeatures): RuleResult {
  if (f.winLossPattern.includes('win_rate_')) {
    return {
      points: 25,
      signal: {
        description: `Abnormal win rate detected: ${f.winLossPattern.replace('win_rate_', '').replace('_over_50', '')} over 50 bets`,
        category: 'fraud',
        severity: 'medium',
        points: 25,
      },
    };
  }
  return { points: 0, signal: null };
}

/** Rule F4: Bet velocity >2x historical baseline */
export function betVelocityRule(f: PlayerFeatures): RuleResult {
  if (f.historicalAvgBet > 0 && f.betVelocity > 0 && f.averageBet > f.historicalAvgBet * 2) {
    return {
      points: 20,
      signal: {
        description: `Betting velocity significantly above baseline (${Math.round(f.averageBet / f.historicalAvgBet)}x normal)`,
        category: 'fraud',
        severity: 'medium',
        points: 20,
      },
    };
  }
  return { points: 0, signal: null };
}

// ── Responsible Gaming Risk Rules (3) ─────────────────────────────────────────

/** Rule RG1: More than 10 deposits within 24 hours */
export function depositFrequencyRule(f: PlayerFeatures): RuleResult {
  if (f.depositFrequency > 10) {
    return {
      points: 30,
      signal: {
        description: `High deposit frequency: ${Math.round(f.depositFrequency)} deposits per day`,
        category: 'rg',
        severity: 'high',
        points: 30,
      },
    };
  }
  return { points: 0, signal: null };
}

/** Rule RG2: Session duration exceeds 4 hours */
export function sessionDurationRule(f: PlayerFeatures): RuleResult {
  if (f.sessionDuration > 4) {
    return {
      points: 25,
      signal: {
        description: `Extended session duration: ${f.sessionDuration.toFixed(1)} hours`,
        category: 'rg',
        severity: 'medium',
        points: 25,
      },
    };
  }
  return { points: 0, signal: null };
}

/** Rule RG3: Average bet increased ≥50% after a losing session */
export function lossChasingRule(f: PlayerFeatures): RuleResult {
  if (f.recentLossSession && f.betIncreaseAfterLoss >= 50) {
    return {
      points: 25,
      signal: {
        description: `Loss-chasing behaviour: bet size increased ${Math.round(f.betIncreaseAfterLoss)}% after a losing session`,
        category: 'rg',
        severity: 'medium',
        points: 25,
      },
    };
  }
  return { points: 0, signal: null };
}

// ── Account Risk Rules (3) ────────────────────────────────────────────────────

/** Rule A1: Login from a new/different device */
export function deviceChangeRule(f: PlayerFeatures): RuleResult {
  if (f.deviceChanges > 0) {
    return {
      points: 25,
      signal: {
        description: `New device detected (${f.deviceChanges} device ${f.deviceChanges === 1 ? 'change' : 'changes'})`,
        category: 'account',
        severity: 'medium',
        points: 25,
      },
    };
  }
  return { points: 0, signal: null };
}

/** Rule A2: Login frequency >20 logins within 24 hours */
export function loginFrequencyRule(f: PlayerFeatures): RuleResult {
  if (f.loginFrequency > 20) {
    return {
      points: 25,
      signal: {
        description: `Abnormal login frequency: ${Math.round(f.loginFrequency)} logins per day`,
        category: 'account',
        severity: 'medium',
        points: 25,
      },
    };
  }
  return { points: 0, signal: null };
}

/** Rule A3: Player has entries in withdrawal_fraud_logs */
export function fraudLogRule(f: PlayerFeatures): RuleResult {
  if (f.fraudLogCount > 0) {
    return {
      points: 30,
      signal: {
        description: `${f.fraudLogCount} recorded fraud attempt${f.fraudLogCount === 1 ? '' : 's'} on this account`,
        category: 'account',
        severity: 'high',
        points: 30,
      },
    };
  }
  return { points: 0, signal: null };
}

/** All fraud rules in evaluation order */
export const FRAUD_RULES = [
  rapidDepositRule,
  withdrawalVelocityRule,
  winRateAnomalyRule,
  betVelocityRule,
];

/** All RG rules in evaluation order */
export const RG_RULES = [
  depositFrequencyRule,
  sessionDurationRule,
  lossChasingRule,
];

/** All Account rules in evaluation order */
export const ACCOUNT_RULES = [
  deviceChangeRule,
  loginFrequencyRule,
  fraudLogRule,
];
