/**
 * Risk Assessment Store — Zustand
 *
 * Manages the state of risk assessments displayed in the admin Fraud Page.
 * Provides fetch, select, refresh, individual assessment trigger, and batch trigger.
 */
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { assessPlayer, assessAllPlayers } from '../logic/riskEngine';
import type { RiskAssessment } from '../logic/riskEngine';

// ── DB row shape (what Supabase returns) ──────────────────────────────────────

interface RiskAssessmentRow {
  id: string;
  user_id: string;
  overall_score: number;
  fraud_risk: number;
  rg_risk: number;
  account_risk: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  signals: RiskAssessment['signals'];
  recommended_action: string;
  features_metadata: RiskAssessment['features'] | null;
  assessed_at: string;
  profiles?: { username: string } | null;
}

function rowToAssessment(row: RiskAssessmentRow): RiskAssessment {
  return {
    userId:            row.user_id,
    overallScore:      row.overall_score,
    fraudRisk:         row.fraud_risk,
    rgRisk:            row.rg_risk,
    accountRisk:       row.account_risk,
    riskLevel:         row.risk_level,
    signals:           row.signals ?? [],
    recommendedAction: row.recommended_action,
    features:          row.features_metadata ?? ({} as RiskAssessment['features']),
    assessedAt:        row.assessed_at,
  };
}

// ── Store interface ───────────────────────────────────────────────────────────

interface RiskAssessmentState {
  assessments: (RiskAssessment & { username?: string })[];
  selectedAssessment: (RiskAssessment & { username?: string }) | null;
  loading: boolean;
  error: string | null;
  batchProgress: { current: number; total: number } | null;

  fetchAssessments: () => Promise<void>;
  selectAssessment: (userId: string) => Promise<void>;
  clearSelection: () => void;
  refresh: () => Promise<void>;
  triggerAssessment: (userId: string, adminId: string, adminRole: string) => Promise<RiskAssessment | null>;
  triggerBatch: (adminId: string, adminRole: string) => Promise<void>;
}

// ── Store implementation ──────────────────────────────────────────────────────

export const useRiskAssessmentStore = create<RiskAssessmentState>((set, get) => ({
  assessments:       [],
  selectedAssessment: null,
  loading:           false,
  error:             null,
  batchProgress:     null,

  // ── Fetch list of all assessments (with username from profiles join) ──────
  fetchAssessments: async () => {
    set({ loading: true, error: null });
    try {
      // Try with join first; fall back to plain select if FK not in schema cache
      let rows: RiskAssessmentRow[] = [];
      const { data, error } = await supabase
        .from('risk_assessments')
        .select('*, profiles(username)')
        .order('assessed_at', { ascending: false })
        .limit(500);

      if (error) {
        // Fallback: fetch without join, then manually fetch usernames
        const { data: plain, error: plainErr } = await supabase
          .from('risk_assessments')
          .select('*')
          .order('assessed_at', { ascending: false })
          .limit(500);
        if (plainErr) throw new Error(plainErr.message);
        rows = (plain ?? []) as RiskAssessmentRow[];

        // Batch fetch usernames
        const userIds = [...new Set(rows.map((r) => r.user_id))];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', userIds);
          const usernameMap = Object.fromEntries(
            (profiles ?? []).map((p: { id: string; username: string }) => [p.id, p.username])
          );
          rows = rows.map((r) => ({
            ...r,
            profiles: usernameMap[r.user_id] ? { username: usernameMap[r.user_id] } : null,
          }));
        }
      } else {
        rows = (data ?? []) as RiskAssessmentRow[];
      }

      const assessments = rows.map((row) => ({
        ...rowToAssessment(row),
        username: row.profiles?.username ?? row.user_id.slice(0, 8),
      }));

      set({ assessments, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch risk assessments',
      });
    }
  },

  // ── Select a single player's full assessment ──────────────────────────────
  selectAssessment: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('risk_assessments')
        .select('*, profiles(username)')
        .eq('user_id', userId)
        .single();

      if (error) throw new Error(error.message);

      const row = data as RiskAssessmentRow;
      set({
        selectedAssessment: {
          ...rowToAssessment(row),
          username: row.profiles?.username ?? row.user_id.slice(0, 8),
        },
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load player assessment',
      });
    }
  },

  clearSelection: () => set({ selectedAssessment: null }),

  // ── Refresh list + selected assessment ────────────────────────────────────
  refresh: async () => {
    await get().fetchAssessments();
    const selected = get().selectedAssessment;
    if (selected) {
      await get().selectAssessment(selected.userId);
    }
  },

  // ── Trigger on-demand assessment for one player ───────────────────────────
  triggerAssessment: async (userId: string, adminId: string, adminRole: string) => {
    try {
      // Validate via RPC — best-effort, skip if RPC not yet deployed
      try {
        const { error: authError } = await supabase.rpc('assess_player_risk', {
          p_user_id: userId,
        });
        // Only hard-fail on explicit access-denied; ignore "function not found" etc.
        if (authError && authError.message.toLowerCase().includes('access denied')) {
          throw new Error(authError.message);
        }
      } catch (rpcErr) {
        const msg = rpcErr instanceof Error ? rpcErr.message : '';
        if (msg.toLowerCase().includes('access denied')) throw rpcErr;
        // Otherwise (migration not run, network hiccup) — continue
        console.warn('[riskAssessmentStore] assess_player_risk RPC unavailable:', msg);
      }

      const result = await assessPlayer(userId);

      // Audit log — best-effort, never block on failure
      void (async () => {
        try {
          await supabase.from('admin_audit_logs').insert({
            admin_id:       adminId,
            admin_role:     adminRole,
            action_type:    'risk_assessment_manual',
            target_entity:  'risk_assessments',
            target_id:      userId,
            previous_value: null,
            new_value:      { overall_score: result.overallScore, risk_level: result.riskLevel },
            ip_address:     null,
          });
        } catch (e) {
          console.warn('[riskAssessmentStore] audit log failed:', e);
        }
      })();

      // Refresh local list to show updated assessment
      await get().fetchAssessments();
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Assessment failed';
      set({ error: msg });
      return null;
    }
  },

  // ── Trigger batch assessment for all active players ───────────────────────
  triggerBatch: async (adminId: string, adminRole: string) => {
    set({ batchProgress: null, error: null });

    // Audit log: batch started
    await supabase.from('admin_audit_logs').insert({
      admin_id:       adminId,
      admin_role:     adminRole,
      action_type:    'risk_assessment_batch',
      target_entity:  'batch',
      target_id:      null,
      previous_value: null,
      new_value:      { started_at: new Date().toISOString() },
      ip_address:     null,
    });

    try {
      await assessAllPlayers((completed, total) => {
        set({ batchProgress: { current: completed, total } });
      });

      // Audit log: batch completed
      await supabase.from('admin_audit_logs').insert({
        admin_id:       adminId,
        admin_role:     adminRole,
        action_type:    'risk_assessment_batch',
        target_entity:  'batch',
        target_id:      null,
        previous_value: null,
        new_value:      { completed_at: new Date().toISOString() },
        ip_address:     null,
      });

      set({ batchProgress: null });
      await get().fetchAssessments();
    } catch (err) {
      set({
        batchProgress: null,
        error: err instanceof Error ? err.message : 'Batch assessment failed',
      });
    }
  },
}));
