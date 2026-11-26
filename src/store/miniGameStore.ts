/**
 * Zustand store for Mini Jackpot Games feature.
 * Task 2.2 — Mini Jackpot Games spec
 */
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type {
  MiniGameId,
  MiniGameConfig,
  RoundPhase,
  CurrentRound,
  MiniGameHistoryEntry,
} from '../types/miniGames';

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_GAME_IDS: MiniGameId[] = [
  'lucky-wheel',
  'scratch-cards',
  'treasure-chest',
  'mini-slot',
  'mystery-multiplier',
  'crystal-match',
];

const initialConfigs = Object.fromEntries(
  ALL_GAME_IDS.map((id) => [id, null])
) as Record<MiniGameId, MiniGameConfig | null>;

const initialConfigErrors = Object.fromEntries(
  ALL_GAME_IDS.map((id) => [id, false])
) as Record<MiniGameId, boolean>;

const initialHistory = Object.fromEntries(
  ALL_GAME_IDS.map((id) => [id, [] as MiniGameHistoryEntry[]])
) as Record<MiniGameId, MiniGameHistoryEntry[]>;

// ── State interface ────────────────────────────────────────────────────────────

interface MiniGameState {
  // Config
  configs: Record<MiniGameId, MiniGameConfig | null>;
  configErrors: Record<MiniGameId, boolean>;
  configLoading: boolean;

  // Active game
  activeGame: MiniGameId | null;
  roundPhase: RoundPhase;
  currentRound: CurrentRound | null;
  roundError: string | null;

  // History (in-memory, loaded per game on open)
  gameHistory: Record<MiniGameId, MiniGameHistoryEntry[]>;

  // Actions
  loadConfigs: () => Promise<void>;
  subscribeToConfigUpdates: () => () => void;
  openGame: (gameId: MiniGameId) => void;
  closeGame: () => void;
  setBet: (stake: number) => void;
  submitRound: (userId: string, stake: number) => Promise<void>;
  initiateRound: (userId: string, stake: number) => Promise<void>;
  claimResult: (userId: string) => Promise<void>;
  loadHistory: (gameId: MiniGameId, userId: string) => Promise<void>;
  resetRound: () => void;
}

// ── Store ──────────────────────────────────────────────────────────────────────

