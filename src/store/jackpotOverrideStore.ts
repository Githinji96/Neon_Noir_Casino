/**
 * Jackpot Override Store
 * Persists admin trigger control settings across page remounts.
 * Uses zustand/persist so settings survive navigation.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { jackpotEngine, type JackpotTriggerMode } from '../logic/jackpot/jackpotEngine';
import { JACKPOT_CONFIGS } from '../logic/jackpot/jackpotConfig';

export interface OverrideEntry {
  mode: JackpotTriggerMode;
  forceTriggerNext: boolean;
  scheduledTriggerAt: number;
  minAmountThreshold: number;
}

type OverrideMap = Record<string, OverrideEntry>;

interface JackpotOverrideState {
  overrides: OverrideMap;
  setMode: (id: string, mode: JackpotTriggerMode) => void;
  forceNext: (id: string) => void;
  scheduleAt: (id: string, ts: number) => void;
  setMinThreshold: (id: string, amount: number) => void;
  cancel: (id: string) => void;
  refresh: () => void;
}

const defaultOverrides = (): OverrideMap =>
  Object.fromEntries(
    JACKPOT_CONFIGS.map((cfg) => [
      cfg.id,
      { mode: 'auto' as JackpotTriggerMode, forceTriggerNext: false, scheduledTriggerAt: 0, minAmountThreshold: 0 },
    ])
  );

export const useJackpotOverrideStore = create<JackpotOverrideState>()(
  persist(
    (set, get) => ({
      overrides: defaultOverrides(),

      setMode: (id, mode) => {
        jackpotEngine.setMode(id, mode);
        set((s) => ({ overrides: { ...s.overrides, [id]: { ...s.overrides[id], mode } } }));
      },

      forceNext: (id) => {
        jackpotEngine.forceNextWin(id);
        set((s) => ({
          overrides: { ...s.overrides, [id]: { ...s.overrides[id], forceTriggerNext: true, mode: 'auto' } },
        }));
      },

      scheduleAt: (id, ts) => {
        jackpotEngine.scheduleAt(id, ts);
        set((s) => ({
          overrides: { ...s.overrides, [id]: { ...s.overrides[id], scheduledTriggerAt: ts, mode: 'scheduled' } },
        }));
      },

      setMinThreshold: (id, amount) => {
        jackpotEngine.setMinThreshold(id, amount);
        set((s) => ({
          overrides: { ...s.overrides, [id]: { ...s.overrides[id], minAmountThreshold: amount } },
        }));
      },

      cancel: (id) => {
        jackpotEngine.cancelOverride(id);
        set((s) => ({
          overrides: {
            ...s.overrides,
            [id]: { mode: 'auto', forceTriggerNext: false, scheduledTriggerAt: 0, minAmountThreshold: s.overrides[id]?.minAmountThreshold ?? 0 },
          },
        }));
      },

      // Sync engine state from persisted store on mount
      refresh: () => {
        const { overrides } = get();
        for (const [id, ov] of Object.entries(overrides)) {
          jackpotEngine.setMode(id, ov.mode);
          if (ov.forceTriggerNext) jackpotEngine.forceNextWin(id);
          if (ov.scheduledTriggerAt > 0) jackpotEngine.scheduleAt(id, ov.scheduledTriggerAt);
          jackpotEngine.setMinThreshold(id, ov.minAmountThreshold);
        }
      },
    }),
    { name: 'jackpot-overrides' }
  )
);
