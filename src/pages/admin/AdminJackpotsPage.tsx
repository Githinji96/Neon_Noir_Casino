import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../../lib/supabase';
import { useAdminStore, JackpotPool } from '../../store/adminStore';
import { useToast } from '../../components/admin/ToastProvider';
import ConfirmModal from '../../components/admin/ConfirmModal';
import DataTable, { Column } from '../../components/admin/DataTable';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';
import type { JackpotTriggerMode } from '../../logic/jackpot/jackpotEngine';
import { useJackpotOverrideStore } from '../../store/jackpotOverrideStore';

interface WinRow {
  id: string;
  created_at: string;
  amount: number;
  jackpot_id: string;
  profiles: { username: string } | null;
}

interface EditForm {
  base_amount: string;
  contribution_rate: string;
  trigger_probability: string;
  errors: Record<string, string>;
}

const winColumns: Column<WinRow>[] = [
  { key: 'created_at', label: 'Date', render: (r) => new Date(r.created_at).toLocaleString() },
  { key: 'profiles', label: 'Player', render: (r) => r.profiles?.username ?? 'System' },
  { key: 'amount', label: 'Amount', render: (r) => <span className="text-[#FFD700] font-mono">KES {r.amount.toLocaleString()}</span> },
  { key: 'jackpot_id', label: 'Jackpot ID', render: (r) => <span className="font-mono text-white/40 text-xs">{r.jackpot_id.slice(0, 8)}</span> },
];

