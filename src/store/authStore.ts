import { create } from 'zustand';
import { getAuthErrorMessage, supabase, type Profile } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { setAuthUserGetter, useGameStore, isSpinPending } from './gameStore';
import { touchActivity, clearActivity, clearSupabaseSession } from '../lib/sessionManager';

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

// Module-level interval handle so it can be cleared on signOut
let _balancePollInterval: ReturnType<typeof setInterval> | null = null;

/** Read the stored session user synchronously at module load time.
 *  This runs before any React component renders, eliminating the
 *  flash-of-unauthenticated-content on page refresh.
 *  Rejects tokens that are already expired so an idle user who closed
 *  the browser doesn't appear logged-in on next open. */
function getStoredUser() {
  try {
    const projectRef = (import.meta.env.VITE_SUPABASE_URL as string)
      .replace('https://', '').split('.')[0];
    const stored = localStorage.getItem(`sb-${projectRef}-auth-token`);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    const session = parsed?.session ?? parsed;
    // Check token expiry — expires_at is a Unix timestamp (seconds)
    const expiresAt: number | undefined = session?.expires_at;
    if (expiresAt && expiresAt * 1000 < Date.now()) {
      // Token is expired — clear it now so init() sees no session
      try { localStorage.removeItem(`sb-${projectRef}-auth-token`); } catch { /* ignore */ }
      return null;
    }
    return session?.user ?? null;
  } catch { /* localStorage unavailable */ }
  return null;
}

const _storedUser = getStoredUser();

