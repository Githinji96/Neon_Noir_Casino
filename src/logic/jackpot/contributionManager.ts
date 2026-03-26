/**
 * Contribution Manager
 * Calculates how much each spin contributes to each jackpot pool.
 * Caps per-spin contribution to prevent abuse on large bets.
 */

import type { JackpotConfig } from './jackpotConfig';

export interface ContributionResult {
  jackpotId: string;
  contribution: number;
}

/**
 * Calculate contributions for all jackpots from a single bet.
 * Returns array of { jackpotId, contribution } — only non-zero entries.
 */
export function calculateContributions(
  betAmount: number,
  configs: JackpotConfig[]
): ContributionResult[] {
  return configs.map((cfg) => {
    const raw = betAmount * cfg.contributionRate;
    const contribution = Math.min(raw, cfg.maxContributionPerSpin);
    return { jackpotId: cfg.id, contribution: Math.round(contribution * 100) / 100 };
  });
}
