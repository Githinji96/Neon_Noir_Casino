/**
 * Reset Scheduler
 * Determines whether a jackpot should auto-reset based on its type interval.
 * Called on every growth tick — returns new amount if reset needed, null otherwise.
 */

import type { JackpotConfig } from './jackpotConfig';

export interface ResetCheckResult {
  shouldReset: boolean;
  resetTo: number;
}

/**
 * Check if a time-based reset is due for this jackpot.
 */
export function checkScheduledReset(
  cfg: JackpotConfig,
  lastResetTimestamp: number
): ResetCheckResult {
  if (cfg.resetIntervalMs === Infinity) {
    return { shouldReset: false, resetTo: cfg.seedAmount };
  }

  const elapsed = Date.now() - lastResetTimestamp;
  if (elapsed >= cfg.resetIntervalMs) {
    return { shouldReset: true, resetTo: cfg.seedAmount };
  }

  return { shouldReset: false, resetTo: cfg.seedAmount };
}
