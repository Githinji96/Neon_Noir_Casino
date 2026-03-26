import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { JACKPOT_CONFIGS } from '../logic/jackpot/jackpotConfig';
import { jackpotEngine, type SpinInput } from '../logic/jackpot/jackpotEngine';

export type { JackpotType } from '../logic/jackpot/jackpotConfig';

export interface JackpotDisplay {
  id: string;
  name: string;
  type: string;
  currentAmount: number;
  tags: string[];
  gameId: string;
  gameTitle: string;
}

export interface JackpotWin {
  jackpotId: string;
  jackpotName: string;
  amount: number;
  timestamp: number;
}

export interface GlobalWinEvent {
  jackpotId: string;
  jackpotName: string;
  amount: number;
  winnerUsername: string | null;
  timestamp: number;
}

interface JackpotState {
  jackpots: JackpotDisplay[];
  recentWinner: JackpotWin | null;
  pendingWin: JackpotWin | null;
  globalWinEvent: GlobalWinEvent | null;

  processSpin: (input: SpinInput) => JackpotWin | null;
  clearPendingWin: () => void;
  clearGlobalWinEvent: () => void;
  syncFromSupabase: () => Promise<void>;
  startRealTimeGrowth: () => () => void;
  subscribeToWinBroadcasts: () => () => void;
  refreshDisplayAmounts: () => void;
}

const CHANNEL = 'jackpot-wins';

function buildDisplayList(): JackpotDisplay[] {
  return JACKPOT_CONFIGS.map((cfg) => ({
    id: cfg.id,
    name: cfg.name,
    type: cfg.type,
    currentAmount: jackpotEngine.getAmount(cfg.id),
    tags: cfg.tags,
    gameId: cfg.gameId,
    gameTitle: cfg.gameTitle,
  }));
}

export const useJackpotStore = create<JackpotState>((set) => ({
  jackpots: buildDisplayList(),
  recentWinner: null,
  pendingWin: null,
  globalWinEvent: null,

  processSpin: (input) => {
    const result = jackpotEngine.processSpin(input);
    set({ jackpots: buildDisplayList() });
    if (!result.win) return null;

    const win: JackpotWin = {
      jackpotId: result.win.jackpotId,
      jackpotName: result.win.jackpotName,
      amount: result.win.amount,
      timestamp: result.win.timestamp,
    };

    set({ recentWinner: win, pendingWin: win, jackpots: buildDisplayList() });

    // Persist + broadcast (fire and forget)
    (async () => {
      let winnerUsername: string | null = null;
      if (result.win!.userId) {
        await supabase.from('jackpot_wins').insert({
          user_id: result.win!.userId,
          jackpot_id: result.win!.jackpotId,
          amount: result.win!.amount,
        });
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', result.win!.userId)
          .single();
        winnerUsername = profile?.username ?? null;
      }

      // Broadcast to all connected clients
      await supabase.channel(CHANNEL).send({
        type: 'broadcast',
        event: 'jackpot_win',
        payload: {
          jackpotId: result.win!.jackpotId,
          jackpotName: result.win!.jackpotName,
          amount: result.win!.amount,
          winnerUsername,
          timestamp: result.win!.timestamp,
        } satisfies GlobalWinEvent,
      });
    })().catch((err) => {
      if (import.meta.env.DEV) console.error('[JackpotStore] broadcast error:', err);
    });

    return win;
  },

  clearPendingWin: () => set({ pendingWin: null }),
  clearGlobalWinEvent: () => set({ globalWinEvent: null }),
  refreshDisplayAmounts: () => set({ jackpots: buildDisplayList() }),

  syncFromSupabase: async () => {
    try {
      const { data } = await supabase.from('jackpots').select('id, current_amount');
      if (!data?.length) return;
      const amounts: Record<string, number> = {};
      for (const row of data) amounts[row.id] = row.current_amount;
      jackpotEngine.seedAmounts(amounts);
      set({ jackpots: buildDisplayList() });
    } catch {
      // Silently fail — local engine state is fine
    }
  },

  startRealTimeGrowth: () => {
    const interval = setInterval(() => {
      jackpotEngine.applyGrowthTick();
      set({ jackpots: buildDisplayList() });
    }, 120);
    return () => clearInterval(interval);
  },

  // Subscribe to win broadcasts from other players
  subscribeToWinBroadcasts: () => {
    const channel = supabase
      .channel(CHANNEL)
      .on('broadcast', { event: 'jackpot_win' }, ({ payload }) => {
        const event = payload as GlobalWinEvent;
        if (import.meta.env.DEV) console.log('[JackpotStore] win broadcast received:', event);
        set({ globalWinEvent: { ...event } });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },
}));
