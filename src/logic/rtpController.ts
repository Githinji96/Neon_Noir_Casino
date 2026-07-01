/**
 * RTP Controller — tracks session stats and returns a bias factor
 * to softly nudge outcomes toward the target RTP.
 *
 * bias > 1.0 → increase win probability
 * bias < 1.0 → decrease win probability (more dead spins)
 */

import { getBaseRTPForGame } from '../config/gameConfig';

interface RTPState {
  totalBet: number;
  totalPayout: number;
  spinCount: number;
  consecutiveLosses: number;
  lastBigWinSpin: number;
  activeGameId: string;
}

const state: RTPState = {
  totalBet: 0,
  totalPayout: 0,
  spinCount: 0,
  consecutiveLosses: 0,
  lastBigWinSpin: -50,
  activeGameId: 'cyber-strike-777',
};

export function setActiveGameRTP(gameId: string): void {
  state.activeGameId = gameId;
}

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
  const target = getBaseRTPForGame(state.activeGameId);
  const diff = target - currentRTP;

  // Base RTP correction: ±20% max nudge (tighter than before)
  let bias = 1.0 + diff * 2.5;
  bias = Math.max(0.5, Math.min(1.5, bias));

  // After long losing streak → modest boost (was too aggressive at 1.4×)
  if (state.consecutiveLosses >= 12) {
    bias = Math.min(bias * 1.2, 1.5);
  } else if (state.consecutiveLosses >= 7) {
    bias = Math.min(bias * 1.1, 1.4);
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
