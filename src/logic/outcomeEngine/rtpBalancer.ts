/**
 * RTP Balancer
 * Computes a probability adjustment factor based on current vs target RTP.
 * Adjustments are capped at ±maxRTPAdjustment to preserve randomness perception.
 *
 * Returns a delta in [-maxAdj, +maxAdj] to add to base win probability.
 * Positive delta → player wins more often (RTP below target).
 * Negative delta → player wins less often (RTP above target).
 */

import type { OutcomeConfig } from './outcomeConfig';
import { getCurrentRTP, getSessionStats } from './sessionTracker';

export function computeProbabilityDelta(config: OutcomeConfig): number {
  const stats = getSessionStats();

  // Not enough data yet — no adjustment
  if (stats.totalBet < 50) return 0;

  const currentRTP = getCurrentRTP();
  const diff = config.targetRTP - currentRTP; // positive = under-paying

  // Scale: 1% RTP gap → 0.5% probability shift (very subtle)
  let delta = diff * 0.5;

  // Hard clamp to configured max
  delta = Math.max(-config.maxRTPAdjustment, Math.min(config.maxRTPAdjustment, delta));

  // Streak compensation (soft, max ±2%)
  const streakDelta = computeStreakDelta(config);
  delta = Math.max(-config.maxRTPAdjustment, Math.min(config.maxRTPAdjustment, delta + streakDelta));

  // Suppress wins briefly after a big win
  const roundsSinceBigWin = stats.roundCount - stats.lastBigWinRound;
  if (roundsSinceBigWin < 3) {
    delta = Math.min(delta, -0.02); // suppress for 3 rounds after big win
  }

  return delta;
}

function computeStreakDelta(config: OutcomeConfig): number {
  const { consecutiveLosses, consecutiveWins } = getSessionStats();
  const threshold = config.sessionStreakThreshold;

  if (consecutiveLosses >= threshold * 2) return 0.03;  // long losing streak → small boost
  if (consecutiveLosses >= threshold)     return 0.015;
  if (consecutiveWins >= threshold * 2)   return -0.03; // long winning streak → small suppress
  if (consecutiveWins >= threshold)       return -0.015;

  return 0;
}
