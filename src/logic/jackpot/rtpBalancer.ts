/**
 * RTP Balancer
 * Tracks jackpot-specific RTP contribution and exposes
 * a session RTP fraction used by the trigger engine.
 */

import { JACKPOT_RTP_SHARE } from './jackpotConfig';

interface JackpotRTPState {
  totalBet: number;
  totalJackpotPayout: number;
}

const _state: JackpotRTPState = {
  totalBet: 0,
  totalJackpotPayout: 0,
};

/** Record a bet and optional jackpot payout for RTP tracking */
export function recordJackpotSpin(bet: number, jackpotPayout = 0): void {
  _state.totalBet += bet;
  _state.totalJackpotPayout += jackpotPayout;
}

/**
 * Returns the current jackpot RTP as a fraction.
 * e.g. 0.03 means jackpots have paid back 3% of total bets.
 */
export function getJackpotRTP(): number {
  if (_state.totalBet === 0) return 0;
  return _state.totalJackpotPayout / _state.totalBet;
}

/**
 * Returns how far jackpot RTP is from its target share.
 * Positive = under-paying (boost triggers), Negative = over-paying (suppress).
 */
export function getJackpotRTPDeviation(): number {
  return JACKPOT_RTP_SHARE - getJackpotRTP();
}

export function resetJackpotRTP(): void {
  _state.totalBet = 0;
  _state.totalJackpotPayout = 0;
}

export function getJackpotRTPStats() {
  return {
    totalBet: _state.totalBet,
    totalJackpotPayout: _state.totalJackpotPayout,
    jackpotRTP: _state.totalBet > 0
      ? Math.round((_state.totalJackpotPayout / _state.totalBet) * 10000) / 100
      : 0,
    targetShare: Math.round(JACKPOT_RTP_SHARE * 10000) / 100,
  };
}
