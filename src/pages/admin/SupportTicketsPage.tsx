import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminStore } from '../../store/adminStore';
import { useToast } from '../../components/admin/ToastProvider';
import DataTable, { Column } from '../../components/admin/DataTable';
import StatCard from '../../components/admin/StatCard';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';
import ConfirmModal from '../../components/admin/ConfirmModal';
import { AnimatePresence, motion } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

type TicketStatus   = 'new' | 'open' | 'pending' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

interface Ticket {
  id: string;
  ticket_number: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigned_admin: string | null;
  created_at: string;
  updated_at: string;
}

interface Reply {
  id: string;
  ticket_id: string;
  author_name: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<TicketStatus, string> = {
  new:      'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  open:     'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  pending:  'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  resolved: 'bg-green-500/20 text-green-400 border border-green-500/30',
  closed:   'bg-white/10 text-white/40 border border-white/10',
};

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low:      'bg-slate-500/20 text-slate-400',
  medium:   'bg-blue-500/20 text-blue-400',
  high:     'bg-orange-500/20 text-orange-400',
  critical: 'bg-red-500/20 text-red-400',
};

// ─── Ticket Detail Drawer ─────────────────────────────────────────────────────

function TicketDrawer({
  ticket, onClose, onUpdated,
}: {
  ticket: Ticket;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const { adminProfile } = useAdminStore();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('support_ticket_replies')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => setReplies((data as Reply[]) ?? []));
  }, [ticket.id]);

  async function handleSaveStatus() {
    setSaving(true);
    const { error } = await supabase
      .from('support_tickets')
      .update({ status, priority })
      .eq('id', ticket.id);
    setSaving(false);
    if (error) { toast(error.message, 'error'); return; }
    toast('Ticket updated.', 'success');
    onUpdated();
  }

  async function handleSendReply() {
    if (!replyText.trim()) return;
    setSendingReply(true);
    const authorName = adminProfile?.username ?? 'Admin';
    const { error } = await supabase.from('support_ticket_replies').insert({
      ticket_id: ticket.id,
      author_name: authorName,
      message: replyText.trim(),
      is_admin: true,
    });
    if (error) { toast(error.message, 'error'); setSendingReply(false); return; }
    // Update ticket status to open when admin replies
    await supabase.from('support_tickets').update({ status: 'open' }).eq('id', ticket.id);
    setReplies((p) => [...p, {
      id: Date.now().toString(),
      ticket_id: ticket.id,
      author_name: authorName,
      message: replyText.trim(),
      is_admin: true,
      created_at: new Date().toISOString(),
    }]);
    setReplyText('');
    setStatus('open');
    setSendingReply(false);
    toast('Reply sent.', 'success');
    onUpdated();
  }

  async function handleClose() {
    const { error } = await supabase
      .from('support_tickets')
      .update({ status: 'closed' })
      .eq('id', ticket.id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Ticket closed.', 'info');
    onUpdated();
    onClose();
  }

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex justify-end"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative z-10 w-full max-w-xl h-full overflow-y-auto flex flex-col"
        style={{ background: 'linear-gradient(160deg,#0d0d1a,#060610)', borderLeft: '1px solid rgba(255,215,0,0.12)' }}
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div>
            <p className="text-white/40 text-xs font-orbitron tracking-widest mb-0.5">TICKET</p>
            <h2 className="font-orbitron text-lg font-bold text-white">{ticket.ticket_number}</h2>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
            ✕
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-5 p-5 overflow-y-auto">
          {/* Ticket details */}
          <div className="rounded-xl p-4 flex flex-col gap-2 border border-white/8" style={{ background: 'rgba(255,255,255,0.03)' }}>
            {[
              ['Ticket Number', ticket.ticket_number],
              ['Player',        ticket.name],
              ['Email',         ticket.email],
              ['Subject',       ticket.subject],
              ['Created',       new Date(ticket.created_at).toLocaleString()],
              ['Last Updated',  new Date(ticket.updated_at).toLocaleString()],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-3 items-start">
                <span className="text-white/40 text-xs font-orbitron w-28 shrink-0">{label}</span>
                <span className="text-white/80 text-xs break-all">{value}</span>
              </div>
            ))}
            <div className="mt-2 pt-3 border-t border-white/8">
              <p className="text-white/40 text-xs font-orbitron mb-1.5">Message</p>
              <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{ticket.message}</p>
            </div>
          </div>

          {/* Status + Priority controls */}
          <div className="flex flex-col gap-3 p-4 rounded-xl border border-white/8" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <p className="font-orbitron text-xs text-white/50 tracking-widest uppercase">Update Ticket</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-white/40 text-xs">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400">
                  {['new','open','pending','resolved','closed'].map((s) =>
                    <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-white/40 text-xs">Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400">
                  {['low','medium','high','critical'].map((p) =>
                    <option key={p} value={p} className="bg-slate-900">{p}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveStatus} disabled={saving}
                className="flex-1 py-2 rounded-lg font-orbitron text-xs font-bold text-black transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#FFD700,#FFA500)' }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={handleClose}
                className="px-4 py-2 rounded-lg font-orbitron text-xs text-white/60 border border-white/15 hover:bg-white/5 transition-all">
                Close Ticket
              </button>
            </div>
          </div>

          {/* Conversation */}
          <div className="flex flex-col gap-2">
            <p className="font-orbitron text-xs text-white/50 tracking-widest uppercase">Conversation</p>
            {replies.length === 0 ? (
              <p className="text-white/25 text-xs text-center py-4">No replies yet.</p>
            ) : (
              replies.map((r) => (
                <div key={r.id}
                  className={`rounded-xl px-4 py-3 text-sm ${r.is_admin ? 'ml-6' : 'mr-6'}`}
                  style={{
                    background: r.is_admin ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.05)',
                    border: r.is_admin ? '1px solid rgba(255,215,0,0.15)' : '1px solid rgba(255,255,255,0.08)',
                  }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-orbitron text-xs font-bold"
                      style={{ color: r.is_admin ? '#FFD700' : 'rgba(255,255,255,0.8)' }}>
                      {r.author_name}{r.is_admin && ' (Support)'}
                    </span>
                    <span className="text-white/30 text-[10px]">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-white/70 leading-relaxed whitespace-pre-wrap">{r.message}</p>
                </div>
              ))
            )}
          </div>

          {/* Reply box */}
          <div className="flex flex-col gap-2">
            <label className="font-orbitron text-xs text-white/50 tracking-widest uppercase">Admin Reply</label>
            <textarea
              rows={3}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your reply to the player..."
              className="rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none resize-none
                bg-white/5 border border-white/10 focus:border-yellow-400/50 transition-all"
            />
            <button onClick={handleSendReply} disabled={sendingReply || !replyText.trim()}
              className="self-end px-5 py-2.5 rounded-xl font-orbitron text-xs font-bold text-black transition-all
                disabled:opacity-40 hover:brightness-110"
              style={{ background: 'linear-gradient(135deg,#FFD700,#FFA500)' }}>
              {sendingReply ? 'Sending…' : '📨 Send Reply'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Support Tickets Page ─────────────────────────────────────────────────────

export default function SupportTicketsPage() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ticket | null>(null);

  async function fetchTickets() {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { toast(error.message, 'error'); return; }
    setTickets((data as Ticket[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchTickets(); }, []);

  async function handleDelete(id: string) {
    const { error } = await supabase.from('support_tickets').delete().eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Ticket deleted.', 'info');
    setDeleteTarget(null);
    fetchTickets();
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter   !== 'all' && t.status   !== statusFilter)   return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (q && !t.ticket_number.toLowerCase().includes(q)
            && !t.name.toLowerCase().includes(q)
            && !t.email.toLowerCase().includes(q)
            && !t.subject.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tickets, search, statusFilter, priorityFilter]);

  const stats = useMemo(() => ({
    total:    tickets.length,
    open:     tickets.filter((t) => t.status === 'new' || t.status === 'open').length,
    pending:  tickets.filter((t) => t.status === 'pending').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
    closed:   tickets.filter((t) => t.status === 'closed').length,
  }), [tickets]);

  const columns: Column<Ticket>[] = [
    { key: 'ticket_number', label: 'Ticket #',  render: (r) => <span className="font-mono text-yellow-400/80 text-xs">{r.ticket_number}</span> },
    { key: 'name',          label: 'Player',     render: (r) => <div><p className="text-white text-xs font-semibold">{r.name}</p><p className="text-white/40 text-[10px]">{r.email}</p></div> },
    { key: 'subject',       label: 'Subject',    render: (r) => <span className="text-white/80 text-xs line-clamp-1">{r.subject}</span> },
    { key: 'status',        label: 'Status',     render: (r) => <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${STATUS_COLORS[r.status]}`}>{r.status}</span> },
    { key: 'priority',      label: 'Priority',   render: (r) => <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${PRIORITY_COLORS[r.priority]}`}>{r.priority}</span> },
    { key: 'created_at',    label: 'Date',       render: (r) => <span className="text-white/50 text-xs">{new Date(r.created_at).toLocaleDateString()}</span> },
    {
      key: 'id', label: 'Actions',
      render: (r) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setSelectedTicket(r)}
            className="px-2 py-1 rounded bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-xs transition-colors">
            👁 View
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}
            className="px-2 py-1 rounded bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs transition-colors">
            🗑
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <LoadingSkeleton rows={8} />;

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard title="Total"    value={stats.total}    icon="🎫" color="yellow" />
        <StatCard title="Open"     value={stats.open}     icon="📬" color="cyan"   />
        <StatCard title="Pending"  value={stats.pending}  icon="⏳" color="yellow" />
        <StatCard title="Resolved" value={stats.resolved} icon="✅" color="green"  />
        <StatCard title="Closed"   value={stats.closed}   icon="🔒" color="red"    />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1 flex-1 min-w-48">
          <label className="text-white/40 text-xs uppercase tracking-widest font-orbitron">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ticket #, player, email, subject…"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-yellow-400/50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-white/40 text-xs uppercase tracking-widest font-orbitron">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TicketStatus | 'all')}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 pr-8 text-sm text-white appearance-none focus:outline-none focus:border-yellow-400">
            {['all','new','open','pending','resolved','closed'].map((s) =>
              <option key={s} value={s} className="bg-slate-900">{s}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-white/40 text-xs uppercase tracking-widest font-orbitron">Priority</label>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as TicketPriority | 'all')}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 pr-8 text-sm text-white appearance-none focus:outline-none focus:border-yellow-400">
            {['all','low','medium','high','critical'].map((p) =>
              <option key={p} value={p} className="bg-slate-900">{p}</option>)}
          </select>
        </div>
      </div>

      <DataTable<Ticket>
        columns={columns}
        data={filtered}
        pageSize={15}
        emptyMessage="No support tickets found."
        onRowClick={(row) => setSelectedTicket(row)}
      />

      {/* Ticket detail drawer */}
      <AnimatePresence>
        {selectedTicket && (
          <TicketDrawer
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
            onUpdated={() => { fetchTickets(); setSelectedTicket(null); }}
          />
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget.id); }}
        title="Delete Ticket"
        message={`Delete ticket ${deleteTarget?.ticket_number} from ${deleteTarget?.name}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
