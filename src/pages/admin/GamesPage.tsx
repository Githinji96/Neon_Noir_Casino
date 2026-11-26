import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminStore, GameConfig } from '../../store/adminStore';
import { useToast } from '../../components/admin/ToastProvider';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';
import MiniGameConfigPanel from '../../components/admin/MiniGameConfigPanel';
import { GAME_LISTINGS } from '../../config/mockData';
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


// ── Mini Game RTP types ────────────────────────────────────────────────────

interface MiniGameRtpRow {
  game_id:                string;
  theoretical_rtp_pct:    number;
  theoretical_house_edge: number;
  total_rounds:           number;
  total_stakes:           number;
  total_gross_payouts:    number;
  observed_rtp_pct:       number | null;
  net_gaming_revenue:     number;
  winning_rounds:         number;
  losing_rounds:          number;
}

const MINI_GAME_LABELS: Record<string, string> = {
  'lucky-wheel':        'Neon Lucky Wheel',
  'scratch-cards':      'Neon Scratch Cards',
  'treasure-chest':     'Cyber Treasure Chest',
  'mini-slot':          'Mini Slot Jackpot',
  'mystery-multiplier': 'Mystery Multiplier',
  'crystal-match':      'Crystal Match',
};


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

  // Mini game RTP stats
  const [miniRtp, setMiniRtp]               = useState<MiniGameRtpRow[]>([]);
  const [miniRtpLoading, setMiniRtpLoading] = useState(false);
  const [miniRtpError, setMiniRtpError]     = useState<string | null>(null);

  const fetchMiniRtp = useCallback(async () => {
    setMiniRtpLoading(true);
    setMiniRtpError(null);
    const { data, error } = await supabase.rpc('get_mini_game_rtp_report', {
      p_game_id:   '',
      p_from_date: null,
      p_to_date:   null,
    });
    if (error) {
      setMiniRtpError(error.message);
    } else {
      setMiniRtp(
        (data as MiniGameRtpRow[] ?? []).map((r) => ({
          ...r,
          theoretical_rtp_pct:    Number(r.theoretical_rtp_pct),
          theoretical_house_edge: Number(r.theoretical_house_edge),
          total_rounds:           Number(r.total_rounds),
          total_stakes:           Number(r.total_stakes),
          total_gross_payouts:    Number(r.total_gross_payouts),
          observed_rtp_pct:       r.observed_rtp_pct != null ? Number(r.observed_rtp_pct) : null,
          net_gaming_revenue:     Number(r.net_gaming_revenue),
          winning_rounds:         Number(r.winning_rounds),
          losing_rounds:          Number(r.losing_rounds),
        }))
      );
    }
    setMiniRtpLoading(false);
  }, []);

  useEffect(() => { void fetchMiniRtp(); }, [fetchMiniRtp]);
  // trigger HMR

  async function fetchGames() {
    const { data: configs } = await supabase.from('admin_game_config').select('*');
    const cfgMap: Record<string, GameConfig> = {};
    (configs as GameConfig[] ?? []).forEach((c) => { cfgMap[c.game_id] = c; });

    setGames(GAME_LISTINGS.map((g) => ({
      game_id: g.id,
      name: g.title,
      enabled: cfgMap[g.id]?.enabled ?? true,
      min_bet: cfgMap[g.id]?.min_bet ?? 1,
      max_bet: cfgMap[g.id]?.max_bet ?? 10000,
      volatility: cfgMap[g.id]?.volatility ?? g.volatility.toLowerCase(),
      dbId: cfgMap[g.id]?.id,
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
    if (isNaN(min) || min < 0.20) errors.min_bet = 'Min bet must be ≥ 0.20';
    if (isNaN(max) || max <= min) errors.max_bet = 'Max bet must be > min bet';
    if (max > 10_000) errors.max_bet = 'Max bet cannot exceed KES 10,000';
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
                            <select value={editForm.volatility} onChange={(e) => setEditForm((f) => ({ ...f, volatility: e.target.value }))} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]">
                              {['low', 'medium', 'high'].map((v) => <option key={v} value={v} className="bg-slate-900 text-white">{v}</option>)}
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

      {/* Mini Jackpot Games — Config + Live Stats */}
      <div className="flex flex-col gap-4">
        <h3 className="text-white/60 text-xs uppercase tracking-widest px-1">Mini Jackpot Games</h3>

        {/* Config Panel */}
        <MiniGameConfigPanel />

        {/* Live RTP & GGR Stats */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <h4 className="text-white/60 text-xs uppercase tracking-widest">Mini Game Performance</h4>
              <p className="text-white/30 text-[10px] mt-0.5">All-time settled rounds · Theoretical vs Observed RTP</p>
            </div>
            <button
              onClick={() => { void fetchMiniRtp(); }}
              className="text-[#FFD700] text-xs font-orbitron hover:text-yellow-300 transition-colors"
            >
              ↻ Refresh
            </button>
          </div>

          {miniRtpLoading ? (
            <div className="p-6"><LoadingSkeleton rows={4} /></div>
          ) : miniRtpError ? (
            <div className="p-6 text-center text-red-400 text-xs font-orbitron">{miniRtpError}</div>
          ) : miniRtp.length === 0 ? (
            <div className="p-8 text-center text-white/30 font-orbitron text-sm tracking-widest">No rounds recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    {['Game', 'Rounds', 'Total Wagered', 'Total Payout', 'NGR', 'Theoretical RTP', 'Observed RTP', 'Win Rate'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-widest text-white/50 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {miniRtp.map((row) => {
                    const winRate = row.total_rounds > 0
                      ? ((row.winning_rounds / row.total_rounds) * 100).toFixed(1)
                      : null;
                    const rtpDiff = row.observed_rtp_pct != null
                      ? row.observed_rtp_pct - row.theoretical_rtp_pct
                      : null;
                    return (
                      <tr key={row.game_id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                        <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">
                          {MINI_GAME_LABELS[row.game_id] ?? row.game_id}
                        </td>
                        <td className="px-4 py-3 font-mono text-white/70">{row.total_rounds.toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono text-white/80">
                          KES {Number(row.total_stakes).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 font-mono text-green-400">
                          KES {Number(row.total_gross_payouts).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-mono font-bold ${row.net_gaming_revenue >= 0 ? 'text-[#FFD700]' : 'text-red-400'}`}>
                            KES {Number(row.net_gaming_revenue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-white/60">
                          {row.theoretical_rtp_pct.toFixed(1)}%
                          <span className="text-white/30 text-[10px] ml-1">({row.theoretical_house_edge.toFixed(1)}% edge)</span>
                        </td>
                        <td className="px-4 py-3">
                          {row.total_rounds === 0 || row.observed_rtp_pct == null ? (
                            <span className="text-white/25 font-mono text-xs">—</span>
                          ) : (
                            <span className={`font-mono font-bold ${
                              rtpDiff !== null && Math.abs(rtpDiff) > 5
                                ? rtpDiff > 0 ? 'text-red-400' : 'text-green-400'
                                : 'text-white/80'
                            }`}>
                              {row.observed_rtp_pct.toFixed(1)}%
                              {rtpDiff !== null && (
                                <span className="text-[10px] ml-1 text-white/40">
                                  ({rtpDiff >= 0 ? '+' : ''}{rtpDiff.toFixed(1)})
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-white/60">
                          {winRate != null ? `${winRate}%` : '—'}
                          {row.total_rounds > 0 && (
                            <span className="text-white/30 text-[10px] ml-1">
                              ({row.winning_rounds}W/{row.losing_rounds}L)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals */}
                {miniRtp.some((r) => r.total_rounds > 0) && (() => {
                  const tot = miniRtp.reduce((a, r) => ({
                    rounds:   a.rounds   + r.total_rounds,
                    stakes:   a.stakes   + r.total_stakes,
                    payouts:  a.payouts  + r.total_gross_payouts,
                    ngr:      a.ngr      + r.net_gaming_revenue,
                    wins:     a.wins     + r.winning_rounds,
                  }), { rounds: 0, stakes: 0, payouts: 0, ngr: 0, wins: 0 });
                  const obsRtp = tot.stakes > 0 ? (tot.payouts / tot.stakes * 100) : null;
                  return (
                    <tfoot>
                      <tr className="border-t border-white/20 bg-white/[0.06]">
                        <td className="px-4 py-3 text-white/50 text-xs font-orbitron uppercase tracking-wider">All Mini Games</td>
                        <td className="px-4 py-3 font-mono font-bold text-white">{tot.rounds.toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono font-bold text-white">KES {tot.stakes.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 font-mono font-bold text-green-400">KES {tot.payouts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 font-mono font-bold">
                          <span className={tot.ngr >= 0 ? 'text-[#FFD700]' : 'text-red-400'}>
                            KES {tot.ngr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/30 text-xs">—</td>
                        <td className="px-4 py-3 font-mono font-bold text-white/80">
                          {obsRtp != null ? `${obsRtp.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-white/60">
                          {tot.rounds > 0 ? `${((tot.wins / tot.rounds) * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    </tfoot>
                  );
                })()}
              </table>
            </div>
          )}
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
