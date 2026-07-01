/**
 * Near-Miss Store
 * Manages near-miss notification state and eligibility.
 * Players must place a minimum number of jackpot bets before notifications appear.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface NearMissConfig {
  enabled: boolean;
  minimumBetsBeforeNotification: number; // default 25
  notificationCooldownMs: number;        // min time between notifications (default 30s)
}

interface NearMissState {
  config: NearMissConfig;
  jackpotBetCount: number;         // total spins on jackpot-linked games
  lastNotificationAt: number;      // timestamp of last shown notification
  activeMessage: string | null;    // current notification to show

  recordJackpotBet: () => void;
  showNotification: (message: string) => void;
  dismissNotification: () => void;
  isEligible: () => boolean;
  updateConfig: (patch: Partial<NearMissConfig>) => void;
}

export const useNearMissStore = create<NearMissState>()(
  persist(
    (set, get) => ({
      config: {
        enabled: true,
        minimumBetsBeforeNotification: 25,
        notificationCooldownMs: 30_000,
      },
      jackpotBetCount: 0,
      lastNotificationAt: 0,
      activeMessage: null,

      recordJackpotBet: () => {
        set((s) => ({ jackpotBetCount: s.jackpotBetCount + 1 }));
      },

      showNotification: (message) => {
        if (!get().config.enabled) return;
        set({ activeMessage: message, lastNotificationAt: Date.now() });
      },

      dismissNotification: () => {
        set({ activeMessage: null });
      },

      isEligible: () => {
        const { config } = get();
        if (!config.enabled) return false;
        return true;
      },

      updateConfig: (patch) => {
        set((s) => ({ config: { ...s.config, ...patch } }));
      },
    }),
    {
      name: 'neon-noir-near-miss',
      partialize: (s) => ({
        jackpotBetCount: s.jackpotBetCount,
        lastNotificationAt: s.lastNotificationAt,
        config: s.config,
      }),
    }
  )
);
