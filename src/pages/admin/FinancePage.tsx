import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminStore } from '../../store/adminStore';
import { useToast } from '../../components/admin/ToastProvider';
import DataTable, { Column } from '../../components/admin/DataTable';
import StatCard from '../../components/admin/StatCard';

interface TxRow {
  id: string;
  created_at: string;
  amount: number;
  type: string;
  status: string;
  mpesa_receipt: string | null;
  profiles: { username: string } | null;
}

function downloadCSV(rows: TxRow[]) {
  const header = 'ID,Player,Amount,Type,Status,Receipt,Date';
  const lines = rows.map((r) =>
    [r.id, r.profiles?.username ?? '', r.amount, r.type, r.status, r.mpesa_receipt ?? '', new Date(r.created_at).toLocaleString()].join(',')
  );
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'transactions.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function FinancePage() {
  const { toast } = useToast();
  const { auditLog, adminProfile } = useAdminStore();
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  async function fetchTx() {
    const { data } = await supabase
      .from('transactions')
      .select('*, profiles(username)')
      .order('created_at', { ascending: false });
    setTransactions((data as TxRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchTx(); }, []);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (startDate && t.created_at < startDate) return false;
      if (endDate && t.created_at > endDate + 'T23:59:59') return false;
      return true;
    });
  }, [transactions, statusFilter, typeFilter, startDate, endDate]);

  async function handleApprove(id: string) {
    await supabase.from('transactions').update({ status: 'approved' }).eq('id', id);
    await auditLog({ admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin', action_type: 'withdrawal_approve', target_entity: 'transactions', target_id: id, previous_value: 'pending', new_value: 'approved', ip_address: null });
    toast('Withdrawal approved.', 'success');
    fetchTx();
  }

  async function handleReject(id: string) {
    await supabase.from('transactions').update({ status: 'rejected' }).eq('id', id);
    await auditLog({ admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin', action_type: 'withdrawal_reject', target_entity: 'transactions', target_id: id, previous_value: 'pending', new_value: 'rejected', ip_address: null });
    toast('Withdrawal rejected.', 'info');
    fetchTx();
  }

  async function handleRetry(row: TxRow) {
    try {
      await supabase.functions.invoke('mpesa-stk', { body: { transactionId: row.id, amount: row.amount } });
      await auditLog({ admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin', action_type: 'payment_retry', target_entity: 'transactions', target_id: row.id, previous_value: 'failed', new_value: 'pending', ip_address: null });
      toast('Payment retry initiated.', 'info');
    } catch {
      toast('Retry failed.', 'error');
    }
    fetchTx();
  }

  const totalDeposits = filtered.filter((t) => t.type === 'deposit' && t.status === 'success').reduce((a, t) => a + t.amount, 0);
  const totalWithdrawals = filtered.filter((t) => t.type === 'withdrawal' && t.status === 'success').reduce((a, t) => a + t.amount, 0);
  const pendingCount = filtered.filter((t) => t.status === 'pending').length;

  const columns: Column<TxRow>[] = [
    { key: 'id', label: 'ID', render: (r) => <span className="font-mono text-white/50 text-xs">{r.id.slice(0, 8)}</span> },
    { key: 'profiles', label: 'Player', render: (r) => r.profiles?.username ?? '—' },
    { key: 'amount', label: 'Amount', render: (r) => <span className="text-[#FFD700] font-mono">KES {r.amount.toLocaleString()}</span> },
    { key: 'type', label: 'Type', render: (r) => <span className="capitalize text-white/70">{r.type}</span> },
    {
      key: 'status', label: 'Status',
      render: (r) => (
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${
          r.status === 'success' || r.status === 'approved' ? 'bg-green-500/20 text-green-400' :
          r.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-red-500/20 text-red-400'
        }`}>{r.status}</span>
      ),
    },
    { key: 'mpesa_receipt', label: 'Receipt', render: (r) => <span className="font-mono text-white/40 text-xs">{r.mpesa_receipt ?? '—'}</span> },
    { key: 'created_at', label: 'Date', render: (r) => new Date(r.created_at).toLocaleString() },
    {
      key: 'id', label: 'Actions',
      render: (r) => (
        <div className="flex gap-1">
          {r.status === 'pending' && (
            <>
              <button onClick={(e) => { e.stopPropagation(); handleApprove(r.id); }} className="px-2 py-1 rounded bg-green-600 hover:bg-green-500 text-white text-xs transition-colors">Approve</button>
              <button onClick={(e) => { e.stopPropagation(); handleReject(r.id); }} className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs transition-colors">Reject</button>
            </>
          )}
          {r.status === 'failed' && (
            <button onClick={(e) => { e.stopPropagation(); handleRetry(r); }} className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs transition-colors">Retry</button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Total Deposits" value={`KES ${totalDeposits.toLocaleString()}`} icon="💳" color="green" />
        <StatCard title="Total Withdrawals" value={`KES ${totalWithdrawals.toLocaleString()}`} icon="💸" color="red" />
        <StatCard title="Pending" value={pendingCount} icon="⏳" color="yellow" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-white/40 text-xs uppercase tracking-widest">From</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/50" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-white/40 text-xs uppercase tracking-widest">To</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/50" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-white/40 text-xs uppercase tracking-widest">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/50">
            {['all', 'pending', 'success', 'failed', 'approved', 'rejected'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-white/40 text-xs uppercase tracking-widest">Type</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/50">
            {['all', 'deposit', 'withdrawal', 'bet', 'payout'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={() => downloadCSV(filtered)} className="ml-auto px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-colors">
          Export CSV
        </button>
      </div>

      <DataTable<TxRow> columns={columns} data={filtered} loading={loading} pageSize={15} emptyMessage="No transactions found." />
    </div>
  );
}
