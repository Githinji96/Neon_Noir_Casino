/**
 * Near-Miss Store
 *
 * Manages near-jackpot notification state with:
 * - Minimum bet count before first notification (players must bet N times first)
 * - Time-based cooldown between notifications
 * - Spin-count cooldown (max 1 per N spins)
 * - Analytics event queue
 *
 * FAIRNESS: The store ONLY controls notification display.
 * It NEVER modifies RNG outcomes, payouts, or jackpot probability.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface NearMissConfig {
  enabled: boolean;
  minimumBetsBeforeNotification: number; // spins before first notification (default 10)
  cooldownMs: number;                    // min ms between notifications (default 30s)
  cooldownSpins: number;                 // min spins between notifications (default 3)
  notificationDuration: number;          // ms to show toast (default 5000)
}

export interface NearMissEvent {
  gameId: string;
  jackpotSymbol: string;
  matchedPositions: number;
  requiredPositions: number;
  timestamp: number;
}

interface NearMissState {
  config: NearMissConfig;
  jackpotBetCount: number;        // total spins on jackpot games this session
  lastNotificationAt: number;     // unix ms of last shown notification
  spinsSinceLastNotification: number; // spin count since last notification
  activeMessage: string | null;
  activeGameName: string | null;  // e.g. "Mega Jackpot" — for richer toast

  recordJackpotBet: () => void;
  showNotification: (message: string, gameName?: string) => void;
  dismissNotification: () => void;
  isEligible: () => boolean;
  updateConfig: (patch: Partial<NearMissConfig>) => void;
  logEvent: (event: NearMissEvent) => void;
}

export const useNearMissStore = create<NearMissState>()(
  persist(
    (set, get) => ({
      config: {
        enabled: true,
        minimumBetsBeforeNotification: 10,
        cooldownMs: 30_000,
        cooldownSpins: 3,
        notificationDuration: 5000,
      },
      jackpotBetCount: 0,
      lastNotificationAt: 0,
      spinsSinceLastNotification: 0,
      activeMessage: null,
      activeGameName: null,

      recordJackpotBet: () => {
        set((s) => ({
          jackpotBetCount: s.jackpotBetCount + 1,
          spinsSinceLastNotification: s.spinsSinceLastNotification + 1,
        }));
      },

      showNotification: (message, gameName) => {
        if (!get().config.enabled) return;
        set({
          activeMessage: message,
          activeGameName: gameName ?? null,
          lastNotificationAt: Date.now(),
          spinsSinceLastNotification: 0,
        });
      },

      dismissNotification: () => {
        set({ activeMessage: null, activeGameName: null });
      },

      isEligible: () => {
        const {
          config,
          jackpotBetCount,
          lastNotificationAt,
          spinsSinceLastNotification,
        } = get();

        if (!config.enabled) return false;

        // Must have bet enough times first
        if (jackpotBetCount < config.minimumBetsBeforeNotification) return false;

        // Time-based cooldown
        if (Date.now() - lastNotificationAt < config.cooldownMs) return false;

        // Spin-count cooldown
        if (lastNotificationAt > 0 && spinsSinceLastNotification < config.cooldownSpins) return false;

        return true;
      },

      updateConfig: (patch) => {
        set((s) => ({ config: { ...s.config, ...patch } }));
      },

      logEvent: (event) => {
        // Fire-and-forget analytics — never blocks game logic
        if (import.meta.env.DEV) {
          console.log('[NearMiss] Event:', event);
        }
        // In production this would POST to an analytics endpoint
      },
    }),
    {
      name: 'neon-noir-near-miss',
      partialize: (s) => ({
        jackpotBetCount: s.jackpotBetCount,
        lastNotificationAt: s.lastNotificationAt,
        spinsSinceLastNotification: s.spinsSinceLastNotification,
        config: s.config,
      }),
    }
  )
);
