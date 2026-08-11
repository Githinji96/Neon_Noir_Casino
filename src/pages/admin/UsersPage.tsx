import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import DataTable, { Column } from '../../components/admin/DataTable';

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
];

export default function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers]   = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  async function fetchUsers() {
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
  }

  useEffect(() => {
    fetchUsers();

    const channel = supabase
      .channel('admin_profiles_watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchUsers)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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
    </div>
  );
}
