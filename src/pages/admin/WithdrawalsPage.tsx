import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminStore } from '../../store/adminStore';
import { useToast } from '../../components/admin/ToastProvider';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';
import DataTable, { Column } from '../../components/admin/DataTable';
import StatCard from '../../components/admin/StatCard';

interface WithdrawalRow {
  id: string;
  user_id: string;
  amount: number;
  phone: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  rejection_reason: string | null;
  profiles: { username: string; balance: number } | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  approved:   'bg-blue-500/20 text-blue-400 border-blue-500/30',
  processing: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  completed:  'bg-green-500/20 text-green-400 border-green-500/30',
  rejected:   'bg-red-500/20 text-red-400 border-red-500/30',
  failed:     'bg-red-700/20 text-red-500 border-red-700/30',
};

export default function WithdrawalsPage() {
  const { toast } = useToast();
  const { auditLog, adminProfile } = useAdminStore();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function fetchWithdrawals() {
    const query = supabase
      .from('transactions')
      .select('id, user_id, amount, phone, status, created_at, approved_at, rejection_reason, profiles(username, balance)')
      .eq('type', 'withdrawal')
      .order('created_at', { ascending: false });

    const { data } = await query;
    setWithdrawals((data ?? []).map((row: any) => ({
      ...row,
      profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles ?? null,
    })) as WithdrawalRow[]);
    setLoading(false);
  }

  useEffect(() => { fetchWithdrawals(); }, []);

  const filtered = statusFilter === 'all'
    ? withdrawals
    : withdrawals.filter((w) => w.status === statusFilter);

  const pending = withdrawals.filter((w) => w.status === 'pending').length;
  const totalPending = withdrawals.filter((w) => w.status === 'pending').reduce((s, w) => s + w.amount, 0);
  const totalCompleted = withdrawals.filter((w) => w.status === 'completed').reduce((s, w) => s + w.amount, 0);

  async function handleApprove(row: WithdrawalRow) {
    setActionLoading(row.id);
    await supabase.from('transactions')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', row.id);
    await auditLog({
      admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin',
      action_type: 'withdrawal_approve', target_entity: 'transactions', target_id: row.id,
      previous_value: 'pending', new_value: 'approved', ip_address: null,
    });
    toast(`Withdrawal approved — KES ${row.amount.toLocaleString()} to ${row.phone}`, 'success');
    setActionLoading(null);
    fetchWithdrawals();
  }

  async function handleMarkCompleted(row: WithdrawalRow) {
    setActionLoading(row.id);
    await supabase.from('transactions')
      .update({ status: 'completed' })
      .eq('id', row.id);
    await auditLog({
      admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin',
      action_type: 'withdrawal_complete', target_entity: 'transactions', target_id: row.id,
      previous_value: 'approved', new_value: 'completed', ip_address: null,
    });
    toast('Marked as completed.', 'success');
    setActionLoading(null);
    fetchWithdrawals();
  }

  async function handleReject() {
    if (!rejectId) return;
    setActionLoading(rejectId);
    const row = withdrawals.find((w) => w.id === rejectId)!;

    // Refund balance
    if (row.profiles) {
      const refundedBalance = row.profiles.balance + row.amount;
      await supabase.from('profiles').update({ balance: refundedBalance }).eq('id', row.user_id);
    }

    await supabase.from('transactions')
      .update({ status: 'rejected', rejection_reason: rejectReason || 'Rejected by admin' })
      .eq('id', rejectId);
    await auditLog({
      admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin',
      action_type: 'withdrawal_reject', target_entity: 'transactions', target_id: rejectId,
      previous_value: 'pending', new_value: 'rejected', ip_address: null,
    });
    toast('Withdrawal rejected. Balance refunded.', 'info');
    setRejectId(null);
    setRejectReason('');
    setActionLoading(null);
    fetchWithdrawals();
  }

  const columns: Column<WithdrawalRow>[] = [
    { key: 'id', label: 'ID', render: (r) => <span className="font-mono text-white/40 text-xs">{r.id.slice(0, 8).toUpperCase()}</span> },
    { key: 'profiles', label: 'Player', render: (r) => <span className="text-white font-semibold">{r.profiles?.username ?? '—'}</span> },
    { key: 'amount', label: 'Amount', render: (r) => <span className="text-red-400 font-orbitron font-bold">KES {r.amount.toLocaleString()}</span> },
    { key: 'phone', label: 'Phone', render: (r) => <span className="font-mono text-white/60 text-xs">{r.phone}</span> },
    {
      key: 'status', label: 'Status',
      render: (r) => (
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase border ${STATUS_COLORS[r.status] ?? 'bg-white/10 text-white/50'}`}>
          {r.status}
        </span>
      ),
    },
    { key: 'created_at', label: 'Requested', render: (r) => <span className="text-white/50 text-xs">{new Date(r.created_at).toLocaleString()}</span> },
    {
      key: 'id', label: 'Actions',
      render: (r) => (
        <div className="flex gap-1">
          {r.status === 'pending' && (
            <>
              <button
                onClick={() => handleApprove(r)}
                disabled={actionLoading === r.id}
                className="px-2 py-1 rounded bg-green-600 hover:bg-green-500 text-white text-xs transition-colors disabled:opacity-50">
                Approve
              </button>
              <button
                onClick={() => { setRejectId(r.id); setRejectReason(''); }}
                disabled={actionLoading === r.id}
                className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs transition-colors disabled:opacity-50">
                Reject
              </button>
            </>
          )}
          {r.status === 'approved' && (
            <button
              onClick={() => handleMarkCompleted(r)}
              disabled={actionLoading === r.id}
              className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs transition-colors disabled:opacity-50">
              Mark Done
            </button>
          )}
          {r.rejection_reason && (
            <span className="text-red-400/60 text-xs italic truncate max-w-[80px]" title={r.rejection_reason}>
              {r.rejection_reason}
            </span>
          )}
        </div>
      ),
    },
  ];

  if (loading) return <LoadingSkeleton rows={8} />;

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Pending Requests" value={pending} icon="⏳" color="yellow" />
        <StatCard title="Pending Amount" value={`KES ${totalPending.toLocaleString()}`} icon="💸" color="red" />
        <StatCard title="Total Paid Out" value={`KES ${totalCompleted.toLocaleString()}`} icon="✅" color="green" />
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'approved', 'completed', 'rejected', 'failed'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-orbitron tracking-wider capitalize transition-colors ${
              statusFilter === s ? 'bg-[#FFD700] text-black' : 'bg-white/5 text-white/50 hover:bg-white/10'
            }`}>
            {s}
          </button>
        ))}
      </div>

      <DataTable<WithdrawalRow>
        columns={columns}
        data={filtered}
        pageSize={15}
        emptyMessage="No withdrawal requests."
      />

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRejectId(null)} />
          <div className="relative z-10 w-full max-w-sm bg-[#111118]/95 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
            <h3 className="font-orbitron text-white font-bold">Reject Withdrawal</h3>
            <div className="flex flex-col gap-1">
              <label className="text-white/40 text-xs uppercase tracking-widest">Reason (optional)</label>
              <input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Suspicious activity"
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-400/50"
              />
            </div>
            <p className="text-white/40 text-xs">The withdrawn amount will be refunded to the player's balance.</p>
            <div className="flex gap-3">
              <button onClick={() => setRejectId(null)} className="flex-1 py-2 rounded-lg bg-white/10 text-white/60 text-sm hover:bg-white/15 transition-colors">Cancel</button>
              <button onClick={handleReject} className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors">Reject & Refund</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
