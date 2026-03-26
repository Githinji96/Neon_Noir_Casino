import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminStore } from '../../store/adminStore';
import { useToast } from '../../components/admin/ToastProvider';
import ConfirmModal from '../../components/admin/ConfirmModal';
import { INITIAL_TABLES } from '../../config/liveTablesData';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';

interface TableRow {
  id: string;
  name: string;
  game_type: string;
  status: string;
  current_players: number;
  max_players: number;
  dealer_name: string;
}

interface MockPlayer {
  id: string;
  username: string;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border border-green-500/30',
  paused: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  inactive: 'bg-white/10 text-white/40',
};

function mockPlayers(tableId: string): MockPlayer[] {
  const seed = tableId.charCodeAt(0);
  return Array.from({ length: (seed % 4) + 1 }, (_, i) => ({ id: `p${i}`, username: `Player${seed + i}` }));
}

export default function LiveTablesAdminPage() {
  const { toast } = useToast();
  const { auditLog, adminProfile } = useAdminStore();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [restartConfirm, setRestartConfirm] = useState<string | null>(null);
  const [playersModal, setPlayersModal] = useState<TableRow | null>(null);

  async function fetchTables() {
    const { data } = await supabase.from('live_tables').select('id, name, game_type, status, current_players, max_players, dealer_name');
    if (data && data.length > 0) {
      setTables(data as TableRow[]);
    } else {
      setTables(INITIAL_TABLES.map((t) => ({
        id: t.id,
        name: t.name,
        game_type: t.gameType,
        status: t.status === 'live' ? 'active' : t.status === 'full' ? 'active' : 'inactive',
        current_players: t.currentPlayers,
        max_players: t.maxPlayers,
        dealer_name: t.dealerName,
      })));
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchTables();
    const id = setInterval(fetchTables, 5000);
    return () => clearInterval(id);
  }, []);

  async function updateStatus(table: TableRow, status: 'active' | 'paused') {
    await supabase.from('live_tables').update({ status }).eq('id', table.id);
    const action = status === 'paused' ? 'table_pause' : 'table_resume';
    await auditLog({ admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin', action_type: action, target_entity: 'live_tables', target_id: table.id, previous_value: table.status, new_value: status, ip_address: null });
    toast(`Table ${status === 'paused' ? 'paused' : 'resumed'}.`, 'success');
    fetchTables();
  }

  async function restartRound(tableId: string) {
    await auditLog({ admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin', action_type: 'round_restart', target_entity: 'live_tables', target_id: tableId, previous_value: null, new_value: null, ip_address: null });
    toast('Round restarted.', 'info');
    setRestartConfirm(null);
  }

  async function kickPlayer(tableId: string, playerId: string) {
    await auditLog({ admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin', action_type: 'player_kick', target_entity: 'live_tables', target_id: tableId, previous_value: null, new_value: playerId, ip_address: null });
    toast('Player kicked.', 'info');
  }

  if (loading) return <LoadingSkeleton rows={6} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map((table) => {
          const mockBets = Math.floor(Math.random() * 50000 + 5000);
          return (
            <div key={table.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">{table.name}</h3>
                  <p className="text-white/40 text-xs capitalize">{table.game_type}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${statusColors[table.status] ?? 'bg-white/10 text-white/40'}`}>
                  {table.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-white/50">
                <span>Players: <span className="text-white">{table.current_players}/{table.max_players}</span></span>
                <span>Dealer: <span className="text-white">{table.dealer_name}</span></span>
                <span>Round: <span className="text-white">Active</span></span>
                <span>Bets: <span className="text-[#FFD700]">KES {mockBets.toLocaleString()}</span></span>
              </div>

              <div className="flex flex-wrap gap-2 mt-1">
                {table.status === 'active' && (
                  <button onClick={() => updateStatus(table, 'paused')} className="px-3 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-xs transition-colors">Pause</button>
                )}
                {table.status === 'paused' && (
                  <button onClick={() => updateStatus(table, 'active')} className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs transition-colors">Resume</button>
                )}
                <button onClick={() => setRestartConfirm(table.id)} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs transition-colors">Restart Round</button>
                <button onClick={() => setPlayersModal(table)} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs transition-colors">View Players</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Restart confirm */}
      {tables.map((t) => (
        <ConfirmModal
          key={t.id}
          isOpen={restartConfirm === t.id}
          onClose={() => setRestartConfirm(null)}
          onConfirm={() => restartRound(t.id)}
          title="Restart Round"
          message={`Restart the current round on "${t.name}"? All active bets will be voided.`}
          confirmLabel="Restart"
          danger
        />
      ))}

      {/* Players modal */}
      {playersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPlayersModal(null)} />
          <div className="relative z-10 w-full max-w-sm bg-[#111118]/95 border border-white/10 rounded-2xl p-6">
            <h2 className="font-orbitron text-lg font-bold text-white mb-4">{playersModal.name} — Players</h2>
            <div className="flex flex-col gap-2">
              {mockPlayers(playersModal.id).map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                  <span className="text-white text-sm">{p.username}</span>
                  <button onClick={() => kickPlayer(playersModal.id, p.id)} className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs transition-colors">Kick</button>
                </div>
              ))}
            </div>
            <button onClick={() => setPlayersModal(null)} className="mt-4 w-full py-2 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/15 transition-colors">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
