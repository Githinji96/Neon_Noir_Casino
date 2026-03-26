import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminStore, GameConfig } from '../../store/adminStore';
import { useToast } from '../../components/admin/ToastProvider';
import ConfirmModal from '../../components/admin/ConfirmModal';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';
import { PAYOUT_TABLE } from '../../config/gameConfig';
import { INITIAL_TABLES } from '../../config/liveTablesData';

interface GameRow {
  game_id: string;
  name: string;
  enabled: boolean;
  min_bet: number;
  max_bet: number;
  volatility: string;
  dbId?: string;
}

interface EditForm {
  min_bet: string;
  max_bet: string;
  volatility: string;
  errors: Record<string, string>;
}

interface LiveTableRow {
  id: string;
  name: string;
  dealer_name: string;
  max_players: number;
  status: string;
}

interface TableForm {
  name: string;
  dealer_name: string;
  max_players: string;
}

const GAME_NAMES = Object.keys(PAYOUT_TABLE);

export default function GamesPage() {
  const { toast } = useToast();
  const { auditLog, adminProfile } = useAdminStore();
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ min_bet: '', max_bet: '', volatility: 'medium', errors: {} });

  const [liveTables, setLiveTables] = useState<LiveTableRow[]>([]);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [tableForm, setTableForm] = useState<TableForm>({ name: '', dealer_name: '', max_players: '9' });

  async function fetchGames() {
    const { data: configs } = await supabase.from('admin_game_config').select('*');
    const cfgMap: Record<string, GameConfig> = {};
    (configs as GameConfig[] ?? []).forEach((c) => { cfgMap[c.game_id] = c; });

    setGames(GAME_NAMES.map((id) => ({
      game_id: id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      enabled: cfgMap[id]?.enabled ?? true,
      min_bet: cfgMap[id]?.min_bet ?? 10,
      max_bet: cfgMap[id]?.max_bet ?? 5000,
      volatility: cfgMap[id]?.volatility ?? 'medium',
      dbId: cfgMap[id]?.id,
    })));
    setLoading(false);
  }

  async function fetchTables() {
    const { data } = await supabase.from('live_tables').select('id, name, dealer_name, max_players, status');
    if (data && data.length > 0) {
      setLiveTables(data as LiveTableRow[]);
    } else {
      setLiveTables(INITIAL_TABLES.map((t) => ({ id: t.id, name: t.name, dealer_name: t.dealerName, max_players: t.maxPlayers, status: t.status })));
    }
  }

  useEffect(() => { fetchGames(); fetchTables(); }, []);

  async function toggleGame(game: GameRow) {
    const newEnabled = !game.enabled;
    await supabase.from('admin_game_config').upsert({ game_id: game.game_id, enabled: newEnabled, min_bet: game.min_bet, max_bet: game.max_bet, volatility: game.volatility }, { onConflict: 'game_id' });
    await auditLog({ admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin', action_type: 'game_toggle', target_entity: 'admin_game_config', target_id: game.game_id, previous_value: game.enabled, new_value: newEnabled, ip_address: null });
    toast(`${game.name} ${newEnabled ? 'enabled' : 'disabled'}.`, 'success');
    fetchGames();
  }

  function openEdit(game: GameRow) {
    setEditingId(game.game_id);
    setEditForm({ min_bet: String(game.min_bet), max_bet: String(game.max_bet), volatility: game.volatility, errors: {} });
  }

  async function saveEdit(game: GameRow) {
    const errors: Record<string, string> = {};
    const min = parseFloat(editForm.min_bet);
    const max = parseFloat(editForm.max_bet);
    if (isNaN(min) || min < 1) errors.min_bet = 'Min bet must be ≥ 1';
    if (isNaN(max) || max <= min) errors.max_bet = 'Max bet must be > min bet';
    if (Object.keys(errors).length) { setEditForm((f) => ({ ...f, errors })); return; }

    await supabase.from('admin_game_config').upsert({ game_id: game.game_id, enabled: game.enabled, min_bet: min, max_bet: max, volatility: editForm.volatility }, { onConflict: 'game_id' });
    await auditLog({ admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin', action_type: 'game_config_update', target_entity: 'admin_game_config', target_id: game.game_id, previous_value: { min_bet: game.min_bet, max_bet: game.max_bet }, new_value: { min_bet: min, max_bet: max }, ip_address: null });
    toast('Game config saved.', 'success');
    setEditingId(null);
    fetchGames();
  }

  async function saveTable() {
    const max = parseInt(tableForm.max_players);
    if (!tableForm.name.trim() || !tableForm.dealer_name.trim() || isNaN(max)) { toast('Fill all fields.', 'error'); return; }
    const payload = { name: tableForm.name, dealer_name: tableForm.dealer_name, max_players: max, status: 'active' };
    if (editingTableId) {
      await supabase.from('live_tables').update(payload).eq('id', editingTableId);
      await auditLog({ admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin', action_type: 'table_edit', target_entity: 'live_tables', target_id: editingTableId, previous_value: null, new_value: payload, ip_address: null });
      toast('Table updated.', 'success');
    } else {
      await supabase.from('live_tables').insert(payload);
      await auditLog({ admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin', action_type: 'table_create', target_entity: 'live_tables', target_id: null, previous_value: null, new_value: payload, ip_address: null });
      toast('Table created.', 'success');
    }
    setTableModalOpen(false);
    setEditingTableId(null);
    setTableForm({ name: '', dealer_name: '', max_players: '9' });
    fetchTables();
  }

  if (loading) return <LoadingSkeleton rows={8} />;

  return (
    <div className="flex flex-col gap-6">
      {/* Games table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h3 className="text-white/60 text-xs uppercase tracking-widest">Game Configuration</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                {['Game', 'Enabled', 'Min Bet', 'Max Bet', 'Volatility', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-widest text-white/50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <>
                  <tr key={game.game_id} className="border-b border-white/5">
                    <td className="px-4 py-3 text-white font-semibold">{game.name}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleGame(game)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${game.enabled ? 'bg-[#FFD700]' : 'bg-white/20'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${game.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-white/70">KES {game.min_bet}</td>
                    <td className="px-4 py-3 text-white/70">KES {game.max_bet}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${
                        game.volatility === 'high' ? 'bg-red-500/20 text-red-400' :
                        game.volatility === 'low' ? 'bg-green-500/20 text-green-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>{game.volatility}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(game)} className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs transition-colors">Edit</button>
                    </td>
                  </tr>
                  {editingId === game.game_id && (
                    <tr key={`${game.game_id}-edit`} className="border-b border-white/10 bg-white/5">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="flex flex-wrap gap-4 items-end">
                          <div className="flex flex-col gap-1">
                            <label className="text-white/40 text-xs">Min Bet</label>
                            <input type="number" min="1" value={editForm.min_bet} onChange={(e) => setEditForm((f) => ({ ...f, min_bet: e.target.value }))} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white w-28 focus:outline-none focus:border-[#FFD700]/50" />
                            {editForm.errors.min_bet && <p className="text-red-400 text-xs">{editForm.errors.min_bet}</p>}
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-white/40 text-xs">Max Bet</label>
                            <input type="number" min="1" value={editForm.max_bet} onChange={(e) => setEditForm((f) => ({ ...f, max_bet: e.target.value }))} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white w-28 focus:outline-none focus:border-[#FFD700]/50" />
                            {editForm.errors.max_bet && <p className="text-red-400 text-xs">{editForm.errors.max_bet}</p>}
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-white/40 text-xs">Volatility</label>
                            <select value={editForm.volatility} onChange={(e) => setEditForm((f) => ({ ...f, volatility: e.target.value }))} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/50">
                              {['low', 'medium', 'high'].map((v) => <option key={v} value={v}>{v}</option>)}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => saveEdit(game)} className="px-4 py-2 rounded-lg bg-[#FFD700] text-black text-sm font-semibold hover:bg-yellow-400 transition-colors">Save</button>
                            <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15 transition-colors">Cancel</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Tables */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-white/60 text-xs uppercase tracking-widest">Live Tables</h3>
          <button onClick={() => { setEditingTableId(null); setTableForm({ name: '', dealer_name: '', max_players: '9' }); setTableModalOpen(true); }} className="px-3 py-1.5 rounded-lg bg-[#FFD700] text-black text-xs font-semibold hover:bg-yellow-400 transition-colors">
            + Create Table
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                {['Name', 'Dealer', 'Max Players', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-widest text-white/50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liveTables.map((t) => (
                <tr key={t.id} className="border-b border-white/5">
                  <td className="px-4 py-3 text-white">{t.name}</td>
                  <td className="px-4 py-3 text-white/70">{t.dealer_name}</td>
                  <td className="px-4 py-3 text-white/70">{t.max_players}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${t.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/50'}`}>{t.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setEditingTableId(t.id); setTableForm({ name: t.name, dealer_name: t.dealer_name, max_players: String(t.max_players) }); setTableModalOpen(true); }} className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs transition-colors">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table form modal */}
      {tableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setTableModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-[#111118]/95 border border-white/10 rounded-2xl p-6">
            <h2 className="font-orbitron text-lg font-bold text-white mb-4">{editingTableId ? 'Edit Table' : 'Create Table'}</h2>
            <div className="flex flex-col gap-3">
              {[{ label: 'Table Name', key: 'name' as const }, { label: 'Dealer Name', key: 'dealer_name' as const }].map((f) => (
                <div key={f.key} className="flex flex-col gap-1">
                  <label className="text-white/40 text-xs uppercase tracking-widest">{f.label}</label>
                  <input value={tableForm[f.key]} onChange={(e) => setTableForm((p) => ({ ...p, [f.key]: e.target.value }))} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/50" />
                </div>
              ))}
              <div className="flex flex-col gap-1">
                <label className="text-white/40 text-xs uppercase tracking-widest">Max Players</label>
                <input type="number" min="1" value={tableForm.max_players} onChange={(e) => setTableForm((p) => ({ ...p, max_players: e.target.value }))} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/50" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setTableModalOpen(false)} className="px-4 py-2 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/15 transition-colors">Cancel</button>
              <button onClick={saveTable} className="px-4 py-2 rounded-lg bg-[#FFD700] text-black text-sm font-semibold hover:bg-yellow-400 transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
