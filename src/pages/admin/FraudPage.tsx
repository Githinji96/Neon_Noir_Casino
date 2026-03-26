import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminStore, FraudFlag } from '../../store/adminStore';
import { useToast } from '../../components/admin/ToastProvider';
import ConfirmModal from '../../components/admin/ConfirmModal';
import DataTable, { Column } from '../../components/admin/DataTable';
import StatCard from '../../components/admin/StatCard';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';

interface FraudRow extends FraudFlag {
  profiles: { username: string } | null;
}

const reasonLabels: Record<FraudFlag['reason'], string> = {
  rapid_high_bets: 'Rapid High Bets',
  high_win_rate: 'High Win Rate',
};

const reasonColors: Record<FraudFlag['reason'], string> = {
  rapid_high_bets: 'bg-red-500/20 text-red-400 border border-red-500/30',
  high_win_rate: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
};

export default function FraudPage() {
  const { toast } = useToast();
  const { auditLog, adminProfile } = useAdminStore();
  const [flags, setFlags] = useState<FraudRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissConfirm, setDismissConfirm] = useState<string | null>(null);

  async function fetchFlags() {
    const { data } = await supabase
      .from('fraud_flags')
      .select('*, profiles(username)')
      .eq('dismissed', false)
      .order('created_at', { ascending: false });
    setFlags((data as FraudRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchFlags(); }, []);

  async function applyBetLimit(flag: FraudRow) {
    await supabase.from('fraud_flags').update({ bet_limit_applied: true }).eq('id', flag.id);
    await supabase.from('admin_game_config').upsert({ game_id: `user_${flag.user_id}`, enabled: true, min_bet: 10, max_bet: 500, volatility: 'medium' }, { onConflict: 'game_id' });
    await auditLog({ admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin', action_type: 'bet_limit_apply', target_entity: 'fraud_flags', target_id: flag.id, previous_value: false, new_value: true, ip_address: null });
    toast('Bet limit applied.', 'success');
    fetchFlags();
  }

  async function dismissFlag(id: string) {
    await supabase.from('fraud_flags').update({ dismissed: true }).eq('id', id);
    await auditLog({ admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin', action_type: 'fraud_flag_dismiss', target_entity: 'fraud_flags', target_id: id, previous_value: false, new_value: true, ip_address: null });
    toast('Flag dismissed.', 'info');
    setDismissConfirm(null);
    fetchFlags();
  }

  const columns: Column<FraudRow>[] = [
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
            <button onClick={(e) => { e.stopPropagation(); applyBetLimit(r); }} className="px-2 py-1 rounded bg-yellow-600 hover:bg-yellow-500 text-white text-xs transition-colors">Apply Limit</button>
          )}
          <button onClick={(e) => { e.stopPropagation(); setDismissConfirm(r.id); }} className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-white text-xs transition-colors">Dismiss</button>
        </div>
      ),
    },
  ];

  if (loading) return <LoadingSkeleton rows={6} />;

  return (
    <div className="flex flex-col gap-6">
      {/* Detection rules info */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-5 py-4">
        <p className="text-yellow-400 text-sm font-semibold mb-1">Detection Rules</p>
        <p className="text-white/60 text-sm">Players are flagged when: &gt;20 bets &gt;KES 5,000 in 60s, OR win rate &gt;80% over 50 bets.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Active Flags" value={flags.length} icon="🚨" color="red" />
        <StatCard title="Bet Limits Applied" value={flags.filter((f) => f.bet_limit_applied).length} icon="🔒" color="yellow" />
        <StatCard title="Rapid High Bets" value={flags.filter((f) => f.reason === 'rapid_high_bets').length} icon="⚡" color="purple" />
      </div>

      <DataTable<FraudRow>
        columns={columns}
        data={flags}
        pageSize={15}
        emptyMessage="No active fraud flags."
      />

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
