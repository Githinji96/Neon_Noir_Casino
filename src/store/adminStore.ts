import { create } from 'zustand';
import { supabase } from '../lib/supabase';

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
  | 'fraud_flag_dismiss';

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

interface AdminState {
  adminProfile: AdminProfile | null;
  loading: boolean;
  alerts: AdminAlert[];
  unreadAlertCount: number;

  init: () => Promise<void>;
  signOut: () => Promise<void>;
  subscribeToAlerts: () => () => void;
  auditLog: (entry: Omit<AuditLogEntry, 'id' | 'created_at'>) => Promise<void>;
  dismissAlert: (alertId: string) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set) => ({
  adminProfile: null,
  loading: true,  // start true — guard shows spinner until init() resolves
  alerts: [],
  unreadAlertCount: 0,

  init: async () => {
    set({ loading: true });
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('[adminStore.init] getUser error:', userError.message);
        set({ adminProfile: null, loading: false });
        return;
      }
      if (!user) {
        set({ adminProfile: null, loading: false });
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, admin_role')
        .eq('id', user.id)
        .single();

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

      if (!profile.admin_role) {
        console.warn('[adminStore.init] profile has no admin_role:', profile);
        set({ adminProfile: null, loading: false });
        return;
      }

      set({
        adminProfile: {
          id: profile.id,
          username: profile.username,
          admin_role: profile.admin_role as AdminRole,
        },
        loading: false,
      });

      // Load initial alerts
      const { data: alerts } = await supabase
        .from('admin_alerts')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: false });

      if (alerts) {
        set({ alerts: alerts as AdminAlert[], unreadAlertCount: alerts.length });
      }
    } catch (err) {
      console.error('[adminStore.init] unexpected error:', err);
      set({ adminProfile: null, loading: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ adminProfile: null, alerts: [], unreadAlertCount: 0 });
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
