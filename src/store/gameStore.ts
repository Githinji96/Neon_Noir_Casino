import { create } from 'zustand';
import { type SpinGrid, generateSpin, setActiveGame } from '../logic/rng';
import { type WinResult, evaluatePaylines } from '../logic/paylines';
import { calculatePayout, calculateScatterPayout } from '../logic/payout';
import { recordSpin, getSessionStats, setActiveGameRTP } from '../logic/rtpController';
import { BET_LADDER, DEFAULT_BET } from '../config/betLadder';
import { GAME_CONFIG } from '../config/gameConfig';
import { getSymbolsForGame } from '../config/symbols';
import { JACKPOT_GAME_IDS } from '../config/mockData';
import { useJackpotStore } from './jackpotStore';
import { supabase } from '../lib/supabase';

// Lazy ref to authStore to avoid circular dependency
let _getAuthUser: (() => string | null) | null = null;
export function setAuthUserGetter(fn: () => string | null) { _getAuthUser = fn; }

interface GameState {
  balance: number;
  bet: number;
  reels: SpinGrid;
  freeSpinsRemaining: number;
  freeSpinsTotalWin: number;
  lastWin: number;
  isSpinning: boolean;
  autoplay: boolean;
  turboMode: boolean;
  soundEnabled: boolean;
  isPaytableOpen: boolean;
  winResults: WinResult[];
  triggerFreeSpins: boolean;
  isJackpot: boolean;
  sessionRTP: number;
  activeGameId: string;
  jackpotMode: boolean;

  spin: () => void;
  setBet: (direction: 'up' | 'down') => void;
  setGame: (gameId: string, jackpotMode?: boolean) => void;
  toggleAutoplay: () => void;
  toggleTurboMode: () => void;
  toggleSound: () => void;
  openPaytable: () => void;
  closePaytable: () => void;
  setSpinning: (value: boolean) => void;
  clearWinResults: () => void;
  endFreeSpins: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  balance: 1000.00,
  bet: DEFAULT_BET,
  reels: Array.from({ length: 5 }, () => Array(3).fill('bell')) as SpinGrid, // safe initial grid, replaced on first spin
  freeSpinsRemaining: 0,
  freeSpinsTotalWin: 0,
  lastWin: 0,
  isSpinning: false,
  autoplay: false,
  turboMode: false,
  soundEnabled: true,
  isPaytableOpen: false,
  winResults: [],
  triggerFreeSpins: false,
  isJackpot: false,
  sessionRTP: 0,
  activeGameId: 'cyber-strike-777',
  jackpotMode: false,

