import { create } from 'zustand';
import { supabase, type Profile } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

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
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        set({ user: session.user, profile: data, loading: false });
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
      } catch {
        set({ user: session.user, profile: null, loading: false });
      }
    });
  },

  signUp: async (email, password, username) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    return error?.message ?? null;
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
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
