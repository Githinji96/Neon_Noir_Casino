import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { JACKPOT_CONFIGS } from '../logic/jackpot/jackpotConfig';
import { jackpotEngine, type SpinInput } from '../logic/jackpot/jackpotEngine';
import { getJackpotState, getProgressToThreshold } from '../logic/jackpot/jackpotState';

export type { JackpotType } from '../logic/jackpot/jackpotConfig';

export interface JackpotDisplay {
  id: string;
  name: string;
  type: string;
  currentAmount: number;
  tags: string[];
  gameId: string;
  gameTitle: string;
  state: 'BUILDING' | 'ACTIVE' | 'WON';
  progressPct: number;  // 0-100 toward minimumThreshold
  minimumThreshold: number;
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
  subscribeToConfigChanges: () => () => void;
  startRealTimeGrowth: () => () => void;
  subscribeToWinBroadcasts: () => () => void;
  refreshDisplayAmounts: () => void;
}

const CHANNEL = 'jackpot-wins';

function buildDisplayList(): JackpotDisplay[] {
  return JACKPOT_CONFIGS.map((cfg) => {
    const amount = jackpotEngine.getAmount(cfg.id);
    const runtimeStates = jackpotEngine.getAllStates();
    const rs = runtimeStates.find((s) => s.id === cfg.id);
    return {
      id: cfg.id,
      name: cfg.name,
      type: cfg.type,
      currentAmount: amount,
      tags: cfg.tags,
      gameId: cfg.gameId,
      gameTitle: cfg.gameTitle,
      state: getJackpotState(cfg, amount, rs?.lastWinTimestamp ?? 0),
      progressPct: getProgressToThreshold(cfg, amount),
      minimumThreshold: cfg.minimumThreshold,
    };
  });
}

export const useJackpotStore = create<JackpotState>((set) => ({
  jackpots: buildDisplayList(),
  recentWinner: null,
  pendingWin: null,
  globalWinEvent: null,

  processSpin: (input) => {
    const result = jackpotEngine.processSpin(input);
    if (!result.win) {
      set({ jackpots: buildDisplayList() });
      return null;
    }

    const win: JackpotWin = {
      jackpotId: result.win.jackpotId,
      jackpotName: result.win.jackpotName,
      amount: result.win.amount,
      timestamp: result.win.timestamp,
    };

    // Single set() covering both the updated amounts and the win state
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

        // Fire admin alert so the dashboard shows the jackpot win in Active Alerts
        const amountFmt = `KES ${Math.round(result.win!.amount).toLocaleString()}`;
        const playerLabel = winnerUsername ? `@${winnerUsername}` : 'a player';
        await supabase.from('admin_alerts').insert({
          type: 'jackpot_win',
          severity: 'high',
          message: `🎰 ${result.win!.jackpotName} jackpot hit! ${playerLabel} won ${amountFmt}`,
          metadata: {
            jackpot_id:   result.win!.jackpotId,
            jackpot_name: result.win!.jackpotName,
            amount:       result.win!.amount,
            user_id:      result.win!.userId,
            username:     winnerUsername,
          },
          resolved: false,
        });
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
    if (_syncInFlight) return;
    _syncInFlight = true;
    try {
      const { data } = await supabase
        .from('jackpots')
        .select('id, name, type, current_amount, locked, base_amount, contribution_rate, trigger_probability');
      if (!data?.length) return;

      // Single source of truth: DB rows drive the engine config.
      // seedConfigs updates existing jackpots AND registers new DB rows
      // that aren't in the hardcoded fallback list — fully dynamic.
      jackpotEngine.seedConfigs(data.map((row) => ({
        id:                  row.id,
        name:                row.name,
        type:                row.type,
        base_amount:         row.base_amount,
        contribution_rate:   row.contribution_rate,
        trigger_probability: row.trigger_probability,
      })));

      const amounts: Record<string, number> = {};
      for (const row of data) {
        amounts[row.id] = row.current_amount;
        const currentMode = jackpotEngine.getOverride(row.id)?.mode;
        if (row.locked && currentMode !== 'locked') {
          jackpotEngine.setMode(row.id, 'locked');
        } else if (!row.locked && currentMode === 'locked') {
          jackpotEngine.setMode(row.id, 'auto');
        }
      }
      jackpotEngine.seedAmounts(amounts);
      set({ jackpots: buildDisplayList() });
    } catch {
      // Silently fail — local engine state is fine
    } finally {
      _syncInFlight = false;
    }
  },

  // Subscribe to admin config changes on the jackpots table.
  // Fires syncFromSupabase() whenever an admin edits base_amount,
  // contribution_rate, trigger_probability, locked, or name — so
  // all connected casino UIs pick up the change within seconds.
  // subscribeToConfigChanges is kept for interface compatibility but is a no-op:
  // the module-level _initJackpotConfigSync already sets up the single authoritative
  // Realtime subscription on 'jackpot-config-live'. Creating a second subscription
  // here would cause every admin edit to trigger syncFromSupabase() twice.
  subscribeToConfigChanges: () => {
    return () => {}; // cleanup no-op
  },

  startRealTimeGrowth: () => {
    const interval = setInterval(() => {
      jackpotEngine.applyGrowthTick();
      set({ jackpots: buildDisplayList() });
    }, 1000);
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

// ── Module-level config sync ──────────────────────────────────────────────────
// Run once when this module first loads. Sets up:
//   1. Immediate sync from DB (picks up any admin edits that happened while offline)
//   2. Supabase Realtime subscription for instant updates when admin edits jackpots
//   3. 60s polling fallback (covers edge cases where Realtime event is missed)
//
// Using module-level init instead of React useEffect avoids StrictMode double-invoke
// tearing down the subscription before it can receive events.

let _syncInFlight = false;

function _initJackpotConfigSync() {
  const store = useJackpotStore;

  // 1. Immediate sync
  store.getState().syncFromSupabase();

  // 2. Realtime — fires on every UPDATE to the jackpots table
  supabase
    .channel('jackpot-config-live')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'jackpots' },
      () => { store.getState().syncFromSupabase(); }
    )
    .subscribe();

  // 3. Polling fallback every 60s (Realtime covers most updates)
  setInterval(() => { store.getState().syncFromSupabase(); }, 60_000);
}

// Defer slightly so the Supabase client is fully initialised before subscribing
setTimeout(_initJackpotConfigSync, 500);
