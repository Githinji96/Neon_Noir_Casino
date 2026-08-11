import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAdminStore } from '../../store/adminStore';
import StatCard from '../../components/admin/StatCard';
import AlertsPanel from '../../components/admin/AlertsPanel';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';

interface Metrics {
  ggrToday: number;
  ggrWeek: number;
  ggrMonth: number;
  depositsToday: number;
  depositsWeek: number;
  depositsMonth: number;
  totalSpinsToday: number;
  totalSpinsMonth: number;
  totalBetsMonth: number;
  totalPayoutsMonth: number;
  rtpMonth: number;
  activePlayers: number;
  liveTables: number;
  jackpotMega: number;
}

interface CasinoFunds {
  total_deposited:    number;
  total_withdrawn:    number;
  net_cash_flow:      number;
  player_funds:       number;
  ggr:                number;
  pending_deposits:   number;
  pending_withdrawals:number;
  jackpot_pool:       number;
}

type Period = 'today' | 'week' | 'month';

function startOf(period: Period): string {
  // Use EAT (UTC+3) timezone explicitly
  const now = new Date();
  const eatOffset = 3 * 60; // EAT is UTC+3
  const localNow = new Date(now.getTime() + (eatOffset - (-now.getTimezoneOffset())) * 60000);

  if (period === 'today') {
    localNow.setHours(0, 0, 0, 0);
    return new Date(localNow.getTime() - (eatOffset * 60000)).toISOString();
  } else if (period === 'week') {
    const day = localNow.getDay();
    const diff = day === 0 ? 6 : day - 1;
    localNow.setDate(localNow.getDate() - diff);
    localNow.setHours(0, 0, 0, 0);
    return new Date(localNow.getTime() - (eatOffset * 60000)).toISOString();
  } else {
    localNow.setDate(localNow.getDate() - 30);
    localNow.setHours(0, 0, 0, 0);
    return new Date(localNow.getTime() - (eatOffset * 60000)).toISOString();
  }
}

const PIE_COLORS = ['#FFD700', '#A855F7', '#00FFFF'];

const gameDist = [
  { name: 'Slots', value: 60 },
  { name: 'Live Tables', value: 25 },
  { name: 'Jackpots', value: 15 },
];

