import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminStore, type FraudFlag } from '../../store/adminStore';
import { useRiskAssessmentStore } from '../../store/riskAssessmentStore';
import { useToast } from '../../components/admin/ToastProvider';
import ConfirmModal from '../../components/admin/ConfirmModal';
import DataTable, { type Column } from '../../components/admin/DataTable';
import StatCard from '../../components/admin/StatCard';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';
import type { RiskAssessment } from '../../logic/riskEngine';

// ── Fraud flag types ──────────────────────────────────────────────────────────

interface FraudRow extends FraudFlag {
  profiles: { username: string } | null;
}

const reasonLabels: Record<FraudFlag['reason'], string> = {
  rapid_high_bets: 'Rapid High Bets',
  high_win_rate:   'High Win Rate',
};

const reasonColors: Record<FraudFlag['reason'], string> = {
  rapid_high_bets: 'bg-red-500/20 text-red-400 border border-red-500/30',
  high_win_rate:   'bg-orange-500/20 text-orange-400 border border-orange-500/30',
};

// ── Risk level badge helpers ──────────────────────────────────────────────────

const levelColors: Record<RiskAssessment['riskLevel'], string> = {
  LOW:      'bg-green-500/20 text-green-400 border border-green-500/30',
  MEDIUM:   'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  HIGH:     'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  CRITICAL: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

const signalSeverityColors: Record<string, string> = {
  high:   'bg-red-500/20 text-red-400 border border-red-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  low:    'bg-white/10 text-white/60 border border-white/20',
};

// ── Risk detail panel ─────────────────────────────────────────────────────────

function RiskDetailPanel({
  assessment,
  onClose,
}: {
  assessment: RiskAssessment & { username?: string };
  onClose: () => void;
}) {
  // Sort signals: high → medium → low
  const sorted = [...assessment.signals].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-white font-semibold text-sm">
            {assessment.username ?? assessment.userId.slice(0, 8)}
          </span>
          <span className="ml-2 text-white/40 text-xs">{assessment.userId}</span>
        </div>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/80 text-xs transition-colors"
        >
          ✕ Close
        </button>
      </div>

      {/* Score overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <p className="text-white/40 text-xs mb-1">Overall</p>
          <p className="text-white text-xl font-bold">{assessment.overallScore}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${levelColors[assessment.riskLevel]}`}>
            {assessment.riskLevel}
          </span>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <p className="text-white/40 text-xs mb-1">Fraud</p>
          <p className="text-orange-400 text-xl font-bold">{assessment.fraudRisk}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <p className="text-white/40 text-xs mb-1">RG</p>
          <p className="text-yellow-400 text-xl font-bold">{assessment.rgRisk}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <p className="text-white/40 text-xs mb-1">Account</p>
          <p className="text-blue-400 text-xl font-bold">{assessment.accountRisk}</p>
        </div>
      </div>

      {/* Recommended action */}
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg px-4 py-3">
        <p className="text-purple-400 text-xs font-semibold mb-0.5">Recommended Action</p>
        <p className="text-white text-sm">{assessment.recommendedAction}</p>
      </div>

      {/* Risk signals */}
      <div>
        <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-2">
          Risk Signals {sorted.length === 0 && '— None detected'}
        </p>
        {sorted.length > 0 && (
          <ul className="flex flex-col gap-2">
            {sorted.map((signal, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${signalSeverityColors[signal.severity]}`}>
                  {signal.severity.toUpperCase()}
                </span>
                <span className="text-white/70 text-sm">{signal.description}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Assessment timestamp */}
      <p className="text-white/30 text-xs">
        Assessed: {new Date(assessment.assessedAt).toLocaleString()}
      </p>
    </div>
  );
}

// ── Main FraudPage ────────────────────────────────────────────────────────────

export default function FraudPage() {
  const { toast }                                               = useToast();
  const { auditLog, adminProfile }                              = useAdminStore();
  const {
    assessments, selectedAssessment, loading: riskLoading,
    error: riskError, batchProgress,
    fetchAssessments, selectAssessment, clearSelection,
    triggerAssessment, triggerBatch,
  } = useRiskAssessmentStore();

  // Fraud flags state
  const [flags, setFlags]               = useState<FraudRow[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [dismissConfirm, setDismissConfirm] = useState<string | null>(null);

  // Per-row assessment loading
  const [assessingId, setAssessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAssessments();
    fetchFlags();
  }, []);

  async function fetchFlags() {
    const { data } = await supabase
      .from('fraud_flags')
      .select('*, profiles(username)')
      .eq('dismissed', false)
      .order('created_at', { ascending: false });
    setFlags((data as FraudRow[]) ?? []);
    setFlagsLoading(false);
  }

  async function applyBetLimit(flag: FraudRow) {
    await supabase.from('fraud_flags').update({ bet_limit_applied: true }).eq('id', flag.id);
    await supabase.from('admin_game_config').upsert(
      { game_id: `user_${flag.user_id}`, enabled: true, min_bet: 10, max_bet: 500, volatility: 'medium' },
      { onConflict: 'game_id' },
    );
    await auditLog({
      admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin',
      action_type: 'bet_limit_apply', target_entity: 'fraud_flags', target_id: flag.id,
      previous_value: false, new_value: true, ip_address: null,
    });
    toast('Bet limit applied.', 'success');
    fetchFlags();
  }

  async function dismissFlag(id: string) {
    await supabase.from('fraud_flags').update({ dismissed: true }).eq('id', id);
    await auditLog({
      admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin',
      action_type: 'fraud_flag_dismiss', target_entity: 'fraud_flags', target_id: id,
      previous_value: false, new_value: true, ip_address: null,
    });
    toast('Flag dismissed.', 'info');
    setDismissConfirm(null);
    fetchFlags();
  }

  async function handleAssessPlayer(userId: string) {
    if (!adminProfile) return;
    setAssessingId(userId);
    // Clear any previous error so the banner doesn't linger from a prior attempt
    useRiskAssessmentStore.setState({ error: null });
    const result = await triggerAssessment(userId, adminProfile.id, adminProfile.admin_role);
    setAssessingId(null);
    if (result) {
      toast(`Assessment complete — ${result.riskLevel} (${result.overallScore}/100)`, 'success');
    } else {
      // Pull the error set by the store for a meaningful message
      const storeError = useRiskAssessmentStore.getState().error;
      toast(storeError ?? 'Assessment failed. Check console for details.', 'error');
    }
  }

  async function handleBatchAssess() {
    if (!adminProfile) return;
    toast('Batch assessment started…', 'info');
    await triggerBatch(adminProfile.id, adminProfile.admin_role);
    toast('Batch assessment complete.', 'success');
  }

  // ── Risk level counts for summary cards ──────────────────────────────────
  const counts = {
    LOW:      assessments.filter((a) => a.riskLevel === 'LOW').length,
    MEDIUM:   assessments.filter((a) => a.riskLevel === 'MEDIUM').length,
    HIGH:     assessments.filter((a) => a.riskLevel === 'HIGH').length,
    CRITICAL: assessments.filter((a) => a.riskLevel === 'CRITICAL').length,
  };

  // ── Risk assessment table columns ─────────────────────────────────────────
  type AssessmentRow = RiskAssessment & { username?: string };

  const riskColumns: Column<AssessmentRow>[] = [
    {
      key: 'userId',
      label: 'Player',
      render: (r) => <span className="text-white/80">{r.username ?? r.userId.slice(0, 8)}</span>,
    },
    {
      key: 'overallScore',
      label: 'Score',
      render: (r) => (
        <span className="font-bold text-white">{r.overallScore}<span className="text-white/30 font-normal">/100</span></span>
      ),
    },
    {
      key: 'riskLevel',
      label: 'Level',
      render: (r) => (
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${levelColors[r.riskLevel]}`}>
          {r.riskLevel}
        </span>
      ),
    },
    {
      key: 'fraudRisk',
      label: 'Fraud',
      render: (r) => <span className="text-orange-400">{r.fraudRisk}</span>,
    },
    {
      key: 'rgRisk',
      label: 'RG',
      render: (r) => <span className="text-yellow-400">{r.rgRisk}</span>,
    },
    {
      key: 'accountRisk',
      label: 'Account',
      render: (r) => <span className="text-blue-400">{r.accountRisk}</span>,
    },
    {
      key: 'assessedAt',
      label: 'Assessed',
      render: (r) => <span className="text-white/40 text-xs">{new Date(r.assessedAt).toLocaleString()}</span>,
    },
    {
      key: 'userId' as keyof AssessmentRow,
      label: 'Actions',
      render: (r) => (
        <div className="flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); void handleAssessPlayer(r.userId); }}
            disabled={assessingId === r.userId}
            className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs transition-colors"
          >
            {assessingId === r.userId ? '…' : 'Assess'}
          </button>
        </div>
      ),
    },
  ];

  // ── Fraud flag table columns ──────────────────────────────────────────────
  const flagColumns: Column<FraudRow>[] = [
    { key: 'profiles', label: 'Player', render: (r) => r.profiles?.username ?? r.user_id.slice(0, 8) },
    {
      key: 'reason', label: 'Reason',
      render: (r) => (
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${reasonColors[r.reason]}`}>
          {reasonLabels[r.reason]}
        </span>
      ),
    },
    { key: 'created_at', label: 'Flagged At', render: (r) => new Date(r.created_at).toLocaleString() },
    {
      key: 'bet_limit_applied', label: 'Bet Limit',
      render: (r) => r.bet_limit_applied
        ? <span className="text-xs text-green-400">Applied</span>
        : <span className="text-xs text-white/40">None</span>,
    },
    {
      key: 'id', label: 'Actions',
      render: (r) => (
        <div className="flex gap-1">
          {!r.bet_limit_applied && (
            <button
              onClick={(e) => { e.stopPropagation(); applyBetLimit(r); }}
              className="px-2 py-1 rounded bg-yellow-600 hover:bg-yellow-500 text-white text-xs transition-colors"
            >
              Apply Limit
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setDismissConfirm(r.id); }}
            className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-white text-xs transition-colors"
          >
            Dismiss
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">

      {/* ── Section 1: Risk Assessment Engine ─────────────────────────────── */}
      <div className="flex flex-col gap-6">

        {/* Section header + controls */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-white font-semibold text-lg">Player Risk Assessment</h2>
            <p className="text-white/40 text-sm mt-0.5">
              Rules-based heuristic scoring · Fraud 50% · RG 30% · Account 20%
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchAssessments()}
              disabled={riskLoading}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm transition-colors disabled:opacity-50"
            >
              ↻ Refresh
            </button>
            <button
              onClick={handleBatchAssess}
              disabled={riskLoading || !!batchProgress}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {batchProgress
                ? `Assessing… ${batchProgress.current}/${batchProgress.total}`
                : 'Assess All Players'}
            </button>
          </div>
        </div>

        {/* Error banner */}
        {riskError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-3">
            <p className="text-red-400 text-sm">{riskError}</p>
          </div>
        )}

        {/* Summary StatCards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard title="LOW Risk"      value={counts.LOW}      icon="✅" color="green"  />
          <StatCard title="MEDIUM Risk"   value={counts.MEDIUM}   icon="⚠️" color="yellow" />
          <StatCard title="HIGH Risk"     value={counts.HIGH}     icon="🔶" color="yellow" />
          <StatCard title="CRITICAL Risk" value={counts.CRITICAL} icon="🚨" color="red"    />
        </div>

        {/* Detail panel */}
        {selectedAssessment && (
          <RiskDetailPanel
            assessment={selectedAssessment}
            onClose={clearSelection}
          />
        )}

        {/* Risk assessment table */}
        {riskLoading ? (
          <LoadingSkeleton rows={6} />
        ) : (
          <DataTable<AssessmentRow>
            columns={riskColumns}
            data={assessments}
            pageSize={15}
            emptyMessage="No risk assessments yet. Click 'Assess All Players' to run the engine."
            onRowClick={(row) => void selectAssessment(row.userId)}
          />
        )}
      </div>

      {/* ── Divider ────────────────────────────────────────────────────────── */}
      <div className="border-t border-white/10" />

      {/* ── Section 2: Fraud Flags (existing) ─────────────────────────────── */}
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-white font-semibold text-lg">Automated Fraud Flags</h2>
          <p className="text-white/40 text-sm mt-0.5">
            Flagged by real-time game rules: &gt;20 bets &gt;KES 5,000 in 60s, or win rate &gt;80% over 50 bets.
          </p>
        </div>

        {/* Fraud stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="Active Flags"       value={flags.length}                                        icon="🚨" color="red"    />
          <StatCard title="Bet Limits Applied"  value={flags.filter((f) => f.bet_limit_applied).length}     icon="🔒" color="yellow" />
          <StatCard title="Rapid High Bets"     value={flags.filter((f) => f.reason === 'rapid_high_bets').length} icon="⚡" color="purple" />
        </div>

        {flagsLoading ? (
          <LoadingSkeleton rows={5} />
        ) : (
          <DataTable<FraudRow>
            columns={flagColumns}
            data={flags}
            pageSize={15}
            emptyMessage="No active fraud flags."
          />
        )}
      </div>

      {/* Dismiss modals */}
      {flags.map((f) => (
        <ConfirmModal
          key={f.id}
          isOpen={dismissConfirm === f.id}
          onClose={() => setDismissConfirm(null)}
          onConfirm={() => dismissFlag(f.id)}
          title="Dismiss Flag"
          message={`Dismiss fraud flag for ${f.profiles?.username ?? f.user_id.slice(0, 8)}?`}
          confirmLabel="Dismiss"
        />
      ))}
    </div>
  );
}
