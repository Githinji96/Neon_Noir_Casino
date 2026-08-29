import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { hasRequiredAdminRole, normalizeAdminRole } from '../components/admin/adminAccess';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminRole = 'super_admin' | 'finance_admin' | 'support_agent' | 'game_manager';

export interface AdminProfile {
  id: string;
  username: string;
  admin_role: AdminRole;
}

export type AuditActionType =
  | 'balance_adjust'
  | 'user_suspend'
  | 'user_ban'
  | 'password_reset'
  | 'withdrawal_approve'
  | 'withdrawal_complete'
  | 'withdrawal_reject'
  | 'payment_retry'
  | 'game_toggle'
  | 'game_config_update'
  | 'table_create'
  | 'table_edit'
  | 'table_pause'
  | 'table_resume'
  | 'player_kick'
  | 'round_restart'
  | 'rtp_update'
  | 'jackpot_config_update'
  | 'jackpot_force_reset'
  | 'bet_limit_apply'
  | 'fraud_flag_dismiss'
  | 'reset_player_wins'
  | 'reset_player_bets'
  | 'reset_player_stats';

export interface AuditLogEntry {
  id: string;
  admin_id: string | null;
  admin_role: AdminRole;
  action_type: AuditActionType;
  target_entity: string | null;
  target_id: string | null;
  previous_value: unknown;
  new_value: unknown;
  ip_address: string | null;
  created_at: string;
}

export interface RTPConfig {
  id: string;
  target_rtp: number;
  adjustment_strength: number;
  updated_by: string | null;
  updated_at: string;
}

export interface AdminAlert {
  id: string;
  type: 'rtp_deviation' | 'large_payout' | 'fraud_flag';
  severity: 'high' | 'medium' | 'low';
  message: string;
  metadata: Record<string, unknown>;
  resolved: boolean;
  created_at: string;
}

export interface FraudFlag {
  id: string;
  user_id: string;
  reason: 'rapid_high_bets' | 'high_win_rate';
  metadata: Record<string, unknown>;
  dismissed: boolean;
  bet_limit_applied: boolean;
  created_at: string;
}

export interface GameConfig {
  id: string;
  game_id: string;
  enabled: boolean;
  min_bet: number;
  max_bet: number;
  volatility: string;
  updated_by: string | null;
  updated_at: string;
}

export interface JackpotPool {
  id: string;
  name: string;
  type: string;
  base_amount: number;
  current_amount: number;
  contribution_rate: number;
  trigger_probability: number;
  last_reset: string;
}

// ─── Store ────────────────────────────────────────────────────────────────────

/** Session timeout in minutes — configurable via VITE_ADMIN_SESSION_TIMEOUT env var */
const SESSION_TIMEOUT_MINUTES = parseInt(
  (import.meta.env.VITE_ADMIN_SESSION_TIMEOUT as string | undefined) ?? '30',
  10
);

interface AdminState {
  adminProfile: AdminProfile | null;
  loading: boolean;
  alerts: AdminAlert[];
  unreadAlertCount: number;
  /** ISO string of when the admin session expires (from server) */
  sessionExpiresAt: string | null;

  init: () => Promise<void>;
  signOut: () => Promise<void>;
  startSession: () => Promise<void>;
  checkSession: () => Promise<'valid' | 'expiring' | 'expired'>;
  refreshSession: () => Promise<boolean>;
  subscribeToAlerts: () => () => void;
  auditLog: (entry: Omit<AuditLogEntry, 'id' | 'created_at'>) => Promise<void>;
  dismissAlert: (alertId: string) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  adminProfile: null,
  loading: true,
  alerts: [],
  unreadAlertCount: 0,
  sessionExpiresAt: null,

