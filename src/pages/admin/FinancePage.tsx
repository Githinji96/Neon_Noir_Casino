import { useEffect, useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  phone: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  user_id: string | null;
  profiles: { username: string } | null;
}

// ─── Transaction Detail Drawer ────────────────────────────────────────────────

function DetailDrawer({ tx, onClose }: { tx: TxRow; onClose: () => void }) {
  const fields: { label: string; value: string | null }[] = [
    { label: 'Transaction ID',  value: tx.id },
    { label: 'Player',          value: tx.profiles?.username ?? '—' },
    { label: 'Phone Number',    value: tx.phone ?? '—' },
    { label: 'Amount',          value: `KES ${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
    { label: 'Currency',        value: 'KES' },
    { label: 'Status',          value: tx.status.toUpperCase() },
    { label: 'Gateway',         value: 'M-Pesa (Safaricom Daraja)' },
    { label: 'Receipt',         value: tx.mpesa_receipt ?? '—' },
    { label: 'IP Address',      value: '—' },
    { label: 'Country',         value: 'Kenya' },
    { label: 'Created',         value: new Date(tx.created_at).toLocaleString() },
    { label: 'Approved By',     value: tx.approved_by ?? '—' },
    { label: 'Approved Time',   value: tx.approved_at ? new Date(tx.approved_at).toLocaleString() : '—' },
    { label: 'Rejection Reason',value: tx.rejection_reason ?? '—' },
  ];

  const statusColor =
    tx.status === 'success' || tx.status === 'approved' ? '#22c55e' :
    tx.status === 'pending' ? '#eab308' : '#ef4444';

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <motion.div
        className="relative z-10 w-full max-w-md h-full overflow-y-auto flex flex-col"
        style={{ background: 'linear-gradient(160deg,#0d0d1a,#060610)', borderLeft: '1px solid rgba(255,215,0,0.15)' }}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 shrink-0">
          <div>
            <p className="text-white/40 text-xs font-orbitron tracking-widest uppercase mb-1">Transaction Details</p>
            <h2 className="font-orbitron text-lg font-bold text-white">{tx.id.slice(0, 8).toUpperCase()}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all text-xl"
          >
            ✕
          </button>
        </div>

        {/* Status banner */}
        <div className="mx-6 mt-5 rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: `${statusColor}15`, border: `1px solid ${statusColor}40` }}>
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: statusColor }} />
          <span className="font-orbitron text-sm font-bold tracking-widest" style={{ color: statusColor }}>
            {tx.status.toUpperCase()}
          </span>
          <span className="text-white/40 text-xs capitalize ml-auto">{tx.type}</span>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-1 px-6 py-5">
          {fields.map(({ label, value }) => (
            <div key={label} className="flex items-start justify-between gap-4 py-2.5 border-b border-white/5 last:border-0">
              <span className="text-white/40 text-xs font-orbitron tracking-wider shrink-0">{label}</span>
              <span className="text-white text-xs text-right break-all font-mono">{value}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function downloadCSV(rows: TxRow[]) {
  const header = 'ID,Player,Phone,Amount,Type,Status,Receipt,Date,Approved By,Approved Time';
  const lines = rows.map((r) =>
    [
      r.id, r.profiles?.username ?? '', r.phone ?? '',
      r.amount, r.type, r.status, r.mpesa_receipt ?? '',
      new Date(r.created_at).toLocaleString(),
      r.approved_by ?? '', r.approved_at ? new Date(r.approved_at).toLocaleString() : '',
    ].join(',')
  );
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'transactions.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const { toast } = useToast();
  const { auditLog, adminProfile } = useAdminStore();
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<TxRow | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  async function fetchTx() {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, created_at, amount, type, status, mpesa_receipt, phone, approved_at, approved_by, rejection_reason, user_id, profiles(username)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[FinancePage] fetchTx error:', error.message, error.code, error.details);
      toast(`Failed to load transactions: ${error.message}`, 'error');
    }
    setTransactions((data as TxRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchTx();
    const channel = supabase
      .channel('admin_transactions_watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchTx())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (startDate && t.created_at < startDate) return false;
      if (endDate && t.created_at > endDate + 'T23:59:59') return false;
      return true;
    });
  }, [transactions, statusFilter, typeFilter, startDate, endDate]);

  // ── Approve deposit ────────────────────────────────────────────────────────
  async function handleApproveDeposit(row: TxRow) {
    if (processingId) return;
    setProcessingId(row.id);
    try {
      const now = new Date().toISOString();
      const approvedBy = adminProfile?.username ?? adminProfile?.id ?? 'admin';

      // 1. Mark transaction success
      const { error: txErr } = await supabase
        .from('transactions')
        .update({ status: 'success', approved_at: now, approved_by: approvedBy })
        .eq('id', row.id);
      if (txErr) throw txErr;

      // 2. Credit player balance atomically via RPC (bypasses RLS race)
      if (row.user_id) {
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', row.user_id)
          .single();
        if (profErr) throw new Error(`Failed to fetch player balance: ${profErr.message}`);
        if (prof) {
          const newBalance = Math.round(((prof.balance ?? 0) + row.amount) * 100) / 100;
          const { error: balErr } = await supabase
            .from('profiles')
            .update({ balance: newBalance, updated_at: now })
            .eq('id', row.user_id);
          if (balErr) throw new Error(`Failed to credit balance: ${balErr.message}`);
        }
      }

      await auditLog({
        admin_id: adminProfile?.id ?? null,
        admin_role: adminProfile?.admin_role ?? 'super_admin',
        action_type: 'withdrawal_approve',
        target_entity: 'transactions',
        target_id: row.id,
        previous_value: { status: 'pending', balance_before: null },
        new_value: { status: 'success', approved_by: approvedBy, approved_at: now },
        ip_address: null,
      });

      toast('✓ Deposit approved — player balance updated.', 'success');
      if (selectedTx?.id === row.id) setSelectedTx(null);
    } catch (err: any) {
      toast(`Approve failed: ${err?.message ?? err}`, 'error');
    } finally {
      setProcessingId(null);
      fetchTx();
    }
  }

  // ── Reject deposit ─────────────────────────────────────────────────────────
  async function handleRejectDeposit(row: TxRow) {
    if (processingId) return;
    setProcessingId(row.id);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'failed', rejection_reason: 'Rejected by admin' })
        .eq('id', row.id);
      if (error) throw error;

      await auditLog({
        admin_id: adminProfile?.id ?? null,
        admin_role: adminProfile?.admin_role ?? 'super_admin',
        action_type: 'withdrawal_reject',
        target_entity: 'transactions',
        target_id: row.id,
        previous_value: 'pending',
        new_value: 'failed',
        ip_address: null,
      });

      toast('Deposit rejected.', 'info');
      if (selectedTx?.id === row.id) setSelectedTx(null);
    } catch (err: any) {
      toast(`Reject failed: ${err?.message ?? err}`, 'error');
    } finally {
      setProcessingId(null);
      fetchTx();
    }
  }

  // ── Approve withdrawal ─────────────────────────────────────────────────────
  async function handleApproveWithdrawal(row: TxRow) {
    if (processingId) return;
    setProcessingId(row.id);
    try {
      const now = new Date().toISOString();
      const approvedBy = adminProfile?.username ?? adminProfile?.id ?? 'admin';
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'approved', approved_at: now, approved_by: approvedBy })
        .eq('id', row.id);
      if (error) throw error;

      await auditLog({
        admin_id: adminProfile?.id ?? null,
        admin_role: adminProfile?.admin_role ?? 'super_admin',
        action_type: 'withdrawal_approve',
        target_entity: 'transactions',
        target_id: row.id,
        previous_value: 'pending',
        new_value: { status: 'approved', approved_by: approvedBy },
        ip_address: null,
      });

      toast('Withdrawal approved.', 'success');
      if (selectedTx?.id === row.id) setSelectedTx(null);
    } catch (err: any) {
      toast(`Approve failed: ${err?.message ?? err}`, 'error');
    } finally {
      setProcessingId(null);
      fetchTx();
    }
  }

  // ── Reject withdrawal ──────────────────────────────────────────────────────
  async function handleRejectWithdrawal(row: TxRow) {
    if (processingId) return;
    setProcessingId(row.id);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'rejected', rejection_reason: 'Rejected by admin' })
        .eq('id', row.id);
      if (error) throw error;

      await auditLog({
        admin_id: adminProfile?.id ?? null,
        admin_role: adminProfile?.admin_role ?? 'super_admin',
        action_type: 'withdrawal_reject',
        target_entity: 'transactions',
        target_id: row.id,
        previous_value: 'pending',
        new_value: 'rejected',
        ip_address: null,
      });

      toast('Withdrawal rejected.', 'info');
      if (selectedTx?.id === row.id) setSelectedTx(null);
    } catch (err: any) {
      toast(`Reject failed: ${err?.message ?? err}`, 'error');
    } finally {
      setProcessingId(null);
      fetchTx();
    }
  }

  const totalDeposits    = filtered.filter((t) => t.type === 'deposit'    && t.status === 'success').reduce((a, t) => a + t.amount, 0);
  const totalWithdrawals = filtered.filter((t) => t.type === 'withdrawal' && (t.status === 'success' || t.status === 'approved')).reduce((a, t) => a + t.amount, 0);
  const pendingCount     = filtered.filter((t) => t.status === 'pending').length;

  const columns: Column<TxRow>[] = [
    { key: 'id',       label: 'ID',     render: (r) => <span className="font-mono text-white/50 text-xs">{r.id.slice(0, 8)}</span> },
    { key: 'profiles', label: 'Player', render: (r) => <span className="text-white text-xs">{r.profiles?.username ?? '—'}</span> },
    { key: 'amount',   label: 'Amount', render: (r) => <span className="text-[#FFD700] font-mono text-xs">KES {r.amount.toLocaleString()}</span> },
    { key: 'type',     label: 'Type',   render: (r) => <span className="capitalize text-white/70 text-xs">{r.type}</span> },
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
    { key: 'created_at',   label: 'Date',    render: (r) => <span className="text-white/60 text-xs">{new Date(r.created_at).toLocaleString()}</span> },
    {
      key: 'id', label: 'Actions',
      render: (r) => {
        const busy = processingId === r.id;
        const isPendingDeposit    = r.status === 'pending' && r.type === 'deposit';
        const isPendingWithdrawal = r.status === 'pending' && r.type === 'withdrawal';
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {/* View details — always visible */}
            <button
              onClick={() => setSelectedTx(r)}
              className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/70 text-xs transition-colors"
              title="View Details"
            >
              👁
            </button>

            {isPendingDeposit && (
              <>
                <button
                  onClick={() => handleApproveDeposit(r)}
                  disabled={busy}
                  className="px-2 py-1 rounded bg-green-600 hover:bg-green-500 text-white text-xs transition-colors disabled:opacity-50"
                >
                  {busy ? '…' : '✓ Approve'}
                </button>
                <button
                  onClick={() => handleRejectDeposit(r)}
                  disabled={busy}
                  className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs transition-colors disabled:opacity-50"
                >
                  ✕ Reject
                </button>
              </>
            )}

            {isPendingWithdrawal && (
              <>
                <button
                  onClick={() => handleApproveWithdrawal(r)}
                  disabled={busy}
                  className="px-2 py-1 rounded bg-green-600 hover:bg-green-500 text-white text-xs transition-colors disabled:opacity-50"
                >
                  {busy ? '…' : '✓ Approve'}
                </button>
                <button
                  onClick={() => handleRejectWithdrawal(r)}
                  disabled={busy}
                  className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs transition-colors disabled:opacity-50"
                >
                  ✕ Reject
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Total Deposits"    value={`KES ${totalDeposits.toLocaleString()}`}    icon="💳" color="green"  />
        <StatCard title="Total Withdrawals" value={`KES ${totalWithdrawals.toLocaleString()}`} icon="💸" color="red"    />
        <StatCard title="Pending"           value={pendingCount}                                icon="⏳" color="yellow" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-white/40 text-xs uppercase tracking-widest">From</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/50" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-white/40 text-xs uppercase tracking-widest">To</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/50" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-white/40 text-xs uppercase tracking-widest">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 pr-8 text-sm text-white appearance-none focus:outline-none focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]">
            {['all', 'pending', 'success', 'failed', 'approved', 'rejected'].map((s) =>
              <option key={s} value={s} className="bg-slate-900">{s}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-white/40 text-xs uppercase tracking-widest">Type</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 pr-8 text-sm text-white appearance-none focus:outline-none focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]">
            {['all', 'deposit', 'withdrawal', 'bet', 'payout'].map((s) =>
              <option key={s} value={s} className="bg-slate-900">{s}</option>)}
          </select>
        </div>
        <button onClick={() => downloadCSV(filtered)}
          className="ml-auto px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-colors">
          Export CSV
        </button>
      </div>

      <DataTable<TxRow>
        columns={columns}
        data={filtered}
        loading={loading}
        pageSize={15}
        emptyMessage="No transactions found."
        onRowClick={(row) => setSelectedTx(row)}
      />

      {/* Transaction detail drawer */}
      <AnimatePresence>
        {selectedTx && (
          <DetailDrawer tx={selectedTx} onClose={() => setSelectedTx(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
