/**
 * RTP Controller — tracks session stats and returns a bias factor
 * to softly nudge outcomes toward the target RTP.
 *
 * bias > 1.0 → increase win probability
 * bias < 1.0 → decrease win probability (more dead spins)
 */

import { GAME_CONFIG } from '../config/gameConfig';

interface RTPState {
  totalBet: number;
  totalPayout: number;
  spinCount: number;
  consecutiveLosses: number;
  lastBigWinSpin: number;
}

const state: RTPState = {
  totalBet: 0,
  totalPayout: 0,
  spinCount: 0,
  consecutiveLosses: 0,
  lastBigWinSpin: -50,
};

export function recordSpin(bet: number, payout: number): void {
  state.totalBet += bet;
  state.totalPayout += payout;
  state.spinCount++;

  if (payout === 0) {
    state.consecutiveLosses++;
  } else {
    state.consecutiveLosses = 0;
    if (payout >= bet * 20) {
      state.lastBigWinSpin = state.spinCount;
    }
  }
}

export function getWinBias(): number {
  if (state.totalBet === 0) return 1.0;

  const currentRTP = state.totalPayout / state.totalBet;
  const target = GAME_CONFIG.targetRTP;
  const diff = target - currentRTP;

  // Base RTP correction: ±30% max nudge
  let bias = 1.0 + diff * 3.0;
  bias = Math.max(0.4, Math.min(1.8, bias));

  // After long losing streak → boost win chance
  if (state.consecutiveLosses >= 12) {
    bias = Math.min(bias * 1.4, 2.0);
  } else if (state.consecutiveLosses >= 7) {
    bias = Math.min(bias * 1.2, 1.8);
  }

  // After big win → suppress wins for a few spins
  const spinsSinceBigWin = state.spinCount - state.lastBigWinSpin;
  if (spinsSinceBigWin < 5) {
    bias *= 0.5;
  } else if (spinsSinceBigWin < 10) {
    bias *= 0.75;
  }

  return bias;
}

export function getSessionStats() {
  return {
    spinCount: state.spinCount,
    totalBet: state.totalBet,
    totalPayout: state.totalPayout,
    currentRTP: state.totalBet > 0
      ? Math.round((state.totalPayout / state.totalBet) * 1000) / 10
      : 0,
    consecutiveLosses: state.consecutiveLosses,
  };
}

export function resetSession(): void {
  state.totalBet = 0;
  state.totalPayout = 0;
  state.spinCount = 0;
  state.consecutiveLosses = 0;
  state.lastBigWinSpin = -50;
}
