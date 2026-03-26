import { create } from 'zustand';
import { supabase, type Profile } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { setAuthUserGetter } from './gameStore';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  init: () => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  syncBalance: (balance: number) => Promise<void>;
  recordWin: (winAmount: number, gameTitle: string) => Promise<void>;
}

// Guard so init() only registers the onAuthStateChange listener once,
// even if called multiple times (e.g. React StrictMode double-invoke).
let listenerRegistered = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,

  init: async () => {
    // Register auth user getter for jackpot store (avoids circular dep)
    setAuthUserGetter(() => useAuthStore.getState().user?.id ?? null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        set({ user: session.user, profile: data, loading: false });
        // Seed game balance from Supabase profile so both displays match
        if (data?.balance != null) {
          const { useGameStore } = await import('./gameStore');
          useGameStore.setState({ balance: data.balance });
        }
      } else {
        set({ loading: false });
      }
    } catch {
      // Network error or bad config — unblock the UI
      set({ loading: false });
    }

    if (listenerRegistered) return;
    listenerRegistered = true;

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        set({ user: null, profile: null, loading: false });
        return;
      }
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        set({ user: session.user, profile: data, loading: false });
        if (data?.balance != null) {
          const { useGameStore } = await import('./gameStore');
          useGameStore.setState({ balance: data.balance });
        }
      } catch {
        set({ user: session.user, profile: null, loading: false });
      }
    });
  },

  signUp: async (email, password, username) => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Check your connection or try again.')), 10000)
      );
      const signUpPromise = supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      const { error } = await Promise.race([signUpPromise, timeoutPromise]);
      return error?.message ?? null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Network error. Please try again.';
    }
  },

  signIn: async (email, password) => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out after 20s. Check your internet connection.')), 20000)
      );
      const signInPromise = supabase.auth.signInWithPassword({ email, password });
      const { data, error } = await Promise.race([signInPromise, timeoutPromise]);
      if (error) return error.message;
      if (!data?.user) return 'Sign in failed. Please try again.';
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Network error. Please try again.';
    }
  },

  signOut: async () => {
    // Clear local state first so the UI unblocks immediately,
    // then tell Supabase to invalidate the server-side session.
    set({ user: null, profile: null });
    await supabase.auth.signOut();
  },

  syncBalance: async (balance) => {
    const { user } = get();
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ balance, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    set((s) => ({ profile: s.profile ? { ...s.profile, balance } : null }));
  },

  recordWin: async (winAmount, gameTitle) => {
    const { user, profile } = get();
    if (!user || !profile || winAmount <= 0) return;
    await supabase.from('leaderboard').insert({
      user_id: user.id,
      username: profile.username,
      win_amount: winAmount,
      game_title: gameTitle,
    });
  },
}));
