/**
 * Trigger Engine
 * Dynamic probability system — adjusts trigger chance based on:
 * - Jackpot growth vs base (overgrowth → higher chance)
 * - Cooldown after recent win (suppresses re-trigger)
 * - RTP deviation (under-paying → boost; over-paying → suppress)
 * - Player losing streak (soft compensation)
 */

import type { JackpotConfig } from './jackpotConfig';
import { RTP_TARGET, JACKPOT_RTP_SHARE } from './jackpotConfig';

export interface TriggerContext {
  currentAmount: number;
  lastWinTimestamp: number;   // 0 = never won
  consecutiveLosses: number;
  sessionRTP: number;         // current session RTP as fraction (e.g. 0.94)
  totalSessionBet: number;
}

/**
 * Compute the effective trigger probability for a jackpot this spin.
 */
export function computeTriggerProbability(
  cfg: JackpotConfig,
  ctx: TriggerContext
): number {
  const now = Date.now();
  let p = cfg.baseProbability;

  // 1. Cooldown suppression — no trigger during cooldown window
  if (ctx.lastWinTimestamp > 0 && now - ctx.lastWinTimestamp < cfg.cooldownMs) {
    return 0;
  }

  // 2. Overgrowth boost — jackpot grown > 3× base → nudge probability up
  const growthRatio = ctx.currentAmount / cfg.baseAmount;
  if (growthRatio > 5) {
    p *= 2.0;
  } else if (growthRatio > 3) {
    p *= 1.5;
  } else if (growthRatio > 2) {
    p *= 1.2;
  }

  // 3. RTP balancing — if session RTP is below jackpot share target, boost
  if (ctx.totalSessionBet > 500) {
    const jackpotRTPTarget = RTP_TARGET * JACKPOT_RTP_SHARE;
    const rtpDiff = jackpotRTPTarget - ctx.sessionRTP;
    if (rtpDiff > 0.01) {
      p *= 1.3; // under-paying → boost
    } else if (rtpDiff < -0.01) {
      p *= 0.7; // over-paying → suppress
    }
  }

  // 4. Losing streak soft compensation
  if (ctx.consecutiveLosses >= 20) {
    p *= 1.25;
  } else if (ctx.consecutiveLosses >= 10) {
    p *= 1.1;
  }

  // 5. Clamp to configured bounds
  return Math.max(cfg.minProbability, Math.min(cfg.maxProbability, p));
}

/**
 * Run the RNG check — returns true if jackpot is triggered this spin.
 * Uses crypto.getRandomValues for secure randomness when available.
 */
export function rollTrigger(probability: number): boolean {
  if (probability <= 0) return false;
  const rng = secureRandom();
  return rng < probability;
}

/** Cryptographically secure random float in [0, 1) */
function secureRandom(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 0x100000000;
  }
  return Math.random();
}