export default function AdminJackpotsPage() {
  const { toast } = useToast();
  const { auditLog, adminProfile } = useAdminStore();
  const [jackpots, setJackpots] = useState<JackpotPool[]>([]);
  const [wins, setWins] = useState<WinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ base_amount: '', contribution_rate: '', trigger_probability: '', errors: {} });
  const [resetConfirm, setResetConfirm] = useState<string | null>(null);
  const [scheduleDates, setScheduleDates] = useState<Record<string, string>>({});
  const [minThresholds, setMinThresholds] = useState<Record<string, string>>({});

  const { overrides, setMode, forceNext, scheduleAt, setMinThreshold, cancel, refresh } = useJackpotOverrideStore();

  // Sync persisted overrides into engine on mount
  useEffect(() => { refresh(); }, []);

  async function fetchData() {
    const [jpRes, winsRes] = await Promise.all([
      supabase.from('jackpots').select('*').order('type'),
      supabase.from('jackpot_wins').select('id, created_at, amount, jackpot_id, profiles(username)').order('created_at', { ascending: false }).limit(50),
    ]);
    setJackpots((jpRes.data as JackpotPool[]) ?? []);
    setWins((winsRes.data ?? []).map((row: any) => ({
      ...row,
      profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles ?? null,
    })) as WinRow[]);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  function openEdit(jp: JackpotPool) {
    setEditingId(jp.id);
    setEditForm({ base_amount: String(jp.base_amount), contribution_rate: String(jp.contribution_rate), trigger_probability: String(jp.trigger_probability), errors: {} });
  }

  async function saveEdit(jp: JackpotPool) {
    const errors: Record<string, string> = {};
    const base = parseFloat(editForm.base_amount);
    const contrib = parseFloat(editForm.contribution_rate);
    const trigger = parseFloat(editForm.trigger_probability);
    if (isNaN(base) || base <= 0) errors.base_amount = 'Must be > 0';
    if (isNaN(contrib) || contrib < 0.001 || contrib > 0.1) errors.contribution_rate = 'Must be 0.001–0.1';
    if (isNaN(trigger) || trigger < 0.000001 || trigger > 0.01) errors.trigger_probability = 'Must be 0.000001–0.01';
    if (Object.keys(errors).length) { setEditForm((f) => ({ ...f, errors })); return; }

    const { error } = await supabase.from('jackpots').update({ base_amount: base, contribution_rate: contrib, trigger_probability: trigger }).eq('id', jp.id);
    if (error) { toast(error.message, 'error'); return; }
    await auditLog({ admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin', action_type: 'jackpot_config_update', target_entity: 'jackpots', target_id: jp.id, previous_value: { base_amount: jp.base_amount, contribution_rate: jp.contribution_rate }, new_value: { base_amount: base, contribution_rate: contrib }, ip_address: null });
    toast('Jackpot config saved.', 'success');
    setEditingId(null);
    fetchData();
  }

  async function forceReset(jp: JackpotPool) {
    await supabase.from('jackpots').update({ current_amount: jp.base_amount, last_reset: new Date().toISOString() }).eq('id', jp.id);
    await supabase.from('jackpot_wins').insert({ jackpot_id: jp.id, user_id: null, amount: 0 });
    await auditLog({ admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin', action_type: 'jackpot_force_reset', target_entity: 'jackpots', target_id: jp.id, previous_value: jp.current_amount, new_value: jp.base_amount, ip_address: null });
    toast(`${jp.name} reset to base amount.`, 'success');
    setResetConfirm(null);
    fetchData();
  }

  function handleSetMode(id: string, mode: JackpotTriggerMode) {
    setMode(id, mode);
    toast(`Mode set to ${mode}`, 'success');
  }

  function handleForceNext(id: string, name: string) {
    forceNext(id);
    toast(`${name}: will trigger on next spin`, 'success');
  }

  function handleSchedule(id: string, name: string) {
    const dateStr = scheduleDates[id];
    if (!dateStr) { toast('Pick a date/time first', 'error'); return; }
    const ts = new Date(dateStr).getTime();
    if (isNaN(ts) || ts <= Date.now()) { toast('Must be a future date/time', 'error'); return; }
    scheduleAt(id, ts);
    toast(`${name}: scheduled for ${new Date(ts).toLocaleString()}`, 'success');
  }

  function handleSetThreshold(id: string, name: string) {
    const val = parseFloat(minThresholds[id] ?? '0');
    if (isNaN(val) || val < 0) { toast('Invalid amount', 'error'); return; }
    setMinThreshold(id, val);
    toast(`${name}: min threshold set to KES ${val.toLocaleString()}`, 'success');
  }

  function handleCancelOverride(id: string, name: string) {
    cancel(id);
    toast(`${name}: override cleared`, 'success');
  }

  const trendData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return { day: d.toLocaleDateString('en', { weekday: 'short' }), mega: Math.floor(500000 + i * 80000), daily: Math.floor(50000 + i * 8000), hourly: Math.floor(5000 + i * 800) };
  });

  if (loading) return <LoadingSkeleton rows={8} />;

  return (
    <div className="flex flex-col gap-6">
      {/* Jackpot cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {jackpots.map((jp) => (
          <div key={jp.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-orbitron text-white font-bold">{jp.name}</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 uppercase">{jp.type}</span>
            </div>
            <p className="font-orbitron text-3xl font-black text-[#FFD700]">KES {jp.current_amount.toLocaleString()}</p>
            <div className="text-white/40 text-xs flex flex-col gap-1">
              <span>Base: KES {jp.base_amount.toLocaleString()}</span>
              <span>Contribution: {(jp.contribution_rate * 100).toFixed(2)}%</span>
              <span>Trigger prob: {jp.trigger_probability}</span>
              <span>Last reset: {jp.last_reset ? new Date(jp.last_reset).toLocaleString() : '—'}</span>
            </div>

            {editingId === jp.id ? (
              <div className="flex flex-col gap-2 mt-1">
                {[
                  { label: 'Base Amount', key: 'base_amount' as const },
                  { label: 'Contribution Rate', key: 'contribution_rate' as const },
                  { label: 'Trigger Probability', key: 'trigger_probability' as const },
                ].map((f) => (
                  <div key={f.key} className="flex flex-col gap-0.5">
                    <label className="text-white/40 text-xs">{f.label}</label>
                    <input type="number" step="any" value={editForm[f.key]} onChange={(e) => setEditForm((p) => ({ ...p, [f.key]: e.target.value }))} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#FFD700]/50" />
                    {editForm.errors[f.key] && <p className="text-red-400 text-xs">{editForm.errors[f.key]}</p>}
                  </div>
                ))}
                <div className="flex gap-2 mt-1">
                  <button onClick={() => saveEdit(jp)} className="px-3 py-1.5 rounded-lg bg-[#FFD700] text-black text-xs font-semibold hover:bg-yellow-400 transition-colors">Save</button>
                  <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/15 transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                {/* ── Trigger Control Panel ── */}
                {(() => {
                  const ov = overrides[jp.id];
                  if (!ov) return null;
                  const modeColor: Record<JackpotTriggerMode, string> = {
                    auto: 'text-green-400',
                    locked: 'text-red-400',
                    scheduled: 'text-cyan-400',
                  };
                  return (
                    <div className="border border-white/10 rounded-xl p-3 flex flex-col gap-2 bg-black/30">
                      <div className="flex items-center justify-between">
                        <span className="text-white/50 text-xs uppercase tracking-widest">Trigger Control</span>
                        <span className={`text-xs font-mono font-bold ${modeColor[ov.mode]}`}>
                          {ov.mode.toUpperCase()}
                          {ov.forceTriggerNext && ' · FORCE PENDING'}
                          {ov.mode === 'scheduled' && ov.scheduledTriggerAt > 0 && ` · ${new Date(ov.scheduledTriggerAt).toLocaleString()}`}
                          {ov.minAmountThreshold > 0 && ` · min KES ${ov.minAmountThreshold.toLocaleString()}`}
                        </span>
                      </div>

                      {/* Mode selector */}
                      <div className="flex gap-1">
                        {(['auto', 'locked', 'scheduled'] as JackpotTriggerMode[]).map((m) => (
                          <button
                            key={m}
                            onClick={() => handleSetMode(jp.id, m)}
                            className={`flex-1 py-1 rounded-lg text-xs font-semibold transition-colors ${
                              ov.mode === m
                                ? m === 'locked' ? 'bg-red-600 text-white' : m === 'scheduled' ? 'bg-cyan-600 text-white' : 'bg-green-700 text-white'
                                : 'bg-white/5 text-white/40 hover:bg-white/10'
                            }`}
                          >
                            {m.charAt(0).toUpperCase() + m.slice(1)}
                          </button>
                        ))}
                      </div>

                      {/* Force next win */}
                      <button
                        onClick={() => handleForceNext(jp.id, jp.name)}
                        disabled={ov.mode === 'locked'}
                        className="w-full py-1.5 rounded-lg bg-[#FFD700]/20 border border-[#FFD700]/40 text-[#FFD700] text-xs font-semibold hover:bg-[#FFD700]/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ⚡ Force Next Win
                      </button>

                      {/* Schedule trigger */}
                      <div className="flex gap-1">
                        <input
                          type="datetime-local"
                          value={scheduleDates[jp.id] ?? ''}
                          onChange={(e) => setScheduleDates((p) => ({ ...p, [jp.id]: e.target.value }))}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                        />
                        <button
                          onClick={() => handleSchedule(jp.id, jp.name)}
                          disabled={ov.mode === 'locked'}
                          className="px-2 py-1 rounded-lg bg-cyan-600/30 border border-cyan-500/30 text-cyan-400 text-xs hover:bg-cyan-600/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Schedule
                        </button>
                      </div>

                      {/* Min threshold */}
                      <div className="flex gap-1">
                        <input
                          type="number"
                          placeholder="Min pool (KES)"
                          value={minThresholds[jp.id] ?? ''}
                          onChange={(e) => setMinThresholds((p) => ({ ...p, [jp.id]: e.target.value }))}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-white/30"
                        />
                        <button
                          onClick={() => handleSetThreshold(jp.id, jp.name)}
                          className="px-2 py-1 rounded-lg bg-white/10 text-white/60 text-xs hover:bg-white/15 transition-colors"
                        >
                          Set
                        </button>
                      </div>

                      {/* Cancel override */}
                      {(ov.forceTriggerNext || ov.scheduledTriggerAt > 0 || ov.mode !== 'auto') && (
                        <button
                          onClick={() => handleCancelOverride(jp.id, jp.name)}
                          className="w-full py-1 rounded-lg bg-white/5 text-white/40 text-xs hover:bg-white/10 transition-colors"
                        >
                          Clear Override
                        </button>
                      )}
                    </div>
                  );
                })()}

                <div className="flex gap-2 mt-1">
                  <button onClick={() => openEdit(jp)} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs transition-colors">Edit Config</button>
                  <button onClick={() => setResetConfirm(jp.id)} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs transition-colors">Force Reset</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Growth chart */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h3 className="text-white/60 text-xs uppercase tracking-widest mb-4">Jackpot Growth (7 days)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="day" tick={{ fill: '#ffffff40', fontSize: 10 }} />
            <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#111118', border: '1px solid #ffffff20', borderRadius: 8 }} />
            <Line type="monotone" dataKey="mega" stroke="#FFD700" strokeWidth={2} dot={false} name="Mega" />
            <Line type="monotone" dataKey="daily" stroke="#A855F7" strokeWidth={2} dot={false} name="Daily" />
            <Line type="monotone" dataKey="hourly" stroke="#00FFFF" strokeWidth={2} dot={false} name="Hourly" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Winner history */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h3 className="text-white/60 text-xs uppercase tracking-widest mb-4">Winner History</h3>
        <DataTable<WinRow> columns={winColumns} data={wins} pageSize={10} emptyMessage="No jackpot wins yet." />
      </div>

      {jackpots.map((jp) => (
        <ConfirmModal
          key={jp.id}
          isOpen={resetConfirm === jp.id}
          onClose={() => setResetConfirm(null)}
          onConfirm={() => forceReset(jp)}
          title={`Force Reset: ${jp.name}`}
          message={`This will reset the jackpot to KES ${jp.base_amount.toLocaleString()}. This action cannot be undone.`}
          confirmLabel="Force Reset"
          danger
        />
      ))}
    </div>
  );
}