  spin: () => {
    const state = get();
    if (state.isSpinning) return;
    if (state.balance < state.bet && state.freeSpinsRemaining === 0) return;

    const isFreeSpins = state.freeSpinsRemaining > 0;
    let newBalance = state.balance;
    let newFreeSpinsRemaining = state.freeSpinsRemaining;
    let newFreeSpinsTotalWin = state.freeSpinsTotalWin;

    // Deduct bet or consume free spin
    if (!isFreeSpins) {
      newBalance = Math.round((newBalance - state.bet) * 100) / 100;
    } else {
      newFreeSpinsRemaining -= 1;
    }

    // Contribute to progressive jackpots + check trigger via engine
    let jackpotWinAmount = 0;
    if (!isFreeSpins) {
      const userId = _getAuthUser ? _getAuthUser() : null;
      const stats = getSessionStats();
      const jackpotWin = useJackpotStore.getState().processSpin({
        betAmount: state.bet,
        consecutiveLosses: stats.consecutiveLosses,
        sessionRTP: stats.totalBet > 0 ? stats.totalPayout / stats.totalBet : 0,
        totalSessionBet: stats.totalBet,
        userId,
        activeGameId: state.activeGameId,
        jackpotMode: state.jackpotMode,
      });
      if (jackpotWin) {
        jackpotWinAmount = jackpotWin.amount;
      }
    }

    // Generate grid + evaluate
    const grid = generateSpin();
    const { wins, scatterCount, triggerFreeSpins } = evaluatePaylines(grid);

    // Near-miss detection (only on jackpot-linked games, only on losing spins)
    // Only check for near-misses when the active game is jackpot-enabled or jackpotMode is true
    if (!isFreeSpins && jackpotWinAmount === 0 && (state.jackpotMode || JACKPOT_GAME_IDS.has(state.activeGameId))) {
      import('../logic/nearMissDetector').then(({ detectNearMiss }) => {
        import('./nearMissStore').then(({ useNearMissStore }) => {
          const nearMissStore = useNearMissStore.getState();
          nearMissStore.recordJackpotBet();
          const result = detectNearMiss(grid);
          if (result.isNearMiss) {
            nearMissStore.showNotification(result.message);
          }
        });
      });
    }

    // Calculate payouts
    const linePayout = calculatePayout(wins, state.bet, isFreeSpins);
    const scatterPayout = calculateScatterPayout(scatterCount, state.bet);
    let totalPayout = linePayout + scatterPayout + jackpotWinAmount;

    newBalance = Math.round((newBalance + totalPayout) * 100) / 100;

    // Accumulate free spins total win
    if (isFreeSpins) {
      newFreeSpinsTotalWin = Math.round((newFreeSpinsTotalWin + totalPayout) * 100) / 100;
    }

    // Trigger free spins (only if not already in free spins)
    let finalFreeSpinsRemaining = newFreeSpinsRemaining;
    let finalFreeSpinsTotalWin = newFreeSpinsTotalWin;
    if (triggerFreeSpins && !isFreeSpins) {
      finalFreeSpinsRemaining = GAME_CONFIG.freeSpinsCount;
      finalFreeSpinsTotalWin = 0;
    }

    // Record to RTP controller (only real bets, not free spins)
    if (!isFreeSpins) {
      recordSpin(state.bet, totalPayout);

      const userId = _getAuthUser ? _getAuthUser() : null;
      if (userId) {
        // Award VIP points (fire and forget)
        import('./vipStore').then(({ useVIPStore }) => {
          useVIPStore.getState().awardPoints(userId, state.bet, 'bet');
          if (totalPayout < state.bet) {
            useVIPStore.getState().recordLoss(userId, state.bet - totalPayout);
          }
        });

        // Fire-and-forget: persist spin to Supabase for real GGR/RTP analytics
        supabase.from('spins').insert({
          user_id: userId,
          game_id: state.activeGameId,
          bet: state.bet,
          payout: totalPayout,
          is_free_spin: false,
        }).then(({ error }) => {
          if (error && import.meta.env.DEV) {
            console.warn('[gameStore] spin insert failed:', error.message);
          }
        });
      }
    }

    const stats = getSessionStats();

    // Disable autoplay if balance depleted
    const newAutoplay = state.autoplay && newBalance >= state.bet;

    if (import.meta.env.DEV) {
      console.log('[Spin]', {
        wins: wins.length,
        totalPayout,
        jackpotWin: jackpotWinAmount > 0,
        scatterCount,
        sessionRTP: `${stats.currentRTP}%`,
        consecutiveLosses: stats.consecutiveLosses,
      });
    }

    set({
      isSpinning: true,
      balance: newBalance,
      reels: grid,
      winResults: wins,
      lastWin: totalPayout,
      freeSpinsRemaining: finalFreeSpinsRemaining,
      freeSpinsTotalWin: finalFreeSpinsTotalWin,
      triggerFreeSpins,
      autoplay: newAutoplay,
      isJackpot: jackpotWinAmount > 0,
      sessionRTP: stats.currentRTP,
    });
  },

  setBet: (direction) => {
    const { bet } = get();
    const currentIndex = BET_LADDER.indexOf(bet);
    const index = currentIndex === -1 ? BET_LADDER.indexOf(DEFAULT_BET) : currentIndex;
    if (direction === 'up') {
      set({ bet: BET_LADDER[Math.min(index + 1, BET_LADDER.length - 1)] });
    } else {
      set({ bet: BET_LADDER[Math.max(index - 1, 0)] });
    }
  },

  toggleAutoplay: () => set((s: GameState) => ({ autoplay: !s.autoplay })),
  toggleTurboMode: () => set((s: GameState) => ({ turboMode: !s.turboMode })),
  toggleSound: () => set((s: GameState) => ({ soundEnabled: !s.soundEnabled })),
  openPaytable: () => set({ isPaytableOpen: true }),
  closePaytable: () => set({ isPaytableOpen: false }),
  setSpinning: (value: boolean) => set({ isSpinning: value }),
  clearWinResults: () => set({ winResults: [] }),
  endFreeSpins: () => set({ freeSpinsRemaining: 0, freeSpinsTotalWin: 0 }),
  setGame: (gameId: string, jackpotMode = false) => {
    setActiveGame(gameId);
    setActiveGameRTP(gameId);
    const syms = getSymbolsForGame(gameId);
    const firstSym = syms[0]?.id ?? 'cherry';
    const idleGrid = Array.from({ length: 5 }, () => Array(3).fill(firstSym)) as SpinGrid;
    set({ activeGameId: gameId, jackpotMode, winResults: [], isSpinning: false, autoplay: false, reels: idleGrid });
  },
}));
