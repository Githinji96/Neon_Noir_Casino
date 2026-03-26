import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { AuditLogEntry, AuditActionType } from '../../store/adminStore';
import DataTable, { Column } from '../../components/admin/DataTable';
import StatCard from '../../components/admin/StatCard';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';

const ACTION_TYPES: AuditActionType[] = [
  'balance_adjust', 'user_suspend', 'user_ban', 'password_reset',
  'withdrawal_approve', 'withdrawal_reject', 'payment_retry',
  'game_toggle', 'game_config_update', 'table_create', 'table_edit',
  'table_pause', 'table_resume', 'player_kick', 'round_restart',
  'rtp_update', 'jackpot_config_update', 'jackpot_force_reset',
  'bet_limit_apply', 'fraud_flag_dismiss',
];

const actionColors: Partial<Record<AuditActionType, string>> = {
  user_ban: 'bg-red-500/20 text-red-400',
  user_suspend: 'bg-yellow-500/20 text-yellow-400',
  balance_adjust: 'bg-blue-500/20 text-blue-400',
  rtp_update: 'bg-purple-500/20 text-purple-400',
  jackpot_force_reset: 'bg-red-500/20 text-red-400',
  withdrawal_approve: 'bg-green-500/20 text-green-400',
  withdrawal_reject: 'bg-red-500/20 text-red-400',
};

const columns: Column<AuditLogEntry>[] = [
  { key: 'created_at', label: 'Timestamp', sortable: true, render: (r) => <span className="text-white/60 text-xs">{new Date(r.created_at).toLocaleString()}</span> },
  { key: 'admin_id', label: 'Admin ID', render: (r) => <span className="font-mono text-white/50 text-xs">{r.admin_id?.slice(0, 8) ?? '—'}</span> },
  { key: 'admin_role', label: 'Role', render: (r) => <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 uppercase">{r.admin_role}</span> },
  {
    key: 'action_type', label: 'Action',
    render: (r) => (
      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${actionColors[r.action_type] ?? 'bg-white/10 text-white/60'}`}>
        {r.action_type.replace(/_/g, ' ')}
      </span>
    ),
  },
  { key: 'target_entity', label: 'Entity', render: (r) => <span className="text-white/50 text-xs">{r.target_entity ?? '—'}</span> },
  { key: 'target_id', label: 'Target ID', render: (r) => <span className="font-mono text-white/40 text-xs">{r.target_id?.slice(0, 8) ?? '—'}</span> },
  {
    key: 'previous_value', label: 'Details',
    render: (r) => {
      if (r.previous_value == null && r.new_value == null) return <span className="text-white/30 text-xs">—</span>;
      return (
        <span className="font-mono text-xs text-white/50">
          {JSON.stringify(r.previous_value).slice(0, 20)} → {JSON.stringify(r.new_value).slice(0, 20)}
        </span>
      );
    },
  },
];

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminFilter, setAdminFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<AuditActionType | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    supabase
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setLogs((data as AuditLogEntry[]) ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (adminFilter && !l.admin_id?.includes(adminFilter)) return false;
      if (actionFilter !== 'all' && l.action_type !== actionFilter) return false;
      if (startDate && l.created_at < startDate) return false;
      if (endDate && l.created_at > endDate + 'T23:59:59') return false;
      return true;
    });
  }, [logs, adminFilter, actionFilter, startDate, endDate]);

  if (loading) return <LoadingSkeleton rows={8} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard title="Total Log Entries" value={logs.length} icon="📋" color="yellow" />
        <StatCard title="Filtered Results" value={filtered.length} icon="🔍" color="cyan" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-white/40 text-xs uppercase tracking-widest">Admin ID</label>
          <input
            type="text"
            value={adminFilter}
            onChange={(e) => setAdminFilter(e.target.value)}
            placeholder="Filter by admin ID..."
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FFD700]/50 w-48"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-white/40 text-xs uppercase tracking-widest">Action Type</label>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value as AuditActionType | 'all')} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/50">
            <option value="all">All</option>
            {ACTION_TYPES.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-white/40 text-xs uppercase tracking-widest">From</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/50" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-white/40 text-xs uppercase tracking-widest">To</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/50" />
        </div>
      </div>

      <DataTable<AuditLogEntry>
        columns={columns}
        data={filtered}
        pageSize={20}
        emptyMessage="No audit logs found."
      />
    </div>
  );
}
