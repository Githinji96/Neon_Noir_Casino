import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import StatCard from '../../components/admin/StatCard';
import DataTable, { Column } from '../../components/admin/DataTable';
import { GAME_LISTINGS } from '../../config/mockData';
import { JACKPOT_CONFIGS } from '../../logic/jackpot/jackpotConfig';
import { GAME_CONFIG } from '../../config/gameConfig';
import { MIN_BET, MAX_BET } from '../../config/betLadder';
import { supabase } from '../../lib/supabase';

type Tab = 'revenue' | 'rtp' | 'players' | 'games';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayRevenue {
  day: string;
  deposits: number;
  withdrawals: number;
  ggr: number;
}

interface DayReg {
  day: string;
  registrations: number;
}

interface GameStat {
  game: string;
  game_id: string;
  total_payouts: number;
  rtp: number;
  volatility: string;
  players: number;
}

interface JackpotRow {
  name: string;
  type: string;
  current_amount: number;
  contribution: string;
  triggerProb: string;
  cooldown: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function groupByDay<T extends { created_at: string }>(
  rows: T[],
  getValue: (r: T) => number
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of rows) {
    const day = fmtDay(r.created_at);
    map[day] = (map[day] ?? 0) + getValue(r);
  }
  return map;
}

function buildDayRange(days: number): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return fmtDay(d.toISOString());
  });
}

