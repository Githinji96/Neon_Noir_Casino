import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAdminStore } from '../../store/adminStore';
import { useToast } from '../../components/admin/ToastProvider';
import ConfirmModal from '../../components/admin/ConfirmModal';
import ResetConfirmModal from '../../components/admin/ResetConfirmModal';
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

// Stats stored in the player_stats table (or similar).
// We read these to show previous values in audit logs and display them in the UI.
interface PlayerStats {
  total_wins: number;
  total_bets: number;
  total_bet_amount: number;
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

type ResetModalType = 'wins' | 'bets' | 'stats' | null;

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { auditLog, adminProfile } = useAdminStore();

  // Derive reactively on every render — adminProfile may load after mount
  const isSuperAdmin = adminProfile?.admin_role === 'super_admin';

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [totalWins, setTotalWins] = useState(0);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjError, setAdjError] = useState('');

  const [confirmModal, setConfirmModal] = useState<{ open: boolean; action: 'suspend' | 'ban' | 'unban' | null }>({ open: false, action: null });
  const [resetModal, setResetModal] = useState<ResetModalType>(null);

  async function fetchData() {
    if (!userId) return;
    const [profileRes, txRes, winsRes, statsRes] = await Promise.all([
      supabase.from('profiles').select('id, username, balance, account_status').eq('id', userId).single(),
      supabase.from('transactions').select('id, created_at, amount, type, status, mpesa_receipt').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('leaderboard').select('win_amount').eq('user_id', userId),
      supabase.from('player_stats').select('total_wins, total_bets, total_bet_amount').eq('user_id', userId).single(),
    ]);
    setProfile(profileRes.data as UserProfile);
    setTransactions((txRes.data as TxRow[]) ?? []);
    setTotalWins((winsRes.data ?? []).reduce((a, r) => a + (r.win_amount ?? 0), 0));
    setPlayerStats(statsRes.data as PlayerStats | null);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [userId]);

  async function handleBalanceAdj(type: 'credit' | 'debit') {
    setAdjError('');
    const amount = parseFloat(adjAmount);
    if (isNaN(amount) || amount <= 0) { setAdjError('Enter a valid amount.'); return; }
    if (type === 'debit' && profile && amount > profile.balance) { setAdjError('Debit exceeds current balance.'); return; }
    if (!adjReason.trim()) { setAdjError('Reason is required.'); return; }

    const rpcName = type === 'credit' ? 'admin_credit_player' : 'admin_debit_player';

    const { data, error } = await supabase.rpc(rpcName, {
      p_player_id: userId!,
      p_amount:    amount,
      p_reason:    adjReason.trim(),
      p_admin_id:  adminProfile?.id ?? null,
    });

    if (error) { toast(error.message, 'error'); return; }

    const result = data as { success: boolean; player_balance: number; casino_balance: number };
    const newBalance = result.player_balance;

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

  // ── Reset handlers ──────────────────────────────────────────────────────────

  async function handleResetWins() {
    const prevWins = totalWins;
    const prevStats = playerStats;

    // SECURITY DEFINER RPC handles both leaderboard delete + player_stats zero
    const { error: rpcErr } = await supabase.rpc('admin_reset_player_wins', {
      target_user_id: userId!,
    });
    if (rpcErr) { toast(`Failed to reset wins: ${rpcErr.message}`, 'error'); return; }

    await auditLog({
      admin_id: adminProfile?.id ?? null,
      admin_role: adminProfile?.admin_role ?? 'super_admin',
      action_type: 'reset_player_wins',
      target_entity: 'leaderboard',
      target_id: userId ?? null,
      previous_value: { totalWins: prevWins, stats: prevStats },
      new_value: { totalWins: 0, total_wins: 0, lifetime_wins: 0, daily_wins: 0, weekly_wins: 0, monthly_wins: 0 },
      ip_address: null,
    });

    toast('✓ Player wins successfully reset.', 'success');
    fetchData();
  }

  async function handleResetBets() {
    const prevStats = playerStats;

    // Use SECURITY DEFINER RPC to bypass player_stats RLS
    const { error: rpcErr } = await supabase.rpc('admin_reset_player_bets', {
      target_user_id: userId!,
    });
    if (rpcErr) { toast(`Failed to reset bets: ${rpcErr.message}`, 'error'); return; }

    await auditLog({
      admin_id: adminProfile?.id ?? null,
      admin_role: adminProfile?.admin_role ?? 'super_admin',
      action_type: 'reset_player_bets',
      target_entity: 'player_stats',
      target_id: userId ?? null,
      previous_value: prevStats,
      new_value: { total_bets: 0, total_bet_amount: 0, daily_bet_amount: 0, weekly_bet_amount: 0, monthly_bet_amount: 0 },
      ip_address: null,
    });

    toast('✓ Player betting statistics successfully reset.', 'success');
    fetchData();
  }

  async function handleResetAllStats() {
    const prevWins = totalWins;
    const prevStats = playerStats;

    // SECURITY DEFINER RPC handles both leaderboard delete + all stats zero
    const { error: rpcErr } = await supabase.rpc('admin_reset_player_stats', {
      target_user_id: userId!,
    });
    if (rpcErr) { toast(`Failed to reset statistics: ${rpcErr.message}`, 'error'); return; }

    await auditLog({
      admin_id: adminProfile?.id ?? null,
      admin_role: adminProfile?.admin_role ?? 'super_admin',
      action_type: 'reset_player_stats',
      target_entity: 'player_stats',
      target_id: userId ?? null,
      previous_value: { totalWins: prevWins, stats: prevStats },
      new_value: 'all_stats_zeroed',
      ip_address: null,
    });

    toast('✓ All player statistics successfully reset.', 'success');
    fetchData();
  }

  // ────────────────────────────────────────────────────────────────────────────

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
          { label: 'Total Bets', value: playerStats?.total_bets ?? transactions.filter((t) => t.type === 'bet').length },
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
              type="number" min="0" value={adjAmount}
              onChange={(e) => setAdjAmount(e.target.value)}
              placeholder="Amount (KES)"
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FFD700]/50 w-40"
            />
            <input
              type="text" value={adjReason}
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

        {/* Account status */}
        <div className="flex flex-col gap-2">
          <p className="text-white/70 text-sm font-semibold">Account Status</p>
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

        {/* ── Stat Resets — Super Admin only ────────────────────────────── */}
        {isSuperAdmin && (
          <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
            <div className="flex items-center gap-2">
              <p className="text-white/70 text-sm font-semibold">Statistics Reset</p>
              <span className="text-[10px] font-orbitron px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 uppercase tracking-widest">
                Super Admin
              </span>
            </div>
            <p className="text-white/30 text-xs">Resets statistical counters only. Balance, transactions, deposits, withdrawals and history are never affected.</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setResetModal('wins')}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
              >
                🔄 Reset Total Wins
              </button>
              <button
                onClick={() => setResetModal('bets')}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
              >
                🔄 Reset Total Bets
              </button>
              <button
                onClick={() => setResetModal('stats')}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors border border-rose-700/50 bg-rose-700/10 text-rose-300 hover:bg-rose-700/20"
              >
                🔄 Reset All Statistics
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction history */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h3 className="text-white/60 text-xs uppercase tracking-widest mb-4">Transaction History</h3>
        <DataTable<TxRow> columns={txColumns} data={transactions} pageSize={10} emptyMessage="No transactions." />
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
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

      {/* Reset Wins */}
      <ResetConfirmModal
        isOpen={resetModal === 'wins'}
        onClose={() => setResetModal(null)}
        onConfirm={handleResetWins}
        title="Reset Player Wins"
        message={`You are about to reset ${profile.username}'s total winnings to KES 0. This action cannot be undone.`}
        confirmLabel="Reset Wins"
        resets={[
          'totalWins → KES 0',
          'lifetimeWins → 0',
          'currentSessionWins → 0',
          'dailyWins → 0',
          'weeklyWins → 0',
          'monthlyWins → 0',
        ]}
        preserves={[
          'Account balance',
          'Deposits & withdrawals',
          'Transaction history',
          'Bet history',
          'Jackpot history',
          'Game history',
        ]}
      />

      {/* Reset Bets */}
      <ResetConfirmModal
        isOpen={resetModal === 'bets'}
        onClose={() => setResetModal(null)}
        onConfirm={handleResetBets}
        title="Reset Player Bets"
        message={`You are about to reset ${profile.username}'s betting statistics to 0. This action cannot be undone.`}
        confirmLabel="Reset Bets"
        resets={[
          'totalBets → 0',
          'totalBetAmount → KES 0',
          'dailyBetAmount → KES 0',
          'weeklyBetAmount → KES 0',
          'monthlyBetAmount → KES 0',
          'currentSessionBets → 0',
          'currentSessionBetAmount → KES 0',
        ]}
        preserves={[
          'Account balance',
          'Win history & leaderboard',
          'Transaction history',
          'Deposit & withdrawal history',
          'Jackpot entries',
        ]}
      />

      {/* Reset All Stats */}
      <ResetConfirmModal
        isOpen={resetModal === 'stats'}
        onClose={() => setResetModal(null)}
        onConfirm={handleResetAllStats}
        title="Reset All Player Statistics"
        message={`You are about to reset ALL statistics for ${profile.username}. Wins, bets, session and period counters will all be zeroed. This cannot be undone.`}
        confirmLabel="Reset All Statistics"
        resets={[
          'All win counters (total, daily, weekly, monthly, session)',
          'All bet counters (total bets, total amounts)',
          'All period bet amounts (daily, weekly, monthly)',
          'Current session statistics',
        ]}
        preserves={[
          'Account balance — unchanged',
          'Deposit & withdrawal history',
          'Transaction records',
          'VIP level & bonuses',
          'Jackpot entries',
          'Game round history',
        ]}
      />
    </div>
  );
}
