/**
 * Jackpot State
 * Derives the current state of a jackpot based on pool amount and config.
 *
 * BUILDING → pool < minimumThreshold (cannot trigger)
 * ACTIVE   → pool >= minimumThreshold (can trigger)
 * WON      → currently locked after a win (cooldown window)
 */

import type { JackpotConfig } from './jackpotConfig';

export type JackpotState = 'BUILDING' | 'ACTIVE' | 'WON';

export function getJackpotState(
  cfg: JackpotConfig,
  currentAmount: number,
  lastWinTimestamp: number
): JackpotState {
  const now = Date.now();
  // In cooldown window after a win
  if (lastWinTimestamp > 0 && now - lastWinTimestamp < cfg.cooldownMs) {
    return 'WON';
  }
  // Below minimum threshold
  if (currentAmount < cfg.minimumThreshold) {
    return 'BUILDING';
  }
  return 'ACTIVE';
}

export function getProgressToThreshold(cfg: JackpotConfig, currentAmount: number): number {
  if (currentAmount >= cfg.minimumThreshold) return 100;
  return Math.min(100, (currentAmount / cfg.minimumThreshold) * 100);
}
