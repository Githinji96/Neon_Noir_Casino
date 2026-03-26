/**
 * Session Tracker
 * Tracks per-session stats used by the RTP balancer and streak compensator.
 * Shared across all live table rounds in a session.
 */

export interface SessionStats {
  totalBet: number;
  totalPayout: number;
  roundCount: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  lastBigWinRound: number;
}

const _state: SessionStats = {
  totalBet: 0,
  totalPayout: 0,
  roundCount: 0,
  consecutiveWins: 0,
  consecutiveLosses: 0,
  lastBigWinRound: -20,
};

export function recordRound(bet: number, payout: number, isBigWin = false): void {
  _state.totalBet += bet;
  _state.totalPayout += payout;
  _state.roundCount++;

  if (payout > bet) {
    _state.consecutiveWins++;
    _state.consecutiveLosses = 0;
    if (isBigWin) _state.lastBigWinRound = _state.roundCount;
  } else if (payout < bet) {
    _state.consecutiveLosses++;
    _state.consecutiveWins = 0;
  } else {
    // push — reset both streaks
    _state.consecutiveWins = 0;
    _state.consecutiveLosses = 0;
  }
}

export function getSessionStats(): Readonly<SessionStats> {
  return { ..._state };
}

export function getCurrentRTP(): number {
  return _state.totalBet > 0 ? _state.totalPayout / _state.totalBet : 0;
}

export function resetSession(): void {
  Object.assign(_state, {
    totalBet: 0, totalPayout: 0, roundCount: 0,
    consecutiveWins: 0, consecutiveLosses: 0, lastBigWinRound: -20,
  });
}
