import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import DataTable, { Column } from '../../components/admin/DataTable';

interface UserRow {
  id: string;
  username: string;
  balance: number;
  account_status: string;
  updated_at: string;
  admin_role: string | null;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border border-green-500/30',
  suspended: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  banned: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

const columns: Column<UserRow>[] = [
  { key: 'username', label: 'Username', sortable: true },
  {
    key: 'balance', label: 'Balance', sortable: true,
    render: (r) => <span className="text-[#FFD700] font-mono">KES {r.balance.toLocaleString()}</span>,
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
    key: 'updated_at', label: 'Last Active', sortable: true,
    render: (r) => new Date(r.updated_at).toLocaleDateString(),
  },
  {
    key: 'admin_role', label: 'Role',
    render: (r) => r.admin_role ? (
      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">{r.admin_role}</span>
    ) : <span className="text-white/30">—</span>,
  },
];

export default function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, username, balance, account_status, updated_at, admin_role')
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('[UsersPage]', error.message);
        setUsers((data as UserRow[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-sm">{users.length} total users</p>
      </div>
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
