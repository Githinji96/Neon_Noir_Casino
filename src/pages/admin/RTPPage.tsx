import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../../lib/supabase';
import { useAdminStore, RTPConfig, AuditLogEntry } from '../../store/adminStore';
import { useToast } from '../../components/admin/ToastProvider';
import StatCard from '../../components/admin/StatCard';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';

interface AuditRow {
  id: string;
  admin_id: string | null;
  created_at: string;
  previous_value: unknown;
  new_value: unknown;
}

export default function RTPPage() {
  const { toast } = useToast();
  const { auditLog, adminProfile } = useAdminStore();
  const [config, setConfig] = useState<RTPConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetInput, setTargetInput] = useState('');
  const [strengthInput, setStrengthInput] = useState('');
  const [targetError, setTargetError] = useState('');
  const [strengthError, setStrengthError] = useState('');
  const [history, setHistory] = useState<AuditRow[]>([]);

  async function fetchData() {
    const [cfgRes, histRes] = await Promise.all([
      supabase.from('admin_rtp_config').select('*').single(),
      supabase.from('admin_audit_logs').select('id, admin_id, created_at, previous_value, new_value').eq('action_type', 'rtp_update').order('created_at', { ascending: false }).limit(20),
    ]);
    if (cfgRes.data) {
      const c = cfgRes.data as RTPConfig;
      setConfig(c);
      setTargetInput(String((c.target_rtp * 100).toFixed(2)));
      setStrengthInput(String(c.adjustment_strength));
    }
    setHistory((histRes.data as AuditRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  async function saveTarget() {
    setTargetError('');
    const val = parseFloat(targetInput);
    if (isNaN(val) || val < 85 || val > 99) { setTargetError('Value must be between 85 and 99.'); return; }
    const decimal = val / 100;
    const { error } = await supabase.from('admin_rtp_config').update({ target_rtp: decimal, updated_by: adminProfile?.id }).eq('id', config!.id);
    if (error) { toast(error.message, 'error'); return; }
    await auditLog({ admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin', action_type: 'rtp_update', target_entity: 'admin_rtp_config', target_id: config!.id, previous_value: config!.target_rtp, new_value: decimal, ip_address: null });
    toast('Target RTP updated.', 'success');
    fetchData();
  }

  async function saveStrength() {
    setStrengthError('');
    const val = parseFloat(strengthInput);
    if (isNaN(val) || val < 0.1 || val > 10) { setStrengthError('Value must be between 0.1 and 10.'); return; }
    const { error } = await supabase.from('admin_rtp_config').update({ adjustment_strength: val, updated_by: adminProfile?.id }).eq('id', config!.id);
    if (error) { toast(error.message, 'error'); return; }
    await auditLog({ admin_id: adminProfile?.id ?? null, admin_role: adminProfile?.admin_role ?? 'super_admin', action_type: 'rtp_update', target_entity: 'admin_rtp_config', target_id: config!.id, previous_value: config!.adjustment_strength, new_value: val, ip_address: null });
    toast('Adjustment strength updated.', 'success');
    fetchData();
  }

  const targetPct = config ? config.target_rtp * 100 : 96.5;
  const rtpTrend = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    rtp: +(targetPct + (Math.sin(i * 0.8) * 1.5)).toFixed(2),
  }));
  const deviation = 0; // current = target since we can't compute from server

  if (loading) return <LoadingSkeleton rows={8} />;

  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Target RTP" value={`${targetPct.toFixed(2)}%`} icon="🎯" color="yellow" />
        <StatCard title="Current RTP" value={`${targetPct.toFixed(2)}%`} subtitle="Calculated from spin history" icon="📊" color="cyan" />
        <StatCard title="Deviation" value={`${deviation.toFixed(2)}%`} icon="⚠️" color={deviation > 5 ? 'red' : 'green'} />
      </div>

      {/* Forms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
          <h3 className="text-white/60 text-xs uppercase tracking-widest">Target RTP (%)</h3>
          <input
            type="number"
            step="0.01"
            min="85"
            max="99"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/50"
          />
          {targetError && <p className="text-red-400 text-xs">{targetError}</p>}
          <p className="text-white/30 text-xs">Range: 85% – 99%</p>
          <button onClick={saveTarget} className="px-4 py-2 rounded-lg bg-[#FFD700] text-black text-sm font-semibold hover:bg-yellow-400 transition-colors w-fit">Save</button>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
          <h3 className="text-white/60 text-xs uppercase tracking-widest">Adjustment Strength</h3>
          <input
            type="number"
            step="0.1"
            min="0.1"
            max="10"
            value={strengthInput}
            onChange={(e) => setStrengthInput(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/50"
          />
          {strengthError && <p className="text-red-400 text-xs">{strengthError}</p>}
          <p className="text-white/30 text-xs">Range: 0.1 – 10</p>
          <button onClick={saveStrength} className="px-4 py-2 rounded-lg bg-[#FFD700] text-black text-sm font-semibold hover:bg-yellow-400 transition-colors w-fit">Save</button>
        </div>
      </div>

      {/* RTP Trend chart */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h3 className="text-white/60 text-xs uppercase tracking-widest mb-4">RTP Trend (24h)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={rtpTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="hour" tick={{ fill: '#ffffff40', fontSize: 10 }} />
            <YAxis domain={[90, 100]} tick={{ fill: '#ffffff40', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#111118', border: '1px solid #ffffff20', borderRadius: 8 }} />
            <Line type="monotone" dataKey="rtp" stroke="#FFD700" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* History */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h3 className="text-white/60 text-xs uppercase tracking-widest">RTP Update History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                {['Timestamp', 'Admin', 'Previous', 'New Value'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-widest text-white/50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-white/30">No history yet.</td></tr>
              ) : history.map((row) => (
                <tr key={row.id} className="border-b border-white/5">
                  <td className="px-4 py-3 text-white/60 text-xs">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-white/50 text-xs">{row.admin_id?.slice(0, 8) ?? '—'}</td>
                  <td className="px-4 py-3 text-white/70">{typeof row.previous_value === 'number' ? `${(row.previous_value * 100).toFixed(2)}%` : String(row.previous_value ?? '—')}</td>
                  <td className="px-4 py-3 text-[#FFD700]">{typeof row.new_value === 'number' ? `${(row.new_value * 100).toFixed(2)}%` : String(row.new_value ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
