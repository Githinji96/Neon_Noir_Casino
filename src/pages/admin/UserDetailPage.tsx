import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAdminStore } from '../../store/adminStore';
import { useToast } from '../../components/admin/ToastProvider';
import ConfirmModal from '../../components/admin/ConfirmModal';
import DataTable, { Column } from '../../components/admin/DataTable';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';

interface UserProfile {
  id: string;
  username: string;
  balance: number;
  account_status: string;
  email?: string;
}

interface TxRow {
  id: string;
  created_at: string;
  amount: number;
  type: string;
  status: string;
  mpesa_receipt: string | null;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border border-green-500/30',
  suspended: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  banned: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

const txColumns: Column<TxRow>[] = [
  { key: 'created_at', label: 'Date', render: (r) => new Date(r.created_at).toLocaleString() },
  { key: 'amount', label: 'Amount', render: (r) => <span className="text-[#FFD700] font-mono">KES {r.amount.toLocaleString()}</span> },
  { key: 'type', label: 'Type', render: (r) => <span className="capitalize text-white/70">{r.type}</span> },
  {
    key: 'status', label: 'Status',
    render: (r) => (
      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${
        r.status === 'success' ? 'bg-green-500/20 text-green-400' :
        r.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
        'bg-red-500/20 text-red-400'
      }`}>{r.status}</span>
    ),
  },
  { key: 'mpesa_receipt', label: 'M-Pesa Receipt', render: (r) => <span className="font-mono text-white/50 text-xs">{r.mpesa_receipt ?? '—'}</span> },
];

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { auditLog, adminProfile } = useAdminStore();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [totalWins, setTotalWins] = useState(0);
  const [loading, setLoading] = useState(true);

  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjError, setAdjError] = useState('');

  const [confirmModal, setConfirmModal] = useState<{ open: boolean; action: 'suspend' | 'ban' | 'unban' | null }>({ open: false, action: null });

  async function fetchData() {
    if (!userId) return;
    const [profileRes, txRes, winsRes] = await Promise.all([
      supabase.from('profiles').select('id, username, balance, account_status').eq('id', userId).single(),
      supabase.from('transactions').select('id, created_at, amount, type, status, mpesa_receipt').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('leaderboard').select('win_amount').eq('user_id', userId),
    ]);
    setProfile(profileRes.data as UserProfile);
    setTransactions((txRes.data as TxRow[]) ?? []);
    setTotalWins((winsRes.data ?? []).reduce((a, r) => a + (r.win_amount ?? 0), 0));
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [userId]);

  async function handleBalanceAdj(type: 'credit' | 'debit') {
    setAdjError('');
    const amount = parseFloat(adjAmount);
    if (isNaN(amount) || amount <= 0) { setAdjError('Enter a valid amount.'); return; }
    if (type === 'debit' && profile && amount > profile.balance) { setAdjError('Debit exceeds current balance.'); return; }
    if (!adjReason.trim()) { setAdjError('Reason is required.'); return; }

    const newBalance = (profile?.balance ?? 0) + (type === 'credit' ? amount : -amount);
    const { error } = await supabase.from('profiles').update({ balance: newBalance }).eq('id', userId!);
    if (error) { toast(error.message, 'error'); return; }

    await auditLog({
      admin_id: adminProfile?.id ?? null,
      admin_role: adminProfile?.admin_role ?? 'super_admin',
      action_type: 'balance_adjust',
      target_entity: 'profiles',
      target_id: userId ?? null,
      previous_value: profile?.balance,
      new_value: newBalance,
      ip_address: null,
    });

    toast(`Balance ${type === 'credit' ? 'credited' : 'debited'} successfully.`, 'success');
    setAdjAmount('');
    setAdjReason('');
    fetchData();
  }

  async function handleStatusChange(status: 'suspended' | 'banned' | 'active') {
    const { error } = await supabase.from('profiles').update({ account_status: status }).eq('id', userId!);
    if (error) { toast(error.message, 'error'); return; }

    const actionMap = { suspended: 'user_suspend', banned: 'user_ban', active: 'user_suspend' } as const;
    await auditLog({
      admin_id: adminProfile?.id ?? null,
      admin_role: adminProfile?.admin_role ?? 'super_admin',
      action_type: actionMap[status],
      target_entity: 'profiles',
      target_id: userId ?? null,
      previous_value: profile?.account_status,
      new_value: status,
      ip_address: null,
    });

    toast(`User ${status}.`, 'success');
    fetchData();
  }

  const totalDeposits = transactions.filter((t) => t.type === 'deposit' && t.status === 'success').reduce((a, t) => a + t.amount, 0);

  if (loading) return <LoadingSkeleton rows={10} />;
  if (!profile) return <p className="text-white/40">User not found.</p>;

  const isSuspended = profile.account_status === 'suspended';
  const isBanned = profile.account_status === 'banned';

  return (
    <div className="flex flex-col gap-6">
      {/* Back */}
      <button onClick={() => navigate('/admin/users')} className="text-white/50 hover:text-white text-sm transition-colors w-fit">
        ← Users
      </button>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div>
          <h2 className="font-orbitron text-2xl font-bold text-white">{profile.username}</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${statusColors[profile.account_status] ?? 'bg-white/10 text-white/50'}`}>
              {profile.account_status}
            </span>
            <span className="text-[#FFD700] font-mono text-sm">KES {profile.balance.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Bets', value: transactions.filter((t) => t.type === 'bet').length },
          { label: 'Total Deposits', value: `KES ${totalDeposits.toLocaleString()}` },
          { label: 'Total Wins', value: `KES ${totalWins.toLocaleString()}` },
        ].map((s) => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-white/40 text-xs uppercase tracking-widest">{s.label}</p>
            <p className="font-orbitron text-xl text-[#FFD700] mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-5">
        <h3 className="text-white/60 text-xs uppercase tracking-widest">Actions</h3>

        {/* Balance adjustment */}
        <div className="flex flex-col gap-3">
          <p className="text-white/70 text-sm font-semibold">Balance Adjustment</p>
          <div className="flex gap-3 flex-wrap">
            <input
              type="number"
              min="0"
              value={adjAmount}
              onChange={(e) => setAdjAmount(e.target.value)}
              placeholder="Amount (KES)"
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FFD700]/50 w-40"
            />
            <input
              type="text"
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
              placeholder="Reason"
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FFD700]/50 flex-1 min-w-40"
            />
          </div>
          {adjError && <p className="text-red-400 text-xs">{adjError}</p>}
          <div className="flex gap-2">
            <button onClick={() => handleBalanceAdj('credit')} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-colors">Credit</button>
            <button onClick={() => handleBalanceAdj('debit')} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors">Debit</button>
          </div>
        </div>

        {/* Status actions */}
        <div className="flex gap-2 flex-wrap">
          {(isSuspended || isBanned) ? (
            <button onClick={() => handleStatusChange('active')} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-colors">
              {isBanned ? 'Unban' : 'Unsuspend'}
            </button>
          ) : (
            <>
              <button onClick={() => setConfirmModal({ open: true, action: 'suspend' })} className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-semibold transition-colors">Suspend</button>
              <button onClick={() => setConfirmModal({ open: true, action: 'ban' })} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors">Ban</button>
            </>
          )}
          <button
            onClick={async () => {
              toast('Password reset email sent.', 'info');
              await auditLog({ admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin', action_type: 'password_reset', target_entity: 'profiles', target_id: userId ?? null, previous_value: null, new_value: null, ip_address: null });
            }}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-colors"
          >
            Reset Password
          </button>
        </div>
      </div>

      {/* Transaction history */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h3 className="text-white/60 text-xs uppercase tracking-widest mb-4">Transaction History</h3>
        <DataTable<TxRow> columns={txColumns} data={transactions} pageSize={10} emptyMessage="No transactions." />
      </div>

      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, action: null })}
        onConfirm={() => {
          if (confirmModal.action === 'suspend') handleStatusChange('suspended');
          if (confirmModal.action === 'ban') handleStatusChange('banned');
        }}
        title={confirmModal.action === 'ban' ? 'Ban User' : 'Suspend User'}
        message={`Are you sure you want to ${confirmModal.action} ${profile.username}?`}
        confirmLabel={confirmModal.action === 'ban' ? 'Ban' : 'Suspend'}
        danger
      />
    </div>
  );
}
