import { create } from 'zustand';
import { getAuthErrorMessage, isTransientAuthError, supabase, type Profile } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { setAuthUserGetter } from './gameStore';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  init: () => Promise<void>;
  signUp: (email: string, password: string, username: string, phone?: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signInWithOAuth: (provider: 'google' | 'apple') => Promise<string | null>;
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
      // Always unblock loading immediately, then fetch profile
      set({ user: session.user, loading: false });
      try {
        const profilePromise = supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('profile timeout')), 5000)
        );
        const { data } = await Promise.race([profilePromise, timeoutPromise]);
        set({ profile: data });
        if (data?.balance != null) {
          const { useGameStore } = await import('./gameStore');
          useGameStore.setState({ balance: data.balance });
        }
      } catch {
        // Profile fetch failed — user is still signed in, just no profile data
        set({ profile: null });
      }
    });
  },

  signUp: async (email, password, username, phone?) => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Check your connection or try again.')), 10000)
      );
      const signUpPromise = supabase.auth.signUp({
        email,
        password,
        options: { data: { username, phone: phone ?? '' } },
      });
      const { error } = await Promise.race([signUpPromise, timeoutPromise]);
      return error?.message ?? null;
    } catch (err) {
      return getAuthErrorMessage(err, 'We could not create your account right now. Please try again.');
    }
  },

  signIn: async (email, password) => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Check your connection and try again.')), 10000)
      );

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const { data, error } = await Promise.race([supabase.auth.signInWithPassword({ email, password }), timeoutPromise]);
          if (error) return error.message;
          if (!data?.user) return 'Sign in failed. Please try again.';
          return null;
        } catch (err) {
          if (attempt === 0 && isTransientAuthError(err)) {
            continue;
          }
          return getAuthErrorMessage(err);
        }
      }

      return 'The authentication service could not be reached. Please check your connection and try again.';
    } catch (err) {
      return getAuthErrorMessage(err);
    }
  },

  signOut: async () => {
    set({ user: null, profile: null });
    await supabase.auth.signOut();
  },

  signInWithOAuth: async (provider) => {
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      return error?.message ?? null;
    } catch (err) {
      return err instanceof Error ? err.message : 'OAuth sign-in failed.';
    }
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
