import { create } from 'zustand';
import { type SpinGrid, generateSpin, setActiveGame } from '../logic/rng';
import { type WinResult, evaluatePaylines } from '../logic/paylines';
import { calculatePayout, calculateScatterPayout } from '../logic/payout';
import { recordSpin, getSessionStats, setActiveGameRTP } from '../logic/rtpController';
import { DEFAULT_BET } from '../config/betLadder';
import { GAME_CONFIG } from '../config/gameConfig';
import { getSymbolsForGame } from '../config/symbols';
import { JACKPOT_GAME_IDS } from '../config/mockData';
import { useJackpotStore } from './jackpotStore';
import { supabase } from '../lib/supabase';

// Lazy ref to authStore to avoid circular dependency
let _getAuthUser: (() => string | null) | null = null;
export function setAuthUserGetter(fn: () => string | null) { _getAuthUser = fn; }

/** Resolve the current user ID.
 *  Primary: use the registered getter (set by authStore.init).
 *  Fallback: read directly from the supabase session cache — handles the
 *  first-spin race where init() hasn't finished registering the getter yet.
 */
async function resolveUserId(): Promise<string | null> {
  // Fast path — getter already registered
  if (_getAuthUser) {
    const id = _getAuthUser();
    if (id) return id;
  }
  // Slow path — read session directly (only on first spin before init completes)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

// Flag: true while apply_spin_result is in-flight.
// refreshBalance checks this so it never clobbers optimistic spin state
// with a stale DB value that arrived before the RPC completed.
let _spinPending = false;
export function isSpinPending() { return _spinPending; }

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
  balance: 0.00,
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

    // Disable the button IMMEDIATELY before any computation so the UI responds
    // to the click right away instead of waiting for all the sync work below.
    set({ isSpinning: true });

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

    // Near-miss detection — only on jackpot games, only on non-winning spins,
    // only after jackpot win check (jackpotWinAmount === 0 guards against
    // showing "near miss" when the player actually won the jackpot)
    if (!isFreeSpins && jackpotWinAmount === 0 && JACKPOT_GAME_IDS.has(state.activeGameId)) {
      import('../logic/nearMissDetector').then(({ detectNearMiss }) => {
        import('./nearMissStore').then(({ useNearMissStore }) => {
          const nearMissStore = useNearMissStore.getState();
          nearMissStore.recordJackpotBet();

          // Only evaluate if the player is eligible (cooldowns satisfied)
          if (!nearMissStore.isEligible()) return;

          const result = detectNearMiss(grid, state.activeGameId);
          if (result.isNearMiss) {
            nearMissStore.showNotification(result.message, result.gameName);
            nearMissStore.logEvent({
              gameId: state.activeGameId,
              jackpotSymbol: result.jackpotSymbol ?? '',
              matchedPositions: result.matchedPositions,
              requiredPositions: result.requiredPositions,
              timestamp: Date.now(),
            });
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

      // Capture values now before async work begins
      const betSnapshot    = state.bet;
      const gameIdSnapshot = state.activeGameId;

      // Run all async DB work in a self-contained async block so spin() stays sync
      void (async () => {
        const userId = await resolveUserId();
        if (!userId) return;

        // Also register the getter lazily so future spins use the fast path
        if (!_getAuthUser) {
          _getAuthUser = () => userId;
        }

        // Block refreshBalance from clobbering our optimistic balance update
        _spinPending = true;

        // Apply spin result via SECURITY DEFINER RPC
        const { data, error } = await supabase.rpc('apply_spin_result', {
          p_user_id: userId,
          p_bet:     betSnapshot,
          p_payout:  totalPayout,
        });

        _spinPending = false;

        if (error) {
          console.warn('[gameStore] apply_spin_result failed:', error.message);
        } else if (data && typeof data === 'object' && 'balance' in data) {
          const serverBalance = Number((data as { balance: number }).balance);
          if (Math.abs(serverBalance - newBalance) > 0.01) {
            useGameStore.setState({ balance: serverBalance });
            const { useAuthStore } = await import('./authStore');
            useAuthStore.setState((s) => ({
              profile: s.profile ? { ...s.profile, balance: serverBalance } : null,
            }));
          }
        }

        // Award VIP points
        const { useVIPStore } = await import('./vipStore');
        useVIPStore.getState().awardPoints(userId, betSnapshot, 'bet');
        if (totalPayout < betSnapshot) {
          useVIPStore.getState().recordLoss(userId, betSnapshot - totalPayout);
        }

        // Persist spin record for financial reporting
        const { error: spinErr } = await supabase.from('spins').insert({
          user_id:      userId,
          game_id:      gameIdSnapshot,
          bet:          betSnapshot,
          payout:       totalPayout,
          is_free_spin: false,
        });
        if (spinErr) console.warn('[gameStore] spin insert failed:', spinErr.message, spinErr.code);
      })();
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

    // Keep authStore profile balance in sync so navbar shows correct value
    import('./authStore').then(({ useAuthStore }) => {
      useAuthStore.setState((s) => ({
        profile: s.profile ? { ...s.profile, balance: newBalance } : null,
      }));
    });
  },

  setBet: (direction) => {
    const { bet } = get();
    const MAX = 10_000; // bet cap — the balance check is handled by SPIN button disabled state
    if (direction === 'up') {
      set({ bet: Math.min(bet + 1, MAX) });
    } else {
      set({ bet: Math.max(bet - 1, 1) });
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
    // Cyber Strike 777 requires a fixed KES 100 bet when played in jackpot mode
    const fixedBet = jackpotMode && gameId === 'cyber-strike-777' ? { bet: 100 } : {};
    set({ activeGameId: gameId, jackpotMode, winResults: [], isSpinning: false, autoplay: false, reels: idleGrid, ...fixedBet });
  },
}));