export const useMiniGameStore = create<MiniGameState>()((set, get) => ({
  configs: initialConfigs,
  configErrors: initialConfigErrors,
  configLoading: false,
  activeGame: null,
  roundPhase: 'idle',
  currentRound: null,
  roundError: null,
  gameHistory: initialHistory,

  // ── loadConfigs ──────────────────────────────────────────────────────────────
  loadConfigs: async () => {
    const { configLoading, configs } = get();

    // Skip if already loading or if at least one config is already populated
    if (configLoading) return;
    const alreadyLoaded = ALL_GAME_IDS.some((id) => configs[id] !== null);
    if (alreadyLoaded) return;

    set({ configLoading: true });

    const { data, error } = await supabase
      .from('mini_game_config')
      .select('*');

    if (error) {
      // Table may not exist yet — treat as empty, not as an error blocking the UI.
      // Cards will still be clickable with COMING SOON state.
      if (import.meta.env.DEV) {
        console.warn('[MiniGameStore] loadConfigs failed (table may not exist yet):', error.message);
      }
      set({ configLoading: false });
      return;
    }

    // Build config record — null for any game not yet in the table
    const newConfigs = { ...initialConfigs };
    const newErrors = Object.fromEntries(
      ALL_GAME_IDS.map((id) => [id, false])
    ) as Record<MiniGameId, boolean>;

    if (data) {
      for (const row of data) {
        const gameId = row.game_id as MiniGameId;
        if (ALL_GAME_IDS.includes(gameId)) {
          newConfigs[gameId] = row as MiniGameConfig;
        }
      }
    }

    set({ configs: newConfigs, configErrors: newErrors, configLoading: false });
  },

  // ── subscribeToConfigUpdates ─────────────────────────────────────────────────
  subscribeToConfigUpdates: () => {
    const channel = supabase
      .channel('mini-game-config-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mini_game_config' },
        () => { void get().loadConfigs(); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mini_game_config' },
        () => { void get().loadConfigs(); }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  },

  // ── openGame ────────────────────────────────────────────────────────────────
  openGame: (gameId) => {
    set({
      activeGame: gameId,
      roundPhase: 'idle',
      currentRound: null,
      roundError: null,
    });
    window.history.pushState({ miniGame: gameId }, '');
  },

  // ── closeGame ───────────────────────────────────────────────────────────────
  closeGame: () => {
    set({
      activeGame: null,
      roundPhase: 'idle',
      currentRound: null,
      roundError: null,
    });

    window.history.back();
  },

  // ── setBet ───────────────────────────────────────────────────────────────────
  setBet: (stake) => {
    const { activeGame, currentRound, configs } = get();

    if (!activeGame) return;

    // Validate against config bounds if config is available
    const config = configs[activeGame];
    if (config) {
      if (stake < config.min_bet) {
        set({ roundError: `Min bet is KES ${config.min_bet}` });
        return;
      }
      if (stake > config.max_bet) {
        set({ roundError: `Max bet is KES ${config.max_bet}` });
        return;
      }
    }

    set({
      roundError: null,
      currentRound: currentRound
        ? { ...currentRound, stake }
        : {
            roundId: '',
            gameId: activeGame,
            stake,
            outcome: null,
            payout: null,
            idempotencyKey: '',
          },
    });
  },

  // ── submitRound ──────────────────────────────────────────────────────────────
  // Used by single-phase games: Lucky Wheel, Mini Slot, Mystery Multiplier, Crystal Match
  submitRound: async (userId, stake) => {
    const { activeGame } = get();
    if (!activeGame) return;

    if (!userId || userId.trim() === '') {
      set({ roundPhase: 'error', roundError: 'Not authenticated. Please log in and try again.' });
      return;
    }

    const idempotencyKey = crypto.randomUUID();

    set({
      roundPhase: 'processing',
      roundError: null,
      currentRound: {
        roundId: idempotencyKey,
        gameId: activeGame,
        stake,
        outcome: null,
        payout: null,
        idempotencyKey,
      },
    });

    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>(
      (resolve) => setTimeout(
        () => resolve({ data: null, error: { message: 'Request timed out. Please try again.' } }),
        15_000
      )
    );

    const rpcPromise = supabase.rpc('play_mini_game', {
      p_user_id:         userId,
      p_game_id:         activeGame,
      p_stake:           stake,
      p_idempotency_key: idempotencyKey,
    });

    const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);

    if (error) {
      if (import.meta.env.DEV) {
        console.error('[miniGameStore] submitRound RPC error:', error);
        supabase.auth.getSession().then(({ data: s }) => {
          console.log('[miniGameStore] auth session user:', s.session?.user?.id ?? 'NO SESSION');
        });
      }
      set({ roundPhase: 'error', roundError: error.message });
      return;
    }

    set((s) => ({
      roundPhase: 'result',
      currentRound: s.currentRound
        ? {
            ...s.currentRound,
            roundId: (data as { round_id: string }).round_id,
            outcome: (data as { outcome: unknown }).outcome,
            payout:  (data as { payout: number }).payout,
          }
        : null,
    }));

    try {
      const { useAuthStore } = await import('./authStore');
      await useAuthStore.getState().refreshBalance();
    } catch { /* best-effort */ }
  },

  // ── initiateRound ────────────────────────────────────────────────────────────
  // Phase 1 for two-phase games: Scratch Cards, Treasure Chest
  initiateRound: async (userId, stake) => {
    const { activeGame } = get();
    if (!activeGame) return;

    // Guard: never call the RPC with an empty/invalid userId
    if (!userId || userId.trim() === '') {
      set({ roundPhase: 'error', roundError: 'Not authenticated. Please log in and try again.' });
      return;
    }

    const idempotencyKey = crypto.randomUUID();

    set({
      roundPhase: 'processing',
      roundError: null,
      currentRound: {
        roundId: idempotencyKey,
        gameId: activeGame,
        stake,
        outcome: null,
        payout: null,
        idempotencyKey,
      },
    });

    // 15-second timeout — prevents the UI from hanging indefinitely if
    // the Supabase RPC stalls (cold start, network blip, rate limit).
    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>(
      (resolve) => setTimeout(
        () => resolve({ data: null, error: { message: 'Request timed out. Please try again.' } }),
        15_000
      )
    );

    const rpcPromise = supabase.rpc('initiate_mini_game', {
      p_game_id:         activeGame,
      p_idempotency_key: idempotencyKey,
      p_stake:           stake,
      p_user_id:         userId,
    });

    const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);

    if (error) {
      if (import.meta.env.DEV) console.error('[miniGameStore] initiateRound error:', error);
      set({ roundPhase: 'error', roundError: error.message });
      return;
    }
    set((s) => ({
      roundPhase: 'betting',
      currentRound: s.currentRound
        ? {
            ...s.currentRound,
            roundId: (data as { round_id: string }).round_id,
          }
        : null,
    }));
  },

  // ── claimResult ──────────────────────────────────────────────────────────────
  // Phase 2 for two-phase games: send player selection and get outcome
  claimResult: async (userId) => {
    const { currentRound, roundPhase } = get();

    if (currentRound === null || roundPhase !== 'betting') return;

    set({ roundPhase: 'processing' });

    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>(
      (resolve) => setTimeout(
        () => resolve({ data: null, error: { message: 'Request timed out. Please try again.' } }),
        15_000
      )
    );

    const rpcPromise = supabase.rpc('claim_mini_game_result', {
      p_user_id:   userId,
      p_round_id:  currentRound.roundId,
      p_selection: currentRound.outcome ?? {},
    });

    const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);

    if (error) {
      set({ roundPhase: 'error', roundError: error.message });
      return;
    }

    set((s) => ({
      roundPhase: 'result',
      currentRound: s.currentRound
        ? {
            ...s.currentRound,
            outcome: (data as { outcome: unknown }).outcome,
            payout:  (data as { payout: number }).payout,
          }
        : null,
    }));

    try {
      const { useAuthStore } = await import('./authStore');
      await useAuthStore.getState().refreshBalance();
    } catch { /* best-effort */ }
  },

  // ── loadHistory ──────────────────────────────────────────────────────────────
  loadHistory: async (gameId, userId) => {
    const { data, error } = await supabase.rpc('get_mini_game_history', {
      p_user_id: userId,
      p_game_id: gameId,
      p_limit: 20,
    });

    if (error || !data) {
      set((s) => ({
        gameHistory: { ...s.gameHistory, [gameId]: [] },
      }));
      return;
    }

    const entries: MiniGameHistoryEntry[] = (
      data as Array<{
        round_id: string;
        game_id: string;
        stake: number;
        payout: number;
        net_result: number;
        created_at: string;
      }>
    ).map((row) => ({
      roundId: row.round_id,
      gameId: row.game_id as MiniGameId,
      stake: row.stake,
      grossPayout: row.payout,
      netResult: row.net_result,
      timestamp: row.created_at,
    }));

    set((s) => ({
      gameHistory: { ...s.gameHistory, [gameId]: entries },
    }));
  },

  // ── resetRound ───────────────────────────────────────────────────────────────
  resetRound: () => {
    set({
      roundPhase: 'idle',
      currentRound: null,
      roundError: null,
    });
  },
}));
