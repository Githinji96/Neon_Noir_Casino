/**
 * RTP Balancer
 * Computes a probability adjustment delta based on:
 * 1. Session RTP vs target (primary correction)
 * 2. Rolling win rate over last N rounds (variance control)
 * 3. Consecutive streak compensation (soft, bounded)
 * 4. Post-big-win suppression
 *
 * Returns delta in [-maxAdj, +maxAdj] to add to base win probability.
 * Positive = player wins more (RTP below target).
 * Negative = player wins less (RTP above target / winning too often).
 *
 * IMPORTANT: This adjusts probabilities, NOT outcomes directly.
 * All outcomes are still RNG-driven.
 */

import type { OutcomeConfig } from './outcomeConfig';
import type { SessionTracker } from './sessionTracker';

export function computeProbabilityDelta(
  config: OutcomeConfig,
  tracker: SessionTracker
): number {
  const stats = tracker.getStats();

  // Not enough data — no adjustment
  if (stats.totalBet < 20) return 0;

  const currentRTP = tracker.getCurrentRTP();
  const diff = config.targetRTP - currentRTP; // positive = under-paying

  // Primary RTP correction: 1% gap → 0.6% probability shift (was 0.4)
  let delta = diff * 0.6;

  // ── Rolling win rate suppression ──────────────────────────────────────────
  const winRate = tracker.getWinRateLastN(config.winRateWindow);
  if (winRate > config.winRateThreshold) {
    // Each 5% above threshold → 2.5% probability reduction (was 1%)
    const excess = winRate - config.winRateThreshold;
    delta -= excess * 0.50;
  } else if (winRate < 0.25 && stats.roundCount > 10) {
    // Very cold streak → small fairness boost
    delta += 0.012;
  }

  // ── Streak compensation ───────────────────────────────────────────────────
  const threshold = config.sessionStreakThreshold;
  if (stats.consecutiveLosses >= threshold * 2) {
    delta += 0.018;  // long losing streak → modest boost (was 0.025)
  } else if (stats.consecutiveLosses >= threshold) {
    delta += 0.008;
  } else if (stats.consecutiveWins >= threshold * 2) {
    delta -= 0.050;  // long winning streak → hard suppress (was 0.030)
  } else if (stats.consecutiveWins >= threshold) {
    delta -= 0.030;  // was 0.018
  }

  // ── Post-big-win suppression ──────────────────────────────────────────────
  const roundsSinceBigWin = stats.roundCount - stats.lastBigWinRound;
  if (roundsSinceBigWin < 4) {
    delta = Math.min(delta, -0.050);  // was -0.025
  } else if (roundsSinceBigWin < 8) {
    delta = Math.min(delta, -0.025);  // was -0.010
  }

  // ── Hard clamp ────────────────────────────────────────────────────────────
  return Math.max(-config.maxRTPAdjustment, Math.min(config.maxRTPAdjustment, delta));
}
