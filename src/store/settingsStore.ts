import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

export interface UserSettings {
  // Game preferences
  soundEnabled: boolean;
  musicEnabled: boolean;
  animationSpeed: 'slow' | 'normal' | 'fast';
  defaultBet: number;
  autoSpinCount: number;
  stopOnWin: boolean;
  stopOnLoss: number; // 0 = disabled

  // Notifications
  notifPromotions: boolean;
  notifJackpot: boolean;
  notifWins: boolean;
  notifSecurity: boolean;

  // Limits
  responsibleGambling: boolean;
  dailyDepositLimit: number;
  weeklyDepositLimit: number;
  monthlyDepositLimit: number;
  dailyLossLimit: number;
  sessionTimeLimit: number; // minutes, 0 = disabled

  // Preferences
  theme: 'dark' | 'light';
  language: string;
}

const DEFAULTS: UserSettings = {
  soundEnabled: true,
  musicEnabled: true,
  animationSpeed: 'normal',
  defaultBet: 1,
  autoSpinCount: 10,
  stopOnWin: false,
  stopOnLoss: 0,
  notifPromotions: true,
  notifJackpot: true,
  notifWins: true,
  notifSecurity: true,
  responsibleGambling: false,
  dailyDepositLimit: 0,
  weeklyDepositLimit: 0,
  monthlyDepositLimit: 0,
  dailyLossLimit: 0,
  sessionTimeLimit: 0,
  theme: 'dark',
  language: 'en',
};

interface SettingsState {
  settings: UserSettings;
  isOpen: boolean;
  saving: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  updateSettings: (patch: Partial<UserSettings>) => void;
  saveToSupabase: (userId: string) => Promise<void>;
  loadFromSupabase: (userId: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: DEFAULTS,
      isOpen: false,
      saving: false,

      openSettings: () => set({ isOpen: true }),
      closeSettings: () => set({ isOpen: false }),

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      saveToSupabase: async (userId) => {
        set({ saving: true });
        try {
          await supabase.from('user_preferences').upsert(
            { user_id: userId, settings: get().settings, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          );
        } finally {
          set({ saving: false });
        }
      },

      loadFromSupabase: async (userId) => {
        const { data } = await supabase
          .from('user_preferences')
          .select('settings')
          .eq('user_id', userId)
          .single();
        if (data?.settings) {
          set((s) => ({ settings: { ...s.settings, ...data.settings } }));
        }
      },
    }),
    { 
      name: 'neon-noir-settings-v2',
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