export const useAuthStore = create<AuthState>((set, get) => ({
  // Pre-populate user from localStorage so the Navbar shows the correct
  // state on the very first render — no flash of logged-out UI on refresh.
  user: _storedUser,
  profile: null,
  loading: true,

  init: async () => {
    // Register auth user getter for jackpot store (avoids circular dep)
    setAuthUserGetter(() => useAuthStore.getState().user?.id ?? null);

    // User is already pre-populated from _storedUser at module load time.
    // Verify the stored token is valid and fetch the full profile.
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({ user: session.user, loading: true });
        const { data } = await supabase
          .from('profiles')
          .select('id, username, balance, phone, phone_verified, account_status, country, currency, date_of_birth, updated_at')
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
      // Network error or bad config — unblock the UI
      set({ loading: false });
    }

    if (listenerRegistered) return;
    listenerRegistered = true;

    // Refresh profile whenever the player's tab regains focus —
    // catches admin edits that happened while the tab was hidden.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && useAuthStore.getState().user) {
        useAuthStore.getState().refreshBalance();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    // Start the 30s balance poll — only when a user is actually logged in,
    // only when the tab is visible. Stored at module level so signOut() can
    // clear it and stop the polling immediately.
    const startBalancePoll = () => {
      if (_balancePollInterval) return; // already running
      _balancePollInterval = setInterval(() => {
        if (document.visibilityState === 'visible' && useAuthStore.getState().user) {
          useAuthStore.getState().refreshBalance();
        }
      }, 30_000);
    };

    const stopBalancePoll = () => {
      if (_balancePollInterval) {
        clearInterval(_balancePollInterval);
        _balancePollInterval = null;
      }
    };

    // Start poll now if already logged in (page refresh case)
    if (useAuthStore.getState().user) startBalancePoll();

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        stopBalancePoll();
        set({ user: null, profile: null, loading: false });
        return;
      }

      // TOKEN_REFRESHED: Supabase auto-refreshed the JWT. Update the user
      // object so the client has the latest token, but don't re-fetch profile —
      // it hasn't changed and this event fires frequently while the tab is open.
      // IMPORTANT: if the store already cleared the user (inactivity signout),
      // ignore the refresh — don't resurrect a session we intentionally ended.
      if (event === 'TOKEN_REFRESHED') {
        const currentUser = useAuthStore.getState().user;
        if (!currentUser) return; // session was intentionally cleared — ignore
        set({ user: session.user });
        startBalancePoll(); // ensure poll is running after token refresh
        return;
      }

      // SIGNED_IN / INITIAL_SESSION / USER_UPDATED — fetch fresh profile
      set({ user: session.user, loading: false });
      startBalancePoll();

      try {
        const profilePromise = supabase
          .from('profiles')
          .select('id, username, balance, phone, phone_verified, account_status, country, currency, date_of_birth, updated_at')
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
        // Profile fetch failed — keep existing profile, do not wipe phone/data
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      let authResult;
      try {
        authResult = await supabase.auth.signInWithPassword({ email, password });
      } finally {
        clearTimeout(timeoutId);
      }

      const { data, error } = authResult;
      if (error) return error.message;
      if (!data?.user) return 'Sign in failed. Please try again.';

      // Check account_status — best-effort, never block login on network failure
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('account_status')
          .eq('id', data.user.id)
          .single();

        if (profile?.account_status === 'banned') {
          await supabase.auth.signOut();
          return 'This account has been permanently deleted. Contact support if you believe this is an error.';
        }
        if (profile?.account_status === 'suspended') {
          await supabase.auth.signOut();
          return 'Your account is suspended. Please contact support at bonfacegithinji64@gmail.com to reactivate.';
        }
      } catch {
        // Profile fetch failed — credentials were valid, allow login
      }

      // Stamp fresh activity so the inactivity clock starts from now
      touchActivity();
      return null;
    } catch (err) {
      return getAuthErrorMessage(err);
    }
  },

  signOut: async () => {
    set({ user: null, profile: null });
    // Stop the balance poll immediately — no more requests after logout
    if (_balancePollInterval) {
      clearInterval(_balancePollInterval);
      _balancePollInterval = null;
    }
    clearActivity();           // wipe inactivity timestamp
    clearSupabaseSession();    // wipe localStorage token immediately
    // Clear persisted VIP data so a signed-out user doesn't see the previous
    // player's points/tier on the VIP page
    try { localStorage.removeItem('neon-noir-vip'); } catch { /* ignore */ }
    // Reset in-memory VIP state immediately
    const { useVIPStore } = await import('./vipStore');
    useVIPStore.setState({
      totalPoints: 0,
      monthlyPoints: 0,
      currentTier: (await import('../config/vipConfig')).getTierForPoints(0),
      currentWeekCashback: null,
      cashbackHistory: [],
    });
    // scope: 'local' removes the session from localStorage immediately and
    // stops autoRefreshToken from re-establishing the session in this tab.
    await supabase.auth.signOut({ scope: 'local' });
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

  syncBalance: async (_balance) => {
    // Balance is kept in sync via apply_spin_result RPC on every spin.
    // This no-op avoids guard_balance_update which blocks client-side increases.
  },

  refreshBalance: async () => {
    const { user } = get();
    if (!user) return; // no user — poll should not have fired, but guard anyway
    try {
      // Fetch all admin-editable fields so the casino UI reflects admin changes
      // within 30s (the polling interval) or immediately on tab focus.
      const { data, error } = await supabase
        .from('profiles')
        .select('balance, phone, phone_verified, username, account_status')
        .eq('id', user.id)
        .single();

      // 401 / JWT expired: Supabase hasn't refreshed the token yet or session
      // was revoked server-side. Don't sign out — autoRefreshToken will retry
      // and fire onAuthStateChange(SIGNED_OUT) if the refresh truly fails.
      if (error) {
        if (error.message?.includes('JWT') || error.code === '401') return;
        return; // any other DB error — skip silently
      }
      if (data == null) return;

      // ── Account status enforcement ─────────────────────────────────────────
      // If an admin banned or suspended this player since the last poll,
      // sign them out. Use setTimeout to defer past the current auth lock
      // cycle — calling signOut() synchronously inside a poll that already
      // holds a Web Lock throws AbortError: "Lock broken by another request".
      if (data.account_status === 'banned' || data.account_status === 'suspended') {
        set({ user: null, profile: null, loading: false }); // clear store immediately
        setTimeout(() => supabase.auth.signOut().catch(() => {}), 0);
        return;
      }

      // ── Phone backfill ─────────────────────────────────────────────────────
      // Only attempt backfill if the profile phone is genuinely missing.
      // Avoid the extra getUser() call on every poll cycle.
      if (!data.phone) {
        try {
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
        } catch {
          // Best-effort — never block balance update
        }
      }

      // ── Merge all mutable fields into the store ────────────────────────────
      const current = useAuthStore.getState().profile;
      set((s) => ({
        profile: s.profile
          ? {
              ...s.profile,
              balance:        data.balance        ?? s.profile.balance,
              username:       data.username       ?? s.profile.username,
              account_status: data.account_status ?? s.profile.account_status,
              // Never overwrite an existing phone with null from the DB
              phone:          data.phone          ?? s.profile.phone,
              phone_verified: data.phone_verified ?? s.profile.phone_verified,
            }
          : null,
      }));
      if (data.balance != null && data.balance !== current?.balance) {
        // Never overwrite the game store balance while a spin RPC write is in-flight —
        // that would revert the optimistic balance update the player just saw.
        if (!isSpinPending()) {
          useGameStore.setState({ balance: data.balance });
        }
      }
    } catch {
      // silent — best effort
    }
  },

  recordWin: async (winAmount, gameTitle) => {
    const { user, profile } = get();
    if (!user || !profile || winAmount <= 0) return;
    await supabase.from('leaderboard').insert({
      user_id:    user.id,
      username:   profile.username,
      win_amount: winAmount,
      game_title: gameTitle,
    });
  },
}));