export default function DashboardPage() {
  const { alerts, dismissAlert } = useAdminStore();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [casinoFunds, setCasinoFunds] = useState<CasinoFunds | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('today');
  const [revenueTrend, setRevenueTrend] = useState<{ day: string; ggr: number; deposits: number }[]>([]);

  async function fetchMetrics() {
    try {
      const ts = startOf('today');
      const ws = startOf('week');
      const ms = startOf('month');
      if (import.meta.env.DEV) console.log('[Dashboard] timestamps:', { today: ts, week: ws, month: ms });

      // Use RPC function to aggregate on DB side — avoids row limit issues
      // Pass timestamps from client to avoid UTC/timezone mismatch
      const [ggrResult, depositsResult, players, tables, jackpots] = await Promise.all([
        supabase.rpc('get_ggr_summary', {
          today_start: ts,
          week_start: ws,
          month_start: ms,
        }),
        Promise.all([
          supabase.from('transactions').select('amount').eq('status', 'success').eq('type', 'deposit').gte('created_at', startOf('today')).limit(10000),
          supabase.from('transactions').select('amount').eq('status', 'success').eq('type', 'deposit').gte('created_at', startOf('week')).limit(10000),
          supabase.from('transactions').select('amount').eq('status', 'success').eq('type', 'deposit').gte('created_at', startOf('month')).limit(10000),
        ]),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('live_tables').select('id', { count: 'exact', head: true }).in('status', ['live', 'active']),
        supabase.from('jackpots').select('name, current_amount'),
      ]);

      const sumAmount = (rows: { amount: number }[] | null) =>
        (rows ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);

      const ggr = ggrResult.data?.[0] ?? {
        ggr_today: 0, ggr_week: 0, ggr_month: 0,
        total_bets_month: 0, total_payouts_month: 0,
        spins_today: 0, spins_month: 0,
      };
      if (import.meta.env.DEV) console.log('[Dashboard] ggrResult:', ggrResult.error, ggr);

      const [depToday, depWeek, depMonth] = depositsResult;
      const jp = jackpots.data ?? [];
      const megaJP = jp.find((j: { name: string }) => j.name?.toLowerCase().includes('mega'))?.current_amount ?? 0;

      setMetrics({
        ggrToday:         Number(ggr.ggr_today),
        ggrWeek:          Number(ggr.ggr_week),
        ggrMonth:         Number(ggr.ggr_month),
        depositsToday:    sumAmount(depToday.data),
        depositsWeek:     sumAmount(depWeek.data),
        depositsMonth:    sumAmount(depMonth.data),
        totalSpinsToday:  Number(ggr.spins_today),
        totalSpinsMonth:  Number(ggr.spins_month),
        totalBetsMonth:   Number(ggr.total_bets_month),
        totalPayoutsMonth: Number(ggr.total_payouts_month),
        rtpMonth: Number(ggr.total_bets_month) > 0
          ? Math.round((Number(ggr.total_payouts_month) / Number(ggr.total_bets_month)) * 1000) / 10
          : 0,
        activePlayers:    players.count ?? 0,
        liveTables:       tables.count ?? 0,
        jackpotMega:      megaJP,
      });

      // Casino-level financial snapshot (all-time)
      const fundsRes = await supabase.rpc('get_casino_financial_summary', {
        p_start: null,
        p_end:   null,
      });
      if (fundsRes.error) {
        console.warn('[Dashboard] get_casino_financial_summary error (RPC may not be deployed yet):', fundsRes.error.message);
        // Show zeros so the section renders — admin can see it needs DB migration
        setCasinoFunds({
          total_deposited: 0, total_withdrawn: 0, net_cash_flow: 0,
          player_funds: 0, ggr: 0, pending_deposits: 0,
          pending_withdrawals: 0, jackpot_pool: 0,
        });
      } else if (fundsRes.data) {
        const f = fundsRes.data as Record<string, number>;
        setCasinoFunds({
          total_deposited:     Number(f.total_deposited)     || 0,
          total_withdrawn:     Number(f.total_withdrawn)     || 0,
          net_cash_flow:       Number(f.net_cash_flow)       || 0,
          player_funds:        Number(f.player_funds)        || 0,
          ggr:                 Number(f.ggr)                 || 0,
          pending_deposits:    Number(f.pending_deposits)    || 0,
          pending_withdrawals: Number(f.pending_withdrawals) || 0,
          jackpot_pool:        Number(f.jackpot_pool)        || 0,
        });
      }

      // Build 7-day trend using a single DB call instead of 14 parallel queries
      const trendStart = new Date();
      trendStart.setDate(trendStart.getDate() - 6);
      trendStart.setHours(0, 0, 0, 0);

      const [trendSpins, trendDeps] = await Promise.all([
        supabase.from('spins').select('bet, payout, created_at')
          .gte('created_at', trendStart.toISOString()).limit(50000),
        supabase.from('transactions').select('amount, created_at')
          .eq('status', 'success').neq('type', 'withdrawal')
          .gte('created_at', trendStart.toISOString()).limit(10000),
      ]);

      // Aggregate client-side by day
      const dayMap: Record<string, { ggr: number; deposits: number }> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(trendStart);
        d.setDate(trendStart.getDate() + i);
        const key = d.toLocaleDateString('en', { weekday: 'short' });
        dayMap[key] = { ggr: 0, deposits: 0 };
      }

      (trendSpins.data ?? []).forEach((r) => {
        const key = new Date(r.created_at).toLocaleDateString('en', { weekday: 'short' });
        if (dayMap[key]) dayMap[key].ggr += (r.bet ?? 0) - (r.payout ?? 0);
      });
      (trendDeps.data ?? []).forEach((r) => {
        const key = new Date(r.created_at).toLocaleDateString('en', { weekday: 'short' });
        if (dayMap[key]) dayMap[key].deposits += r.amount ?? 0;
      });

      const trend = Object.entries(dayMap).map(([day, v]) => ({
        day,
        ggr: Math.max(0, Math.round(v.ggr)),
        deposits: Math.round(v.deposits),
      }));
      setRevenueTrend(trend);
    } catch (err) {
      console.error('[DashboardPage]', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMetrics();
    // Poll every 60s — was 10s which was creating a query storm on free-tier Supabase
    const pollId = setInterval(fetchMetrics, 60_000);

    // Realtime: only watch transactions (not spins — too frequent during gameplay)
    const channel = supabase
      .channel('admin_dashboard_watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        fetchMetrics();
      })
      .subscribe();

    return () => {
      clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, []);

  const fmt = (n: number) => `KES ${Math.round(n).toLocaleString()}`;

  const periodData = metrics ? {
    today: { ggr: metrics.ggrToday, deposits: metrics.depositsToday, spins: metrics.totalSpinsToday },
    week:  { ggr: metrics.ggrWeek,  deposits: metrics.depositsWeek,  spins: 0 },
    month: { ggr: metrics.ggrMonth, deposits: metrics.depositsMonth, spins: 0 },
  }[period] : null;

  return (
    <div className="flex flex-col gap-6">
      {loading || !metrics ? (
        <LoadingSkeleton rows={8} />
      ) : (
        <>
          {/* ── Revenue Period Panel ── */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white/60 text-xs uppercase tracking-widest">Revenue</h3>
              <div className="flex gap-1">
                {(['today', 'week', 'month'] as Period[]).map((p) => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-3 py-1 rounded-lg text-xs font-orbitron tracking-wider capitalize transition-colors ${
                      period === p ? 'bg-[#FFD700] text-black' : 'bg-white/5 text-white/50 hover:bg-white/10'
                    }`}>
                    {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'Last 30 Days'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.2)' }}>
                <p className="text-white/40 text-xs font-orbitron tracking-widest mb-1">GGR (Net Revenue)</p>
                <p className={`font-orbitron text-2xl font-black ${(periodData?.ggr ?? 0) >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {(periodData?.ggr ?? 0) < 0 ? '-' : ''}KES {Math.abs(periodData?.ggr ?? 0).toLocaleString()}
                </p>
                <p className="text-white/20 text-xs mt-1">Bets − Payouts</p>
              </div>
              <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.15)' }}>
                <p className="text-white/40 text-xs font-orbitron tracking-widest mb-1">Deposits (M-Pesa)</p>
                <p className="font-orbitron text-2xl font-black text-green-400">{fmt(periodData?.deposits ?? 0)}</p>
                <p className="text-white/20 text-xs mt-1">Successful inflows</p>
              </div>
              <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)' }}>
                <p className="text-white/40 text-xs font-orbitron tracking-widest mb-1">
                  {period === 'today' ? 'Spins Today' : period === 'month' ? 'RTP %' : 'Active Players'}
                </p>
                <p className="font-orbitron text-2xl font-black text-purple-400">
                  {period === 'today'
                    ? (periodData?.spins ?? 0).toLocaleString()
                    : period === 'month'
                    ? `${metrics.rtpMonth}%`
                    : metrics.activePlayers.toLocaleString()}
                </p>
                <p className="text-white/20 text-xs mt-1">
                  {period === 'today' ? 'Total spins' : period === 'month' ? `${metrics.totalSpinsMonth.toLocaleString()} spins` : 'Registered users'}
                </p>
              </div>
            </div>

            {/* Monthly breakdown row */}
            {period === 'month' && (
              <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-white/10">
                <div className="text-center">
                  <p className="text-white/30 text-xs font-orbitron">Total Bets</p>
                  <p className="font-orbitron font-bold text-white">{fmt(metrics.totalBetsMonth)}</p>
                </div>
                <div className="text-center">
                  <p className="text-white/30 text-xs font-orbitron">Total Payouts</p>
                  <p className="font-orbitron font-bold text-red-400">{fmt(metrics.totalPayoutsMonth)}</p>
                </div>
                <div className="text-center">
                  <p className="text-white/30 text-xs font-orbitron">House Edge</p>
                  <p className="font-orbitron font-bold text-yellow-400">
                    {metrics.rtpMonth > 0 ? `${(100 - metrics.rtpMonth).toFixed(1)}%` : '—'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="GGR Today"      value={`${metrics.ggrToday < 0 ? '-' : ''}KES ${Math.abs(Math.round(metrics.ggrToday)).toLocaleString()}`}     icon="💰" color={metrics.ggrToday >= 0 ? 'yellow' : 'red'} />
            <StatCard title="GGR This Week"   value={`${metrics.ggrWeek < 0 ? '-' : ''}KES ${Math.abs(Math.round(metrics.ggrWeek)).toLocaleString()}`}      icon="📅" color={metrics.ggrWeek >= 0 ? 'yellow' : 'red'} />
            <StatCard title="GGR Last 30 Days" value={`${metrics.ggrMonth < 0 ? '-' : ''}KES ${Math.abs(Math.round(metrics.ggrMonth)).toLocaleString()}`}     icon="📆" color={metrics.ggrMonth >= 0 ? 'green' : 'red'} />
            <StatCard title="Mega Jackpot"   value={fmt(metrics.jackpotMega)}  icon="🏆" color="yellow" />
            <StatCard title="Deposits Today" value={fmt(metrics.depositsToday)} icon="📲" color="green" />
            <StatCard title="Spins Today"    value={metrics.totalSpinsToday}   icon="🎰" color="purple" />
            <StatCard title="Active Players" value={metrics.activePlayers}     icon="👥" color="cyan" />
            <StatCard title="Live Tables"    value={metrics.liveTables}        icon="📡" color="purple" />
          </div>

          {/* ── Casino Financial Overview ── */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white/60 text-xs uppercase tracking-widest font-orbitron">Casino Financial Position (All-Time)</h3>
                <p className="text-white/30 text-xs mt-0.5">Live figures — calculated from transaction and spin records</p>
              </div>
              <Link to="/admin/casino-financial"
                className="px-3 py-1.5 rounded-lg bg-[#FFD700]/20 hover:bg-[#FFD700]/30 text-[#FFD700] text-xs font-orbitron transition-colors">
                Full Report →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Total Deposited"  value={`KES ${Math.round(casinoFunds?.total_deposited ?? 0).toLocaleString()}`}  icon="📲" color="green"  subtitle="All successful deposits" />
              <StatCard title="Total Withdrawn"  value={`KES ${Math.round(casinoFunds?.total_withdrawn ?? 0).toLocaleString()}`}  icon="💸" color="red"    subtitle="All successful withdrawals" />
              <StatCard title="Player Funds"     value={`KES ${Math.round(casinoFunds?.player_funds ?? 0).toLocaleString()}`}     icon="👥" color="purple" subtitle="Sum of player balances" />
              <StatCard title="All-Time GGR"
                value={`${(casinoFunds?.ggr ?? 0) < 0 ? '-' : ''}KES ${Math.abs(Math.round(casinoFunds?.ggr ?? 0)).toLocaleString()}`}
                icon="💰" color={(casinoFunds?.ggr ?? 0) >= 0 ? 'yellow' : 'red'}
                subtitle="Total wagered − won" />
              <StatCard title="Net Cash Flow"
                value={`${(casinoFunds?.net_cash_flow ?? 0) < 0 ? '-' : ''}KES ${Math.abs(Math.round(casinoFunds?.net_cash_flow ?? 0)).toLocaleString()}`}
                icon="🔄" color={(casinoFunds?.net_cash_flow ?? 0) >= 0 ? 'cyan' : 'red'}
                subtitle="Deposits − Withdrawals" />
              <StatCard title="Pending Deposits"    value={`KES ${Math.round(casinoFunds?.pending_deposits ?? 0).toLocaleString()}`}    icon="⏳" color="yellow" subtitle="Awaiting M-Pesa" />
              <StatCard title="Pending Withdrawals" value={`KES ${Math.round(casinoFunds?.pending_withdrawals ?? 0).toLocaleString()}`} icon="⌛" color="yellow" subtitle="Awaiting processing" />
              <StatCard title="Jackpot Pool"        value={`KES ${Math.round(casinoFunds?.jackpot_pool ?? 0).toLocaleString()}`}        icon="🎯" color="yellow" subtitle="Live jackpot totals" />
            </div>
          </div>

          {/* ── Charts ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-white/60 text-xs uppercase tracking-widest mb-4">GGR vs Deposits (7 days)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="day" tick={{ fill: '#ffffff40', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#111118', border: '1px solid #ffffff20', borderRadius: 8 }} />
                  <Bar dataKey="ggr" name="GGR" fill="#FFD700" radius={[4,4,0,0]} />
                  <Bar dataKey="deposits" name="Deposits" fill="#00ff88" radius={[4,4,0,0]} />
                </BarChart>
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

          {/* ── Alerts ── */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="text-white/60 text-xs uppercase tracking-widest mb-4">Active Alerts</h3>
            <AlertsPanel alerts={alerts} onDismiss={dismissAlert} />
          </div>
        </>
      )}
    </div>
  );
}

