import { create } from 'zustand';
import { getAuthErrorMessage, isTransientAuthError, supabase, type Profile } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { setAuthUserGetter, useGameStore } from './gameStore';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  init: () => Promise<void>;
  signUp: (email: string, password: string, username: string, phone?: string, firstName?: string, lastName?: string, dateOfBirth?: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signInWithOAuth: (provider: 'google' | 'apple') => Promise<string | null>;
  signOut: () => Promise<void>;
  syncBalance: (balance: number) => Promise<void>;
  recordWin: (winAmount: number, gameTitle: string) => Promise<void>;
  refreshBalance: () => Promise<void>;
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

    // Restore session synchronously from localStorage so the UI never flashes
    // to logged-out state while the async getSession() call is in-flight.
    try {
      // Derive the storage key from the configured Supabase URL rather than
      // hardcoding the project ref — keeps it working if the project changes
      const projectRef = (import.meta.env.VITE_SUPABASE_URL as string)
        .replace('https://', '').split('.')[0];
      const stored = localStorage.getItem(`sb-${projectRef}-auth-token`);
      if (stored) {
        const parsed = JSON.parse(stored);
        const sessionUser = parsed?.user ?? parsed?.session?.user ?? null;
        if (sessionUser) set({ user: sessionUser, loading: true });
      }
    } catch { /* localStorage unavailable */ }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({ user: session.user, loading: true });
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        set({ user: session.user, profile: data, loading: false });
        if (data?.balance != null) {
          useGameStore.setState({ balance: data.balance });
        }
      } else {
        set({ user: null, profile: null, loading: false });
      }
    } catch {
      // Network error or bad config -- unblock the UI
      set({ loading: false });
    }

    if (listenerRegistered) return;
    listenerRegistered = true;

    // Refresh balance whenever the player's tab regains focus â€”
    // catches admin credits/debits that happened while the tab was hidden.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        useAuthStore.getState().refreshBalance();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    // Poll every 30s as a fallback in case Realtime drops or
    // the profiles table is not in the supabase_realtime publication.
    // Only polls when the tab is visible to avoid unnecessary requests.
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        useAuthStore.getState().refreshBalance();
      }
    }, 30_000);

    // Balance is kept fresh via the 30s polling interval and visibility-change
    // handler. We intentionally skip a per-user Realtime channel here to avoid
    // exhausting Supabase WebSocket limits at scale (200 on free, 500 on Pro).

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

        // Force sign-out if account is banned or suspended
        if (data?.account_status === 'banned' || data?.account_status === 'suspended') {
          await supabase.auth.signOut();
          set({ user: null, profile: null, loading: false });
          return;
        }

        set({ profile: data });
        if (data?.balance != null) {
          useGameStore.setState({ balance: data.balance });
        }
      } catch {
        // Profile fetch failed -- keep existing profile, do not wipe phone/data
        // set({ profile: null }) removed: caused M-Pesa number to disappear on network hiccups
      }
    });
  },

  signUp: async (email, password, username, phone?, firstName?, lastName?, dateOfBirth?) => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Check your connection or try again.')), 10000)
      );
      const signUpPromise = supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            phone:         phone ?? '',
            first_name:    firstName ?? '',
            last_name:     lastName ?? '',
            date_of_birth: dateOfBirth ?? '',
            country:       'Kenya',
            currency:      'KES',
          },
        },
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

          // â”€â”€ Check account_status before allowing access â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          const { data: profile } = await supabase
            .from('profiles')
            .select('account_status')
            .eq('id', data.user.id)
            .single();

          if (profile?.account_status === 'banned') {
            // Sign out immediately so the session isn't held
            await supabase.auth.signOut();
            return 'This account has been permanently deleted. Contact support if you believe this is an error.';
          }
          if (profile?.account_status === 'suspended') {
            await supabase.auth.signOut();
            return 'Your account is suspended. Please contact support at bonfacegithinji64@gmail.com to reactivate.';
          }

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
    // Write to Supabase â€” don't call set() here; the realtime listener will
    // echo this back only if the value actually changed externally.
    await supabase
      .from('profiles')
      .update({ balance, updated_at: new Date().toISOString() })
      .eq('id', user.id);
  },

  refreshBalance: async () => {
    const { user } = get();
    if (!user) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('balance, phone, phone_verified')
        .eq('id', user.id)
        .single();
      if (data == null) return;

      // If profile phone is null but auth metadata has it, patch it now
      if (!data.phone) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const metaPhone = authUser?.user_metadata?.phone ?? null;
        if (metaPhone && metaPhone !== '') {
          await supabase
            .from('profiles')
            .update({ phone: metaPhone, phone_verified: true })
            .eq('id', user.id)
            .is('phone', null);
          data.phone = metaPhone;
          data.phone_verified = true;
        }
      }

      const current = useAuthStore.getState().profile;
      set((s) => ({
        profile: s.profile
          ? {
              ...s.profile,
              balance:        data.balance        ?? s.profile.balance,
              // Never overwrite an existing phone with null from the DB
              phone:          data.phone          ?? s.profile.phone,
              phone_verified: data.phone_verified ?? s.profile.phone_verified,
            }
          : null,
      }));
      if (data.balance != null && data.balance !== current?.balance) {
        useGameStore.setState({ balance: data.balance });
      }
    } catch {
      // silent -- best effort
    }
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