  init: async () => {
    // If profile already set (inter-page navigation), skip re-init but clear loading
    const already = get().adminProfile;
    if (already) {
      set({ loading: false });
      return;
    }

    set({ loading: true });
    try {
      // Use getSession() (reads localStorage cache — no network round-trip)
      // Only fall back to getUser() if session is missing.
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;

      if (!user) {
        set({ adminProfile: null, loading: false });
        return;
      }

      // Fetch profile + alerts in parallel to halve the wait time
      const profilePromise = supabase
        .from('profiles')
        .select('id, username, admin_role')
        .eq('id', user.id)
        .single();

      const alertsPromise = supabase
        .from('admin_alerts')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: false });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
      );

      let profile: { id: string; username: string; admin_role: string } | null = null;
      let profileError: { message: string; code: string } | null = null;

      try {
        const result = await Promise.race([profilePromise, timeoutPromise]);
        profile = result.data;
        profileError = result.error as { message: string; code: string } | null;
        if (profileError) {
          console.error('[adminStore.init] profile query error:', profileError.code, profileError.message);
        }
      } catch (e) {
        profileError = { message: String(e), code: 'TIMEOUT' };
      }

      if (profileError) {
        console.error('[adminStore.init] profile fetch error:', profileError.message, profileError.code);
        set({ adminProfile: null, loading: false });
        return;
      }

      if (!profile) {
        console.warn('[adminStore.init] no profile row found for user', user.id);
        set({ adminProfile: null, loading: false });
        return;
      }

      const normalizedRole = normalizeAdminRole(profile.admin_role);
      if (!normalizedRole || !hasRequiredAdminRole(['super_admin', 'finance_admin', 'support_agent', 'game_manager'], normalizedRole)) {
        console.warn('[adminStore.init] profile has no valid admin_role:', profile);
        set({ adminProfile: null, loading: false });
        return;
      }

      // Set profile immediately — don't wait for alerts
      set({
        adminProfile: {
          id: profile.id,
          username: profile.username,
          admin_role: normalizedRole,
        },
        loading: false,
      });

      // Resolve alerts in background (already in-flight from the parallel fetch)
      void alertsPromise.then(({ data: alerts }) => {
        if (alerts) {
          set({ alerts: alerts as AdminAlert[], unreadAlertCount: alerts.length });
        }
      });

    } catch (err) {
      console.error('[adminStore.init] unexpected error:', err);
      set({ adminProfile: null, loading: false });
    }
  },

  signOut: async () => {
    // Clear client state immediately — never block on network calls
    set({ adminProfile: null, alerts: [], unreadAlertCount: 0, sessionExpiresAt: null });
    // Fire-and-forget: end server session and revoke Supabase token
    // Both are best-effort — a 3s timeout prevents hanging
    const cleanup = async () => {
      await Promise.resolve(supabase.rpc('end_admin_session')).catch(() => {});
      await Promise.race([
        supabase.auth.signOut(),
        new Promise<void>((resolve) => setTimeout(resolve, 3_000)),
      ]);
    };
    void cleanup();
  },

  startSession: async () => {
    try {
      const { data, error } = await supabase.rpc('start_admin_session', {
        p_timeout_minutes: SESSION_TIMEOUT_MINUTES,
      });
      if (!error && data?.expiresAt) {
        set({ sessionExpiresAt: data.expiresAt });
      }
      // If RPC fails (migration not yet run), log but don't block login
      if (error) console.warn('[adminStore] start_admin_session RPC unavailable:', error.message);
    } catch (err) {
      console.warn('[adminStore] startSession failed:', err);
    }
  },

  checkSession: async () => {
    try {
      const { data, error } = await supabase.rpc('check_admin_session');

      // RPC infrastructure error (not deployed, network issue) — treat as valid
      // so a deployment gap doesn't boot all admins. Log for visibility.
      if (error) {
        console.warn('[adminStore] check_admin_session RPC unavailable:', error.message);
        return 'valid';
      }

      if (!data?.valid) {
        // Server explicitly says session is invalid/expired
        const reason = data?.reason ?? 'unknown';
        console.info('[adminStore] session invalid:', reason);
        await supabase.auth.signOut();
        set({ adminProfile: null, alerts: [], unreadAlertCount: 0, sessionExpiresAt: null });
        return 'expired';
      }

      set({ sessionExpiresAt: data.expiresAt });
      if (data.secondsRemaining <= 300) return 'expiring';
      return 'valid';
    } catch (err) {
      // Network/unexpected error — don't log out, just treat as valid
      console.warn('[adminStore] checkSession error (treating as valid):', err);
      return 'valid';
    }
  },

  refreshSession: async () => {
    try {
      const { data, error } = await supabase.rpc('refresh_admin_session', {
        p_timeout_minutes: SESSION_TIMEOUT_MINUTES,
      });
      if (error) {
        console.warn('[adminStore] refresh_admin_session RPC unavailable:', error.message);
        return true; // Don't force logout on RPC failure
      }
      if (!data?.success) return false;
      set({ sessionExpiresAt: data.expiresAt });
      return true;
    } catch (err) {
      console.warn('[adminStore] refreshSession error:', err);
      return true; // Don't force logout on network error
    }
  },

  subscribeToAlerts: () => {
    const channel = supabase
      .channel('admin_alerts_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin_alerts' },
        () => {
          // Re-fetch unresolved alerts on any change
          supabase
            .from('admin_alerts')
            .select('*')
            .eq('resolved', false)
            .order('created_at', { ascending: false })
            .then(({ data }) => {
              if (data) {
                set({ alerts: data as AdminAlert[], unreadAlertCount: data.length });
              }
            });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },

  auditLog: async (entry) => {
    try {
      await supabase.from('admin_audit_logs').insert(entry);
    } catch (err) {
      // Best-effort — never block the primary action
      console.error('[adminStore.auditLog]', err);
    }
  },

  dismissAlert: async (alertId) => {
    try {
      await supabase
        .from('admin_alerts')
        .update({ resolved: true })
        .eq('id', alertId);

      set((s) => {
        const alerts = s.alerts.filter((a) => a.id !== alertId);
        return { alerts, unreadAlertCount: alerts.length };
      });
    } catch (err) {
      console.error('[adminStore.dismissAlert]', err);
    }
  },
}));
