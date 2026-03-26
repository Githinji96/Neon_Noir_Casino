/**
 * Payout Manager
 * Handles jackpot win resolution:
 * - Locks jackpot to prevent double-payout (in-memory mutex)
 * - Calculates final payout amount
 * - Triggers reset via resetScheduler
 */

import type { JackpotConfig } from './jackpotConfig';

// In-memory lock set — jackpot IDs currently being paid out
const _lockedJackpots = new Set<string>();

export interface PayoutResult {
  jackpotId: string;
  amount: number;
  resetTo: number;
}

/**
 * Attempt to lock and pay out a jackpot.
 * Returns null if jackpot is already locked (race condition guard).
 */
export function attemptPayout(
  cfg: JackpotConfig,
  currentAmount: number
): PayoutResult | null {
  if (_lockedJackpots.has(cfg.id)) {
    // Already being paid — reject duplicate
    return null;
  }

  _lockedJackpots.add(cfg.id);

  const amount = Math.round(currentAmount * 100) / 100;
  const resetTo = computeResetAmount(cfg, amount);

  // Release lock after a short delay (allows state to propagate)
  setTimeout(() => _lockedJackpots.delete(cfg.id), 2000);

  return { jackpotId: cfg.id, amount, resetTo };
}

/**
 * Compute the amount the jackpot resets to after a win.
 * Mega jackpots retain a partial % of the won amount.
 */
function computeResetAmount(cfg: JackpotConfig, wonAmount: number): number {
  if (cfg.partialResetPct > 0) {
    const retained = wonAmount * cfg.partialResetPct;
    return Math.round(Math.max(cfg.seedAmount, retained) * 100) / 100;
  }
  return cfg.seedAmount;
}

/** Check if a jackpot is currently locked */
export function isLocked(jackpotId: string): boolean {
  return _lockedJackpots.has(jackpotId);
}
