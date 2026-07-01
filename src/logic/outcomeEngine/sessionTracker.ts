/**
 * Session Tracker
 * Per-table session stats for RTP balancing and streak compensation.
 * Each table gets its own tracker instance via createSessionTracker().
 */

export interface SessionStats {
  totalBet: number;
  totalPayout: number;
  roundCount: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  lastBigWinRound: number;
  recentResults: boolean[];  // rolling window: true=win, false=loss/push
}

export interface SessionTracker {
  record: (bet: number, payout: number, isBigWin?: boolean) => void;
  getStats: () => Readonly<SessionStats>;
  getCurrentRTP: () => number;
  getWinRateLastN: (n: number) => number;
  reset: () => void;
}

function freshState(): SessionStats {
  return {
    totalBet: 0,
    totalPayout: 0,
    roundCount: 0,
    consecutiveWins: 0,
    consecutiveLosses: 0,
    lastBigWinRound: -20,
    recentResults: [],
  };
}

/** Create an isolated session tracker (one per table instance) */
export function createSessionTracker(): SessionTracker {
  let state = freshState();

  return {
    record(bet, payout, isBigWin = false) {
      state.totalBet += bet;
      state.totalPayout += payout;
      state.roundCount++;

      const won = payout > bet;
      const push = payout === bet;

      // Rolling window (last 50 rounds max)
      state.recentResults.push(won);
      if (state.recentResults.length > 50) state.recentResults.shift();

      if (won) {
        state.consecutiveWins++;
        state.consecutiveLosses = 0;
        if (isBigWin) state.lastBigWinRound = state.roundCount;
      } else if (!push) {
        state.consecutiveLosses++;
        state.consecutiveWins = 0;
      } else {
        state.consecutiveWins = 0;
        state.consecutiveLosses = 0;
      }
    },

    getStats() {
      return { ...state, recentResults: [...state.recentResults] };
    },

    getCurrentRTP() {
      return state.totalBet > 0 ? state.totalPayout / state.totalBet : 0;
    },

    /** Win rate over last N rounds (0–1) */
    getWinRateLastN(n: number) {
      const window = state.recentResults.slice(-n);
      if (window.length === 0) return 0;
      return window.filter(Boolean).length / window.length;
    },

    reset() {
      state = freshState();
    },
  };
}

// Global fallback tracker (used when no per-table tracker is provided)
export const globalTracker = createSessionTracker();
