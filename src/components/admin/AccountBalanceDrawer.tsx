/**
 * AccountBalanceDrawer
 *
 * Right-side slide-over panel for managing a player's account and balance.
 * Contains: live balance, credit/debit, account status, statistics reset.
 *
 * All mutations go through the same RPCs / Supabase calls used in
 * UserDetailPage — no duplicate logic is introduced.
 */
import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { useAdminStore } from '../../store/adminStore';
import ConfirmModal from './ConfirmModal';
import ResetConfirmModal from './ResetConfirmModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DrawerPlayer {
  id: string;
  username: string;
  balance: number;
  account_status: string;
}

interface AccountBalanceDrawerProps {
  player: DrawerPlayer | null;   // null = closed
  onClose: () => void;
  onPlayerUpdated?: () => void;  // bubble up to refresh the users table
}

type ResetType = 'spins' | 'bets' | 'all' | null;
type ConfirmAction = 'suspend' | 'ban' | 'reactivate' | 'credit' | 'debit' | null;

// ─── Section separator ────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-white/35 text-[10px] font-orbitron tracking-[0.25em] uppercase mb-3 pt-1">
      {children}
    </p>
  );
}

// ─── Main drawer component ────────────────────────────────────────────────────

export default function AccountBalanceDrawer({
  player,
  onClose,
  onPlayerUpdated,
}: AccountBalanceDrawerProps) {
  const { auditLog, adminProfile } = useAdminStore();
  const isSuperAdmin = adminProfile?.admin_role === 'super_admin';

  // Live state — refreshed after each mutation
  const [balance,  setBalance]  = useState(0);
  const [status,   setStatus]   = useState('active');
  const [loading,  setLoading]  = useState(false);
  const [toast,    setToast]    = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Balance adj form
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjError,  setAdjError]  = useState('');

  // Confirm + reset modals
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [resetType,     setResetType]     = useState<ResetType>(null);

  // Sync local state when player changes
  useEffect(() => {
    if (!player) return;
    setBalance(player.balance);
    setStatus(player.account_status);
    setAdjAmount('');
    setAdjReason('');
    setAdjError('');
    setToast(null);
  }, [player?.id]);

  // Prevent body scroll while open
  useEffect(() => {
    if (player) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [!!player]);

  // Close on Escape
  useEffect(() => {
    if (!player) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [player, onClose]);

  // ── Toast helper ─────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Re-fetch live balance ────────────────────────────────────────────────
  const refreshBalance = useCallback(async () => {
    if (!player) return;
    const { data } = await supabase
      .from('profiles')
      .select('balance, account_status')
      .eq('id', player.id)
      .single();
    if (data) {
      setBalance(data.balance ?? 0);
      setStatus(data.account_status ?? 'active');
    }
  }, [player?.id]);

  // ── Balance adjustment ───────────────────────────────────────────────────
  function validateAdj(): string | null {
    const n = parseFloat(adjAmount);
    if (!adjAmount || isNaN(n) || n <= 0)         return 'Enter a valid positive amount';
    if (n > 1_000_000)                             return 'Amount exceeds maximum (KES 1,000,000)';
    if (!adjReason.trim())                         return 'Reason is required';
    return null;
  }

  async function handleBalanceAdj(type: 'credit' | 'debit') {
    setAdjError('');
    const err = validateAdj();
    if (err) { setAdjError(err); return; }
    const amt = parseFloat(adjAmount);
    if (type === 'debit' && amt > balance) { setAdjError('Debit exceeds current balance'); return; }
    // Open confirmation modal
    setConfirmAction(type);
  }

  async function doBalanceAdj(type: 'credit' | 'debit') {
    if (!player) return;
    setLoading(true);
    const amt = parseFloat(adjAmount);
    const rpcName = type === 'credit' ? 'admin_credit_player' : 'admin_debit_player';
    const { data, error } = await supabase.rpc(rpcName, {
      p_player_id: player.id,
      p_amount:    amt,
      p_reason:    adjReason.trim(),
      p_admin_id:  adminProfile?.id ?? null,
    });

    if (error) {
      showToast(error.message, 'error');
    } else {
      const res = data as { player_balance?: number };
      if (res?.player_balance != null) setBalance(res.player_balance);
      await auditLog({
        admin_id:       adminProfile?.id ?? null,
        admin_role:     adminProfile?.admin_role ?? 'super_admin',
        action_type:    'balance_adjust',
        target_entity:  'profiles',
        target_id:      player.id,
        previous_value: balance,
        new_value:      res?.player_balance ?? null,
        ip_address:     null,
      });
      showToast(`Balance ${type === 'credit' ? 'credited' : 'debited'} successfully`);
      setAdjAmount('');
      setAdjReason('');
      onPlayerUpdated?.();
    }
    setLoading(false);
  }

  // ── Account status ───────────────────────────────────────────────────────
  async function doStatusChange(newStatus: 'suspended' | 'banned' | 'active') {
    if (!player) return;
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ account_status: newStatus })
      .eq('id', player.id);

    if (error) {
      showToast(error.message, 'error');
    } else {
      const actionMap = {
        suspended: 'user_suspend',
        banned:    'user_ban',
        active:    'user_suspend',
      } as const;
      await auditLog({
        admin_id:       adminProfile?.id ?? null,
        admin_role:     adminProfile?.admin_role ?? 'super_admin',
        action_type:    actionMap[newStatus],
        target_entity:  'profiles',
        target_id:      player.id,
        previous_value: status,
        new_value:      newStatus,
        ip_address:     null,
      });
      setStatus(newStatus);
      showToast(`Account ${newStatus}`);
      onPlayerUpdated?.();
    }
    setLoading(false);
  }

  // ── Statistics resets ────────────────────────────────────────────────────
  async function doResetSpins() {
    if (!player) return;
    setLoading(true);
    const { error } = await supabase.rpc('admin_reset_player_wins', { target_user_id: player.id });
    if (error) { showToast(error.message, 'error'); }
    else {
      await auditLog({ admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin', action_type: 'reset_player_wins', target_entity: 'player_stats', target_id: player.id, previous_value: null, new_value: 'wins_zeroed', ip_address: null });
      showToast('Total spins / wins reset');
    }
    setLoading(false);
  }

  async function doResetBets() {
    if (!player) return;
    setLoading(true);
    const { error } = await supabase.rpc('admin_reset_player_bets', { target_user_id: player.id });
    if (error) { showToast(error.message, 'error'); }
    else {
      await auditLog({ admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin', action_type: 'reset_player_bets', target_entity: 'player_stats', target_id: player.id, previous_value: null, new_value: 'bets_zeroed', ip_address: null });
      showToast('Total bets reset');
    }
    setLoading(false);
  }

  async function doResetAll() {
    if (!player) return;
    setLoading(true);
    const { error } = await supabase.rpc('admin_reset_player_stats', { target_user_id: player.id });
    if (error) { showToast(error.message, 'error'); }
    else {
      await auditLog({ admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin', action_type: 'reset_player_stats', target_entity: 'player_stats', target_id: player.id, previous_value: null, new_value: 'all_stats_zeroed', ip_address: null });
      showToast('All statistics reset');
    }
    setLoading(false);
  }

  // ── Confirm modal dispatcher ─────────────────────────────────────────────
  function getConfirmProps(): { title: string; message: string; label: string; danger: boolean; onConfirm: () => Promise<void> } {
    switch (confirmAction) {
      case 'credit': return {
        title: 'Confirm Credit',
        message: `Credit KES ${parseFloat(adjAmount || '0').toLocaleString()} to ${player?.username}?\n\nReason: ${adjReason}`,
        label: '+ CREDIT', danger: false,
        onConfirm: () => doBalanceAdj('credit'),
      };
      case 'debit': return {
        title: 'Confirm Debit',
        message: `Debit KES ${parseFloat(adjAmount || '0').toLocaleString()} from ${player?.username}?\n\nReason: ${adjReason}`,
        label: '- DEBIT', danger: true,
        onConfirm: () => doBalanceAdj('debit'),
      };
      case 'suspend': return {
        title: 'Suspend Account',
        message: `Temporarily suspend ${player?.username}? They will not be able to play, deposit, or withdraw until reactivated.`,
        label: 'Suspend', danger: true,
        onConfirm: () => doStatusChange('suspended'),
      };
      case 'ban': return {
        title: 'Ban Account',
        message: `Permanently ban ${player?.username}? This is a severe action. The account will be locked indefinitely.`,
        label: 'Ban', danger: true,
        onConfirm: () => doStatusChange('banned'),
      };
      case 'reactivate': return {
        title: 'Reactivate Account',
        message: `Reactivate ${player?.username}'s account? Their access will be restored immediately.`,
        label: 'Reactivate', danger: false,
        onConfirm: () => doStatusChange('active'),
      };
      default: return { title: '', message: '', label: '', danger: false, onConfirm: async () => {} };
    }
  }

  const confirmProps = getConfirmProps();
  const isSuspended = status === 'suspended';
  const isBanned    = status === 'banned';

  const statusColor: Record<string, string> = {
    active:    '#22c55e',
    suspended: '#eab308',
    banned:    '#ef4444',
  };

  // ────────────────────────────────────────────────────────────────────────
  // Render via portal so it sits above everything (z-[200])
  // ────────────────────────────────────────────────────────────────────────

  const drawer = (
    <AnimatePresence>
      {player && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[190] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            className="fixed right-0 top-0 bottom-0 z-[200] flex flex-col overflow-hidden"
            style={{
              width: 'min(460px, 100vw)',
              background: 'linear-gradient(160deg, #0c0c18 0%, #08080f 100%)',
              borderLeft: '1px solid rgba(255,215,0,0.12)',
              boxShadow: '-8px 0 40px rgba(0,0,0,0.7)',
            }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            {/* ── Toast ── */}
            <AnimatePresence>
              {toast && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute top-3 left-3 right-3 z-10 px-4 py-2.5 rounded-xl text-xs font-orbitron tracking-wider"
                  style={{
                    background: toast.type === 'success'
                      ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    border: toast.type === 'success'
                      ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(239,68,68,0.35)',
                    color: toast.type === 'success' ? '#86efac' : '#fca5a5',
                  }}
                >
                  {toast.type === 'success' ? '✓ ' : '✕ '}{toast.msg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Header ── */}
            <div
              className="shrink-0 flex items-start justify-between px-5 pt-5 pb-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div>
                <p className="text-white/30 text-[10px] font-orbitron tracking-[0.3em] uppercase mb-1">
                  Neon Noir Admin
                </p>
                <h2 className="font-orbitron text-lg font-bold tracking-widest" style={{ color: '#FFD700' }}>
                  ACCOUNT & BALANCE
                </h2>
                <p className="text-white/55 text-sm mt-0.5 font-orbitron">
                  Player: <span className="text-white font-bold">{player.username}</span>
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all text-xl shrink-0 mt-0.5"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,215,0,0.15) transparent' }}>

              {/* ── LIVE USER BALANCE ─────────────────────────────────── */}
              <section>
                <SectionTitle>Live User Balance</SectionTitle>
                <div
                  className="rounded-2xl p-4 flex items-center justify-between"
                  style={{
                    background: 'rgba(255,215,0,0.05)',
                    border: '1px solid rgba(255,215,0,0.15)',
                  }}
                >
                  <div>
                    <p className="text-white/40 text-[10px] font-orbitron tracking-widest uppercase mb-1">
                      Available Balance
                    </p>
                    <p className="font-orbitron text-3xl font-black" style={{ color: '#FFD700', textShadow: '0 0 16px rgba(255,215,0,0.4)' }}>
                      KES {balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className="text-[10px] font-orbitron px-2.5 py-1 rounded-full uppercase tracking-widest font-bold"
                      style={{
                        background: `${statusColor[status] ?? '#22c55e'}18`,
                        border: `1px solid ${statusColor[status] ?? '#22c55e'}40`,
                        color: statusColor[status] ?? '#22c55e',
                      }}
                    >
                      {status}
                    </span>
                    <button
                      onClick={refreshBalance}
                      className="text-white/25 hover:text-white/60 text-xs transition-colors"
                      title="Refresh balance"
                    >
                      ↻ refresh
                    </button>
                  </div>
                </div>
              </section>

              {/* ── BALANCE ADJUSTMENT ───────────────────────────────── */}
              <section>
                <SectionTitle>Balance Adjustment</SectionTitle>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-white/40 text-[10px] uppercase tracking-widest">Amount (KES)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={adjAmount}
                      onChange={(e) => {
                        setAdjAmount(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'));
                        setAdjError('');
                      }}
                      placeholder="0.00"
                      className="rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 bg-white/5 border border-white/10 focus:border-yellow-400/50 outline-none transition-colors font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-white/40 text-[10px] uppercase tracking-widest">Reason</label>
                    <input
                      type="text"
                      value={adjReason}
                      onChange={(e) => setAdjReason(e.target.value)}
                      placeholder="e.g. Bonus credit / Correction"
                      className="rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 bg-white/5 border border-white/10 focus:border-yellow-400/50 outline-none transition-colors"
                    />
                  </div>
                  {adjError && (
                    <p className="text-red-400 text-xs font-orbitron">{adjError}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleBalanceAdj('credit')}
                      disabled={loading}
                      className="py-2.5 rounded-xl font-orbitron text-xs font-bold tracking-wider transition-all disabled:opacity-40"
                      style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)', color: '#86efac' }}
                    >
                      + CREDIT
                    </button>
                    <button
                      onClick={() => handleBalanceAdj('debit')}
                      disabled={loading}
                      className="py-2.5 rounded-xl font-orbitron text-xs font-bold tracking-wider transition-all disabled:opacity-40"
                      style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}
                    >
                      − DEBIT
                    </button>
                  </div>
                </div>
              </section>

              {/* ── ACCOUNT STATUS ───────────────────────────────────── */}
              <section>
                <SectionTitle>Account Status</SectionTitle>
                <div
                  className="rounded-2xl p-4 flex flex-col gap-3"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 text-xs">Current:</span>
                    <span
                      className="text-xs font-orbitron font-bold uppercase px-2.5 py-0.5 rounded-full"
                      style={{
                        background: `${statusColor[status] ?? '#22c55e'}15`,
                        border: `1px solid ${statusColor[status] ?? '#22c55e'}35`,
                        color: statusColor[status] ?? '#22c55e',
                      }}
                    >
                      {status}
                    </span>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {(isSuspended || isBanned) ? (
                      <button
                        onClick={() => setConfirmAction('reactivate')}
                        disabled={loading}
                        className="px-4 py-2 rounded-xl text-xs font-orbitron font-bold tracking-wider transition-all disabled:opacity-40"
                        style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)', color: '#86efac' }}
                      >
                        ✓ REACTIVATE
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setConfirmAction('suspend')}
                          disabled={loading}
                          className="px-4 py-2 rounded-xl text-xs font-orbitron font-bold tracking-wider transition-all disabled:opacity-40"
                          style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)', color: '#fde047' }}
                        >
                          ⏸ SUSPEND
                        </button>
                        <button
                          onClick={() => setConfirmAction('ban')}
                          disabled={loading}
                          className="px-4 py-2 rounded-xl text-xs font-orbitron font-bold tracking-wider transition-all disabled:opacity-40"
                          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}
                        >
                          🚫 BAN
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </section>

              {/* ── STATISTICS RESET (super_admin only) ─────────────── */}
              {isSuperAdmin && (
                <section>
                  <SectionTitle>Statistics Reset</SectionTitle>
                  <div
                    className="rounded-2xl p-4 flex flex-col gap-3"
                    style={{ background: 'rgba(244,63,94,0.04)', border: '1px solid rgba(244,63,94,0.15)' }}
                  >
                    <p className="text-white/35 text-[11px] leading-relaxed">
                      Resets statistical counters only. Balance, deposits, withdrawals, and transaction records are never affected.
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setResetType('spins')}
                        disabled={loading}
                        className="w-full py-2.5 rounded-xl text-xs font-orbitron font-bold tracking-wider transition-all text-left px-4 disabled:opacity-40"
                        style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: '#fda4af' }}
                      >
                        🎰 Reset Total Spins
                      </button>
                      <button
                        onClick={() => setResetType('bets')}
                        disabled={loading}
                        className="w-full py-2.5 rounded-xl text-xs font-orbitron font-bold tracking-wider transition-all text-left px-4 disabled:opacity-40"
                        style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: '#fda4af' }}
                      >
                        💰 Reset Total Bets
                      </button>
                      <button
                        onClick={() => setResetType('all')}
                        disabled={loading}
                        className="w-full py-2.5 rounded-xl text-xs font-orbitron font-bold tracking-wider transition-all text-left px-4 disabled:opacity-40"
                        style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)', color: '#f87171' }}
                      >
                        ⚠️ Reset ALL Statistics
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* bottom spacer so last section isn't flush against edge */}
              <div className="h-4 shrink-0" />
            </div>

            {/* ── Footer — Operator info ── */}
            <div
              className="shrink-0 flex items-center justify-between px-5 py-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
            >
              <span className="text-white/30 text-[10px] font-orbitron">
                Operator: <span className="text-white/55">{adminProfile?.username ?? '—'}</span>
              </span>
              <span
                className="text-[9px] font-orbitron font-bold tracking-widest px-2.5 py-1 rounded-full uppercase"
                style={{
                  background: 'rgba(255,215,0,0.08)',
                  border: '1px solid rgba(255,215,0,0.2)',
                  color: '#FFD700',
                }}
              >
                ADMIN CONSOLE
              </span>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {createPortal(drawer, document.body)}

      {/* ── Confirmation modal (credit/debit/status) ── */}
      <ConfirmModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmProps.onConfirm}
        title={confirmProps.title}
        message={confirmProps.message}
        confirmLabel={confirmProps.label}
        danger={confirmProps.danger}
      />

      {/* ── Reset spins ── */}
      <ResetConfirmModal
        isOpen={resetType === 'spins'}
        onClose={() => setResetType(null)}
        onConfirm={doResetSpins}
        title="Reset Total Spins"
        message={`Reset ${player?.username ?? ''}'s spin statistics to zero. This cannot be undone.`}
        confirmLabel="Reset Spins"
        resets={['total_wins → 0', 'lifetime_wins → 0', 'daily/weekly/monthly wins → 0']}
        preserves={['Account balance', 'Deposits & withdrawals', 'Transaction records', 'Financial history']}
      />

      {/* ── Reset bets ── */}
      <ResetConfirmModal
        isOpen={resetType === 'bets'}
        onClose={() => setResetType(null)}
        onConfirm={doResetBets}
        title="Reset Total Bets"
        message={`Reset ${player?.username ?? ''}'s betting statistics to zero. This cannot be undone.`}
        confirmLabel="Reset Bets"
        resets={['total_bets → 0', 'total_bet_amount → 0', 'daily/weekly/monthly bet amounts → 0', 'current_session_bets → 0']}
        preserves={['Account balance', 'Win history & leaderboard', 'Transaction & deposit/withdrawal records']}
      />

      {/* ── Reset all ── */}
      <ResetConfirmModal
        isOpen={resetType === 'all'}
        onClose={() => setResetType(null)}
        onConfirm={doResetAll}
        title="Reset ALL Statistics"
        message={`Reset ALL statistics for ${player?.username ?? ''}. Every statistical counter will be zeroed. This cannot be undone.`}
        confirmLabel="Reset ALL Statistics"
        resets={['All win counters', 'All bet counters', 'All period amounts (daily/weekly/monthly)', 'Current session statistics', 'Leaderboard entries']}
        preserves={['Account balance — unchanged', 'Deposit & withdrawal history', 'Transaction records', 'VIP level & bonuses', 'Jackpot entries']}
      />
    </>
  );
}
