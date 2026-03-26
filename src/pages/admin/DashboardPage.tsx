import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { supabase } from '../../lib/supabase';
import { useAdminStore } from '../../store/adminStore';
import StatCard from '../../components/admin/StatCard';
import AlertsPanel from '../../components/admin/AlertsPanel';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';

interface Metrics {
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  totalBets: number;
  totalPayouts: number;
  currentRTP: number;
  activePlayers: number;
  liveTables: number;
  jackpotMega: number;
  jackpotDaily: number;
  jackpotHourly: number;
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function weekAgoISO() {
  const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10);
}
function monthAgoISO() {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
}

const rtpTrend = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  rtp: +(96.5 + (Math.sin(i * 0.7) * 1.2)).toFixed(2),
}));

const revenueTrend = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (6 - i));
  return { day: d.toLocaleDateString('en', { weekday: 'short' }), revenue: Math.floor(50000 + Math.random() * 80000) };
});

const gameDist = [
  { name: 'Slots', value: 60 },
  { name: 'Live Tables', value: 25 },
  { name: 'Jackpots', value: 15 },
];
const PIE_COLORS = ['#FFD700', '#A855F7', '#00FFFF'];

export default function DashboardPage() {
  const { alerts, dismissAlert } = useAdminStore();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchMetrics() {
    try {
      const today = todayISO();
      const weekAgo = weekAgoISO();
      const monthAgo = monthAgoISO();

      const [txToday, txWeek, txMonth, txAll, rtpCfg, players, tables, jackpots] = await Promise.all([
        supabase.from('transactions').select('amount').eq('status', 'success').gte('created_at', today),
        supabase.from('transactions').select('amount').eq('status', 'success').gte('created_at', weekAgo),
        supabase.from('transactions').select('amount').eq('status', 'success').gte('created_at', monthAgo),
        supabase.from('transactions').select('amount, type').eq('status', 'success'),
        supabase.from('admin_rtp_config').select('target_rtp').single(),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('account_status', 'active'),
        supabase.from('live_tables').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('jackpots').select('name, current_amount'),
      ]);

      const sum = (rows: { amount: number }[] | null) =>
        (rows ?? []).reduce((a, r) => a + (r.amount ?? 0), 0);

      const bets = (txAll.data ?? []).filter((t) => t.type === 'bet').length;
      const payouts = (txAll.data ?? []).filter((t) => t.type === 'payout').length;

      const jp = (jackpots.data ?? []);
      const getJP = (name: string) => jp.find((j) => j.name?.toLowerCase().includes(name))?.current_amount ?? 0;

      setMetrics({
        revenueToday: sum(txToday.data),
        revenueWeek: sum(txWeek.data),
        revenueMonth: sum(txMonth.data),
        totalBets: bets,
        totalPayouts: payouts,
        currentRTP: (rtpCfg.data?.target_rtp ?? 0.965) * 100,
        activePlayers: players.count ?? 0,
        liveTables: tables.count ?? 0,
        jackpotMega: getJP('mega'),
        jackpotDaily: getJP('daily'),
        jackpotHourly: getJP('hourly'),
      });
    } catch (err) {
      console.error('[DashboardPage]', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMetrics();
    const id = setInterval(fetchMetrics, 10000);
    return () => clearInterval(id);
  }, []);

  const fmt = (n: number) => `KES ${n.toLocaleString()}`;

  return (
    <div className="flex flex-col gap-6">
      {loading || !metrics ? (
        <LoadingSkeleton rows={8} />
      ) : (
        <>
          {/* Metrics grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Revenue Today" value={fmt(metrics.revenueToday)} icon="💰" color="yellow" />
            <StatCard title="Revenue This Week" value={fmt(metrics.revenueWeek)} icon="📅" color="yellow" />
            <StatCard title="Revenue This Month" value={fmt(metrics.revenueMonth)} icon="📆" color="green" />
            <StatCard title="Bets / Payouts" value={`${metrics.totalBets} / ${metrics.totalPayouts}`} icon="🎲" color="purple" />
            <StatCard title="Current RTP" value={`${metrics.currentRTP.toFixed(1)}%`} icon="📊" color="cyan" />
            <StatCard title="Active Players" value={metrics.activePlayers} icon="👥" color="green" />
            <StatCard title="Live Tables" value={metrics.liveTables} icon="🎰" color="purple" />
            <StatCard title="Jackpot Mega" value={fmt(metrics.jackpotMega)} subtitle={`Daily: ${fmt(metrics.jackpotDaily)} · Hourly: ${fmt(metrics.jackpotHourly)}`} icon="🏆" color="yellow" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-white/60 text-xs uppercase tracking-widest mb-4">RTP Trend (24h)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={rtpTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="hour" tick={{ fill: '#ffffff40', fontSize: 10 }} />
                  <YAxis domain={[94, 99]} tick={{ fill: '#ffffff40', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#111118', border: '1px solid #ffffff20', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="rtp" stroke="#FFD700" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-white/60 text-xs uppercase tracking-widest mb-4">Revenue Trend (7 days)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="day" tick={{ fill: '#ffffff40', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#111118', border: '1px solid #ffffff20', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="revenue" stroke="#FFD700" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-white/60 text-xs uppercase tracking-widest mb-4">Game Distribution</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={gameDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                    {gameDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ color: '#ffffff80', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#111118', border: '1px solid #ffffff20', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="text-white/60 text-xs uppercase tracking-widest mb-4">Active Alerts</h3>
            <AlertsPanel alerts={alerts} onDismiss={dismissAlert} />
          </div>
        </>
      )}
    </div>
  );
}