function downloadCSV(headers: string[], rows: string[][]) {
  const content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'analytics.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ─── Columns ──────────────────────────────────────────────────────────────────

const gameColumns: Column<GameStat>[] = [
  { key: 'game', label: 'Game', sortable: true },
  { key: 'volatility', label: 'Volatility', sortable: true, render: (r) => (
    <span className={r.volatility === 'High' ? 'text-red-400' : r.volatility === 'Medium' ? 'text-yellow-400' : 'text-green-400'}>
      {r.volatility}
    </span>
  )},
  { key: 'total_payouts', label: 'Total Payouts', sortable: true, render: (r) => (
    <span className="font-mono">KES {r.total_payouts.toLocaleString()}</span>
  )},
  { key: 'rtp', label: 'Actual RTP %', sortable: true, render: (r) => (
    <span className={r.rtp >= 96 ? 'text-[#FFD700]' : 'text-orange-400'}>{r.rtp}%</span>
  )},
  { key: 'players', label: 'Win Entries', sortable: true },
];

const jackpotColumns: Column<JackpotRow>[] = [
  { key: 'name', label: 'Jackpot', sortable: true },
  { key: 'type', label: 'Type', sortable: true, render: (r) => <span className="capitalize">{r.type}</span> },
  { key: 'current_amount', label: 'Current Pool', sortable: true, render: (r) => (
    <span className="font-mono text-[#FFD700]">KES {r.current_amount.toLocaleString()}</span>
  )},
  { key: 'contribution', label: 'Contribution Rate', sortable: false },
  { key: 'triggerProb', label: 'Trigger Probability', sortable: false },
  { key: 'cooldown', label: 'Cooldown', sortable: false },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('revenue');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  // Raw data from Supabase
  const [transactions, setTransactions] = useState<{ amount: number; status: string; created_at: string }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; updated_at: string }[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ win_amount: number; game_title: string; created_at: string }[]>([]);
  const [jackpots, setJackpots] = useState<{ id: string; name: string; type: string; current_amount: number }[]>([]);
  const [spins, setSpins] = useState<{ bet: number; payout: number; game_id: string; created_at: string }[]>([]);

  const days = useMemo(() => {
    if (startDate && endDate) {
      const diff = (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000;
      return Math.max(1, Math.min(90, Math.round(diff) + 1));
    }
    return 30;
  }, [startDate, endDate]);

  const sinceDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1));
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [days]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [txRes, profRes, lbRes, jpRes, spinsRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('amount, status, created_at')
          .gte('created_at', sinceDate)
          .order('created_at', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, updated_at')
          .gte('updated_at', sinceDate),
        supabase
          .from('leaderboard')
          .select('win_amount, game_title, created_at')
          .gte('created_at', sinceDate)
          .order('created_at', { ascending: true }),
        supabase
          .from('jackpots')
          .select('id, name, type, current_amount'),
        supabase
          .from('spins')
          .select('bet, payout, game_id, created_at')
          .gte('created_at', sinceDate)
          .order('created_at', { ascending: true }),
      ]);

      setTransactions(txRes.data ?? []);
      setProfiles(profRes.data ?? []);
      setLeaderboard(lbRes.data ?? []);
      setJackpots(jpRes.data ?? []);
      setSpins(spinsRes.data ?? []);
    } catch (err) {
      console.error('[AnalyticsPage.fetchData]', err);
    } finally {
      setLoading(false);
    }
  }, [sinceDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Revenue data ───────────────────────────────────────────────────────────
  const revenueData: DayRevenue[] = useMemo(() => {
    const dayRange = buildDayRange(days);
    const deposits = groupByDay(
      transactions.filter((t) => t.status === 'success'),
      (t) => t.amount
    );
    const handle = groupByDay(spins, (s) => s.bet);
    const payouts = groupByDay(spins, (s) => s.payout);
    return dayRange.map((day) => ({
      day,
      deposits: deposits[day] ?? 0,
      withdrawals: 0,
      // Real GGR = total bets - total payouts for that day
      ggr: Math.max(0, Math.round(((handle[day] ?? 0) - (payouts[day] ?? 0)) * 100) / 100),
    }));
  }, [transactions, spins, days]);

  const totalDeposits = revenueData.reduce((a, r) => a + r.deposits, 0);
  const totalHandle = spins.reduce((a, s) => a + s.bet, 0);
  const totalSpinPayouts = spins.reduce((a, s) => a + s.payout, 0);
  const totalGGR = Math.max(0, Math.round((totalHandle - totalSpinPayouts) * 100) / 100);
  const totalPayouts = leaderboard.reduce((a, r) => a + r.win_amount, 0);

  // ─── RTP data — real: total_payout / total_bet per day ─────────────────────
  const rtpData = useMemo(() => {
    const dayRange = buildDayRange(days);
    const handleByDay = groupByDay(spins, (s) => s.bet);
    const payoutsByDay = groupByDay(spins, (s) => s.payout);
    return dayRange.map((day) => {
      const h = handleByDay[day] ?? 0;
      const p = payoutsByDay[day] ?? 0;
      const rtp = h > 0 ? +((p / h) * 100).toFixed(2) : +(GAME_CONFIG.targetRTP * 100).toFixed(1);
      return { day, rtp, target: +(GAME_CONFIG.targetRTP * 100).toFixed(1) };
    });
  }, [spins, days]);

  const rtpValues = rtpData.map((r) => r.rtp);
  const avgRTP = (rtpValues.reduce((a, v) => a + v, 0) / rtpValues.length).toFixed(2);
  const minRTP = Math.min(...rtpValues).toFixed(2);
  const maxRTP = Math.max(...rtpValues).toFixed(2);
  const maxDev = (parseFloat(maxRTP) - parseFloat(minRTP)).toFixed(2);

  // ─── Registration data ──────────────────────────────────────────────────────
  const regData: DayReg[] = useMemo(() => {
    const dayRange = buildDayRange(days);
    const regsByDay = groupByDay(profiles, () => 1);
    return dayRange.map((day) => ({ day, registrations: regsByDay[day] ?? 0 }));
  }, [profiles, days]);

  const totalRegs = regData.reduce((a, r) => a + r.registrations, 0);

  // ─── Per-game stats from spins table (real) + leaderboard fallback ─────────
  const gameStats: GameStat[] = useMemo(() => {
    const byGame: Record<string, { bets: number; payouts: number; entries: number }> = {};
    for (const s of spins) {
      if (!byGame[s.game_id]) byGame[s.game_id] = { bets: 0, payouts: 0, entries: 0 };
      byGame[s.game_id].bets += s.bet;
      byGame[s.game_id].payouts += s.payout;
      byGame[s.game_id].entries += 1;
    }
    return GAME_LISTINGS.map((g) => {
      const stats = byGame[g.id] ?? { bets: 0, payouts: 0, entries: 0 };
      const realRTP = stats.bets > 0
        ? +((stats.payouts / stats.bets) * 100).toFixed(1)
        : g.rtp;
      return {
        game: g.title,
        game_id: g.id,
        total_payouts: Math.round(stats.payouts),
        rtp: realRTP,
        volatility: g.volatility,
        players: stats.entries,
      };
    });
  }, [spins]);

  // ─── Jackpot summary — real current_amount from DB ─────────────────────────
  const jackpotSummary: JackpotRow[] = useMemo(() => {
    return JACKPOT_CONFIGS.map((cfg) => {
      const live = jackpots.find((j) => j.id === cfg.id);
      return {
        name: cfg.name,
        type: cfg.type,
        current_amount: live?.current_amount ?? cfg.baseAmount,
        contribution: `${(cfg.contributionRate * 100).toFixed(1)}%`,
        triggerProb: `1 in ${Math.round(1 / cfg.baseProbability).toLocaleString()}`,
        cooldown: cfg.cooldownMs >= 3600000
          ? `${cfg.cooldownMs / 3600000}h`
          : `${cfg.cooldownMs / 60000}min`,
      };
    });
  }, [jackpots]);

  const chartStyle = { background: '#111118', border: '1px solid #ffffff20', borderRadius: 8 };
  const tabs: { id: Tab; label: string }[] = [
    { id: 'revenue', label: 'Revenue' },
    { id: 'rtp', label: 'RTP' },
    { id: 'players', label: 'Players' },
    { id: 'games', label: 'Games' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-white/40 text-xs uppercase tracking-widest">From</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/50" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-white/40 text-xs uppercase tracking-widest">To</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/50" />
        </div>
        <div className="flex gap-2 items-end pb-0.5">
          <button onClick={fetchData}
            className="px-4 py-2 rounded-lg bg-[#FFD700]/20 hover:bg-[#FFD700]/30 text-[#FFD700] text-sm font-semibold transition-colors">
            Refresh
          </button>
          {loading && <span className="text-white/30 text-xs self-center">Loading...</span>}
        </div>
        <div className="flex flex-col gap-1 text-white/30 text-xs self-end pb-2.5 ml-auto">
          Bet range: KES {MIN_BET} – KES {MAX_BET} &nbsp;|&nbsp; Target RTP: {(GAME_CONFIG.targetRTP * 100).toFixed(1)}%
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === t.id ? 'bg-[#FFD700] text-black' : 'text-white/50 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Revenue tab */}
      {tab === 'revenue' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Handle (Bets)" value={`KES ${Math.round(totalHandle).toLocaleString()}`} color="cyan" />
            <StatCard title="Real GGR (Bets − Payouts)" value={`KES ${totalGGR.toLocaleString()}`} color="yellow" />
            <StatCard title="Total Deposits (M-Pesa)" value={`KES ${totalDeposits.toLocaleString()}`} color="green" />
            <StatCard title="Total Spin Payouts" value={`KES ${Math.round(totalSpinPayouts).toLocaleString()}`} color="purple" />
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white/60 text-xs uppercase tracking-widest">GGR Over Time (Real)</h3>
                <p className="text-white/30 text-xs mt-0.5">Source: spins table — actual bets minus payouts per day</p>
              </div>
              <button onClick={() => downloadCSV(
                ['Day', 'Deposits (KES)', 'Real GGR (KES)'],
                revenueData.map((r) => [r.day, String(r.deposits), String(r.ggr)])
              )} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs transition-colors">
                Export CSV
              </button>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="day" tick={{ fill: '#ffffff40', fontSize: 10 }} />
                <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} />
                <Tooltip contentStyle={chartStyle} />
                <Line type="monotone" dataKey="deposits" stroke="#22C55E" strokeWidth={2} dot={false} name="Deposits (KES)" />
                <Line type="monotone" dataKey="ggr" stroke="#FFD700" strokeWidth={1.5} dot={false} name="Est. GGR (KES)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {totalDeposits === 0 && !loading && (
            <p className="text-white/30 text-xs text-center">
              No successful M-Pesa transactions in this period. Data will appear once players make deposits.
            </p>
          )}
        </div>
      )}

      {/* RTP tab */}
      {tab === 'rtp' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Avg RTP (period)" value={`${avgRTP}%`} color="yellow" />
            <StatCard title="Target RTP" value={`${(GAME_CONFIG.targetRTP * 100).toFixed(1)}%`} color="cyan" />
            <StatCard title="Min RTP (period)" value={`${minRTP}%`} color="red" />
            <StatCard title="Max Deviation" value={`${maxDev}%`} color={parseFloat(maxDev) > 5 ? 'red' : 'green'} />
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white/60 text-xs uppercase tracking-widest">RTP Over Time</h3>
                <p className="text-white/30 text-xs mt-0.5">
                  Derived from leaderboard wins ÷ estimated handle · Target {(GAME_CONFIG.targetRTP * 100).toFixed(1)}%
                </p>
              </div>
              <button onClick={() => downloadCSV(['Day', 'RTP %', 'Target %'], rtpData.map((r) => [r.day, String(r.rtp), String(r.target)]))}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs transition-colors">
                Export CSV
              </button>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={rtpData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="day" tick={{ fill: '#ffffff40', fontSize: 10 }} />
                <YAxis domain={[80, 100]} tick={{ fill: '#ffffff40', fontSize: 10 }} />
                <Tooltip contentStyle={chartStyle} />
                <Line type="monotone" dataKey="rtp" stroke="#FFD700" strokeWidth={2} dot={false} name="Actual RTP %" />
                <Line type="monotone" dataKey="target" stroke="#ffffff30" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Target RTP %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Players tab */}
      {tab === 'players' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Active Profiles (period)" value={totalRegs} color="green" />
            <StatCard title="Leaderboard Entries" value={leaderboard.length} color="yellow" />
            <StatCard title="Avg Bet Size" value="KES 10" color="cyan" />
            <StatCard title="Bet Range" value={`KES ${MIN_BET} – ${MAX_BET}`} color="purple" />
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white/60 text-xs uppercase tracking-widest">Active Profiles Per Day</h3>
                <p className="text-white/30 text-xs mt-0.5">Source: profiles.updated_at (activity proxy)</p>
              </div>
              <button onClick={() => downloadCSV(['Day', 'Active Profiles'], regData.map((r) => [r.day, String(r.registrations)]))}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs transition-colors">
                Export CSV
              </button>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={regData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="day" tick={{ fill: '#ffffff40', fontSize: 10 }} />
                <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} />
                <Tooltip contentStyle={chartStyle} />
                <Bar dataKey="registrations" fill="#A855F7" radius={[4, 4, 0, 0]} name="Active Profiles" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Games tab */}
      {tab === 'games' && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white/60 text-xs uppercase tracking-widest">Game Payouts — Leaderboard</h3>
                <p className="text-white/30 text-xs mt-0.5">Source: leaderboard table win amounts</p>
              </div>
              <button onClick={() => downloadCSV(
                ['Game', 'Volatility', 'Total Payouts (KES)', 'Config RTP %', 'Win Entries'],
                gameStats.map((r) => [r.game, r.volatility, String(r.total_payouts), String(r.rtp), String(r.players)])
              )} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs transition-colors">
                Export CSV
              </button>
            </div>
            <DataTable<GameStat> columns={gameColumns} data={gameStats} emptyMessage="No leaderboard data yet." />
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-white/60 text-xs uppercase tracking-widest">Jackpot Pools — Live</h3>
              <p className="text-white/30 text-xs mt-0.5">Source: jackpots table current_amount</p>
            </div>
            <DataTable<JackpotRow> columns={jackpotColumns} data={jackpotSummary} emptyMessage="No jackpot data." />
          </div>
        </div>
      )}
    </div>
  );
}
