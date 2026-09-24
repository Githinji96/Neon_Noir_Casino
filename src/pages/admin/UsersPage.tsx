import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import DataTable, { Column } from '../../components/admin/DataTable';
import ConfirmModal from '../../components/admin/ConfirmModal';
import { useToast } from '../../components/admin/ToastProvider';
import { useAdminStore } from '../../store/adminStore';

interface UserRow {
  id: string;
  username: string;
  balance: number;
  account_status: string;
  admin_role: string | null;
  phone: string | null;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  active:    'bg-green-500/20 text-green-400 border border-green-500/30',
  suspended: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  banned:    'bg-red-500/20 text-red-400 border border-red-500/30',
};

// ── Inline Edit Drawer ────────────────────────────────────────────────────────
interface EditDrawerProps {
  player: UserRow | null;
  onClose: () => void;
  onSaved: (updated: UserRow) => void;
}

function EditDrawer({ player, onClose, onSaved }: EditDrawerProps) {
  const { toast } = useToast();
  const { auditLog, adminProfile } = useAdminStore();

  const [username,  setUsername]  = useState('');
  const [status,    setStatus]    = useState('');
  const [phone,     setPhone]     = useState('');
  const [email,     setEmail]     = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [fieldErr,  setFieldErr]  = useState('');

  // Sync form when a new player is opened; also fetch email from auth.users
  useEffect(() => {
    if (!player) return;
    setUsername(player.username);
    setStatus(player.account_status);
    setPhone(player.phone ?? '');
    setFieldErr('');
    setEmail(null);

    // Fetch this player's email from auth.users via a single-purpose admin RPC
    setEmailLoading(true);
    supabase
      .rpc('admin_get_player_email', { p_player_id: player.id })
      .then(({ data, error }) => {
        if (error) {
          console.warn('[EditDrawer] email fetch error:', error.message);
          setEmail(null);
        } else {
          setEmail((data as string | null) ?? null);
        }
        setEmailLoading(false);
      });
  }, [player?.id]);

  // Close on Escape
  useEffect(() => {
    if (!player) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [player, saving, onClose]);

  async function handleSave() {
    if (!player) return;
    if (!username.trim()) { setFieldErr('Username is required.'); return; }
    setFieldErr('');
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username:       username.trim(),
          account_status: status,
          phone:          phone.trim() || null,
          updated_at:     new Date().toISOString(),
        })
        .eq('id', player.id);

      if (error) throw new Error(error.message);

      await auditLog({
        admin_id:       adminProfile?.id ?? null,
        admin_role:     adminProfile!.admin_role,
        action_type:    'user_suspend', // closest available type for profile edit
        target_entity:  'profiles',
        target_id:      player.id,
        previous_value: { username: player.username, account_status: player.account_status, phone: player.phone },
        new_value:      { username: username.trim(), account_status: status, phone: phone.trim() || null },
        ip_address:     null,
      });

      toast(`Player "${username.trim()}" updated successfully.`, 'success');
      onSaved({ ...player, username: username.trim(), account_status: status, phone: phone.trim() || null });
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {player && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !saving && onClose()}
          />

          {/* Drawer */}
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={`Edit player ${player.username}`}
            className="fixed right-0 top-0 h-full z-50 w-full max-w-sm flex flex-col"
            style={{
              background: 'linear-gradient(160deg, #0d0d1a 0%, #060610 100%)',
              borderLeft: '1px solid rgba(255,215,0,0.15)',
              boxShadow: '-20px 0 60px rgba(0,0,0,0.7)',
            }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div>
                <p className="font-orbitron text-xs text-white/30 tracking-widest uppercase">Edit Player</p>
                <h2 className="font-orbitron text-base font-bold text-[#FFD700] mt-0.5 truncate">
                  {player.username}
                </h2>
              </div>
              <button
                onClick={onClose}
                disabled={saving}
                aria-label="Close edit drawer"
                className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">

              {/* Username */}
              <div className="flex flex-col gap-1.5">
                <label className="font-orbitron text-xs text-white/40 uppercase tracking-wider">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={saving}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white
                             placeholder-white/25 focus:outline-none focus:border-[#FFD700]/50 transition-colors
                             disabled:opacity-50"
                />
              </div>

              {/* Account status */}
              <div className="flex flex-col gap-1.5">
                <label className="font-orbitron text-xs text-white/40 uppercase tracking-wider">
                  Account Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={saving}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white
                             focus:outline-none focus:border-[#FFD700]/50 transition-colors disabled:opacity-50"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="banned">Banned</option>
                </select>
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-1.5">
                <label className="font-orbitron text-xs text-white/40 uppercase tracking-wider">
                  Phone (M-Pesa)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={saving}
                  placeholder="e.g. 2547XXXXXXXX"
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white
                             placeholder-white/25 focus:outline-none focus:border-[#FFD700]/50 transition-colors
                             disabled:opacity-50 font-mono"
                />
              </div>

              {fieldErr && (
                <p className="text-red-400 text-xs">⚠ {fieldErr}</p>
              )}

              {/* Read-only info */}
              <div className="rounded-xl bg-white/3 border border-white/8 px-4 py-3 flex flex-col gap-2 text-xs text-white/40">
                <p><span className="text-white/20">ID:</span> <span className="font-mono text-white/50 break-all">{player.id}</span></p>
                <p>
                  <span className="text-white/20">Email:</span>{' '}
                  {emailLoading
                    ? <span className="text-white/30 italic">loading…</span>
                    : <span className="text-white/60 font-mono break-all">{email ?? '—'}</span>
                  }
                </p>
                <p>
                  <span className="text-white/20">Balance:</span>{' '}
                  <span className="text-[#FFD700] font-mono">
                    KES {(player.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </p>
                <p className="text-white/25 italic text-[11px]">
                  Balance adjustments are made from the player detail page.
                </p>
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-5 py-4 border-t border-white/10 flex gap-3">
              <button
                onClick={onClose}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-white/8 text-white/60 hover:bg-white/12 hover:text-white
                           text-sm font-orbitron tracking-wider transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold font-orbitron tracking-wider
                           transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background: saving
                    ? 'rgba(255,215,0,0.3)'
                    : 'linear-gradient(135deg, #FFD700, #FFA500)',
                  color: '#000',
                  boxShadow: saving ? 'none' : '0 0 16px rgba(255,215,0,0.3)',
                }}
              >
                {saving && (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-black/40 border-t-transparent animate-spin" />
                )}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { adminProfile, auditLog } = useAdminStore();

  const [users,   setUsers]   = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Delete flow — tracks the exact row being acted on
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);

  // Edit drawer — tracks the row being edited
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);

  const isSuperAdmin = adminProfile?.admin_role === 'super_admin';

  // ── Data fetch ──────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setError(null);
    const { data, error: qErr } = await supabase
      .from('profiles')
      .select('id, username, balance, account_status, admin_role, phone, updated_at')
      .order('updated_at', { ascending: false })
      .limit(500);

    if (qErr) {
      console.error('[UsersPage]', qErr.message);
      setError(qErr.message);
      setLoading(false);
      return;
    }
    setUsers((data as UserRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
    const channel = supabase
      .channel('admin_profiles_watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchUsers)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchUsers]);

  // ── Delete (hard delete via SECURITY DEFINER RPC) ───────────────────────
  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeletingId(target.id);

    try {
      // admin_delete_player: SECURITY DEFINER RPC that:
      //  1. Verifies caller is super_admin (DB-enforced)
      //  2. Deletes public.profiles row (cascades to vip_users, player_stats)
      //  3. Deletes auth.users row      (revokes all sessions permanently)
      //  Financial records (transactions, leaderboard) are preserved via SET NULL FK.
      const { error: rpcErr } = await supabase.rpc('admin_delete_player', {
        p_player_id: target.id,
      });
      if (rpcErr) throw new Error(rpcErr.message);

      await auditLog({
        admin_id:       adminProfile?.id ?? null,
        admin_role:     adminProfile!.admin_role,
        action_type:    'user_ban',
        target_entity:  'profiles',
        target_id:      target.id,
        previous_value: { username: target.username, account_status: target.account_status },
        new_value:      { deleted: true },
        ip_address:     null,
      });

      toast(`Player "${target.username}" permanently deleted.`, 'success');
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
    } catch (err) {
      toast(
        `Failed to delete "${target.username}": ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
    } finally {
      setDeletingId(null);
    }
  }

  // ── Edit save callback ──────────────────────────────────────────────────
  function handleEditSaved(updated: UserRow) {
    setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u));
  }

  // ── Columns ─────────────────────────────────────────────────────────────
  const columns: Column<UserRow>[] = [
    { key: 'username', label: 'Username', sortable: true },
    {
      key: 'balance', label: 'Balance', sortable: true,
      render: (r) => (
        <span className="text-[#FFD700] font-mono font-semibold">
          KES {(r.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'account_status', label: 'Status',
      render: (r) => (
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${statusColors[r.account_status] ?? 'bg-white/10 text-white/50'}`}>
          {r.account_status}
        </span>
      ),
    },
    {
      key: 'phone', label: 'Phone',
      render: (r) => r.phone
        ? <span className="text-white/70 font-mono text-sm">{r.phone}</span>
        : <span className="text-white/20">—</span>,
    },
    {
      key: 'updated_at', label: 'Last Active', sortable: true,
      render: (r) => (
        <span className="text-white/50 text-sm">
          {r.updated_at
            ? new Date(r.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—'}
        </span>
      ),
    },
    {
      key: 'admin_role', label: 'Role',
      render: (r) => r.admin_role
        ? <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">{r.admin_role}</span>
        : <span className="text-white/30">player</span>,
    },
    // ── Actions ──────────────────────────────────────────────────────────
    {
      key: 'id', label: 'Actions',
      render: (r) => (
        <div
          className="flex items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 👁 View — opens player detail page */}
          <button
            onClick={() => navigate(`/admin/users/${r.id}`)}
            title="View player details"
            aria-label={`View player ${r.username}`}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
              <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
          </button>

          {/* ✏️ Edit — opens inline drawer */}
          <button
            onClick={() => setEditTarget(r)}
            title="Edit player"
            aria-label={`Edit player ${r.username}`}
            className="p-1.5 rounded-lg text-white/40 hover:text-blue-400 hover:bg-blue-500/10 transition-colors
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
              <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
              <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
            </svg>
          </button>

          {/* 🗑 Delete — super_admin only */}
          {isSuperAdmin && (
            <button
              onClick={() => setDeleteTarget(r)}
              disabled={deletingId === r.id}
              title="Delete player"
              aria-label={`Delete player ${r.username}`}
              className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
            >
              {deletingId === r.id
                ? <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
                : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193v-.443A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                  </svg>
                )
              }
            </button>
          )}
        </div>
      ),
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-sm">{users.length} total users</p>
        <button
          onClick={fetchUsers}
          className="text-xs font-orbitron text-white/40 hover:text-white/70 border border-white/10 hover:border-white/30 px-3 py-1.5 rounded-lg transition-colors"
        >
          ↻ REFRESH
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm font-mono">
          {error}
        </div>
      )}

      <DataTable<UserRow>
        columns={columns}
        data={users}
        loading={loading}
        searchable
        searchPlaceholder="Search by username..."
        onRowClick={(row) => navigate(`/admin/users/${row.id}`)}
        emptyMessage="No users found."
      />

      {/* ── Delete confirmation modal ──────────────────────────────────── */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => { if (!deletingId) setDeleteTarget(null); }}
        onConfirm={handleDeleteConfirm}
        title="DELETE PLAYER"
        message={deleteTarget ? (
          <span>
            Permanently delete this player?
            <span className="block mt-2 mb-0.5 font-orbitron font-bold text-white text-sm">
              {deleteTarget.username}
            </span>
            {deleteTarget.phone && (
              <span className="block text-white/40 text-xs font-mono mb-2">
                {deleteTarget.phone}
              </span>
            )}
            <span className="block text-red-400/70 text-xs mt-2 leading-relaxed">
              The account and all session data will be removed permanently.
              Financial and audit records are preserved.
            </span>
          </span>
        ) : ''}
        confirmLabel="DELETE PLAYER"
        danger
      />

      {/* ── Edit drawer ────────────────────────────────────────────────── */}
      <EditDrawer
        player={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={handleEditSaved}
      />
    </div>
  );
}
