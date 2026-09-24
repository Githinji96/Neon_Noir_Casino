import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { supabase } from '../../lib/supabase';
import StatCard from '../../components/admin/StatCard';
import DataTable, { Column } from '../../components/admin/DataTable';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';
import { GAME_LISTINGS } from '../../config/mockData';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FinancialSummary {
  total_deposited:     number;
  total_withdrawn:     number;
  net_cash_flow:       number;
  admin_credits_paid:  number;
  admin_debits_taken:  number;
  total_wagered:       number;
  total_won:           number;
  ggr:                 number;
  player_funds:        number;
  casino_balance:      number;
  opening_balance:     number;
  pending_deposits:    number;
  pending_withdrawals: number;
  jackpot_pool:        number;
  jackpot_paid:        number;
  jackpot_wins_count:  number;
  jackpot_largest:     number;
}

interface GameStat {
  game_id:       string;
  game_name:     string;
  total_bets:    number;
  total_payouts: number;
  ggr:           number;
  spin_count:    number;
  avg_bet:       number;
}

interface FlowPoint {
  bucket:      string;
  deposits:    number;
  withdrawals: number;
  admin_out:   number;
  admin_in:    number;
  wagered:     number;
  won:         number;
  ggr:         number;
}

type Preset = 'today' | 'week' | 'month' | 'last30' | 'custom';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function presetRange(preset: Preset): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);  // always end-of-day, not current time

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (preset === 'today') {
    return { start, end };
  }
  if (preset === 'week') {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    return { start, end };
  }
  if (preset === 'month') {
    start.setDate(1);
    return { start, end };
  }
  // last30
  start.setDate(start.getDate() - 29);
  return { start, end };
}

function fmt(n: number): string {
  return `KES ${Math.round(n).toLocaleString()}`;
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  try {
    // Strip time portion and parse as local date to avoid UTC-offset day shifts
    const datePart = iso.split('T')[0];
    const parts = datePart.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return datePart || '—';
    const [year, month, day] = parts;
    const d = new Date(year, month - 1, day);
    if (isNaN(d.getTime())) return datePart;
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

// ─── Columns ──────────────────────────────────────────────────────────────────

const gameColumns: Column<GameStat>[] = [
  { key: 'game_name',     label: 'Game',           sortable: true },
  { key: 'spin_count',    label: 'Spins',          sortable: true, render: (r) => r.spin_count.toLocaleString() },
  { key: 'avg_bet',       label: 'Avg Bet',        sortable: true, render: (r) => `KES ${r.avg_bet.toLocaleString()}` },
  { key: 'total_bets',    label: 'Total Wagered',  sortable: true, render: (r) => <span className="font-mono text-white/80">{fmt(r.total_bets)}</span> },
  { key: 'total_payouts', label: 'Total Wins',     sortable: true, render: (r) => <span className="font-mono text-green-400">{fmt(r.total_payouts)}</span> },
  { key: 'ggr',           label: 'GGR',            sortable: true, render: (r) => (
    <span className={`font-mono font-bold ${r.ggr >= 0 ? 'text-[#FFD700]' : 'text-red-400'}`}>{fmt(r.ggr)}</span>
  )},
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CasinoFinancialPage() {
  const [preset, setPreset]           = useState<Preset>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd,   setCustomEnd]   = useState('');
  const [loading, setLoading]         = useState(true);
  const [summary, setSummary]         = useState<FinancialSummary | null>(null);
  const [gameStats, setGameStats]     = useState<GameStat[]>([]);
  const [flowSeries, setFlowSeries]   = useState<FlowPoint[]>([]);
  const [chartLine, setChartLine]     = useState<'bar' | 'line'>('bar');

  // ── Derived date range as stable ISO strings ──────────────────────────────
  const { rangeStartIso, rangeEndIso } = useMemo(() => {
    if (preset === 'custom') {
      // Only proceed when both dates look like valid YYYY-MM-DD strings
      const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
      if (!validDate(customStart) || !validDate(customEnd)) {
        return { rangeStartIso: null, rangeEndIso: null };
      }
      return {
        rangeStartIso: new Date(customStart + 'T00:00:00').toISOString(),
        rangeEndIso:   new Date(customEnd   + 'T23:59:59').toISOString(),
      };
    }
    const { start, end } = presetRange(preset);
    return { rangeStartIso: start.toISOString(), rangeEndIso: end.toISOString() };
  }, [preset, customStart, customEnd]);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (preset === 'custom' && (!customStart || !customEnd)) return;
    if (!rangeStartIso || !rangeEndIso) return;

    setLoading(true);
    try {
      const [summaryRes, gamesRes, flowRes] = await Promise.all([
        supabase.rpc('get_casino_financial_summary', {
          p_start: rangeStartIso,
          p_end:   rangeEndIso,
        }),
        supabase.rpc('get_game_financial_summary', {
          p_start: rangeStartIso,
          p_end:   rangeEndIso,
        }),
        supabase.rpc('get_money_flow_series', {
          p_start: rangeStartIso,
          p_end:   rangeEndIso,
        }),
      ]);

      if (summaryRes.error) console.error('[Financial] summary error:', summaryRes.error);
      if (gamesRes.error)   console.error('[Financial] games error:',   gamesRes.error);
      if (flowRes.error)    console.error('[Financial] flow error:',    flowRes.error);

      // Summery comes back as a single jsonb object
      const raw = summaryRes.data as FinancialSummary | null;
      setSummary(raw ? {
        total_deposited:     Number(raw.total_deposited)     || 0,
        total_withdrawn:     Number(raw.total_withdrawn)     || 0,
        net_cash_flow:       Number(raw.net_cash_flow)       || 0,
        admin_credits_paid:  Number(raw.admin_credits_paid)  || 0,
        admin_debits_taken:  Number(raw.admin_debits_taken)  || 0,
        total_wagered:       Number(raw.total_wagered)       || 0,
        total_won:           Number(raw.total_won)           || 0,
        ggr:                 Number(raw.ggr)                 || 0,
        player_funds:        Number(raw.player_funds)        || 0,
        casino_balance:      Number(raw.casino_balance)      || 0,
        opening_balance:     Number(raw.opening_balance)     || 0,
        pending_deposits:    Number(raw.pending_deposits)    || 0,
        pending_withdrawals: Number(raw.pending_withdrawals) || 0,
        jackpot_pool:        Number(raw.jackpot_pool)        || 0,
        jackpot_paid:        Number(raw.jackpot_paid)        || 0,
        jackpot_wins_count:  Number(raw.jackpot_wins_count)  || 0,
        jackpot_largest:     Number(raw.jackpot_largest)     || 0,
      } : null);

      // Merge game stats with friendly names from GAME_LISTINGS
      const rawGames = (gamesRes.data ?? []) as {
        game_id: string; total_bets: number; total_payouts: number;
        ggr: number; spin_count: number; avg_bet: number;
      }[];
      const merged: GameStat[] = rawGames.map((g) => ({
        ...g,
        game_name:     GAME_LISTINGS.find((gl) => gl.id === g.game_id)?.title ?? g.game_id,
        total_bets:    Number(g.total_bets)    || 0,
        total_payouts: Number(g.total_payouts) || 0,
        ggr:           Number(g.ggr)           || 0,
        spin_count:    Number(g.spin_count)    || 0,
        avg_bet:       Number(g.avg_bet)       || 0,
      }));
      setGameStats(merged);

      // Flow series
      const rawFlow = (flowRes.data ?? []) as {
        bucket: string; deposits: number; withdrawals: number;
        admin_out: number; admin_in: number;
        wagered: number; won: number; ggr: number;
      }[];
      setFlowSeries(rawFlow.map((r) => ({
        bucket:      fmtDate(r.bucket),
        deposits:    Number(r.deposits)    || 0,
        withdrawals: Number(r.withdrawals) || 0,
        admin_out:   Number(r.admin_out)   || 0,
        admin_in:    Number(r.admin_in)    || 0,
        wagered:     Number(r.wagered)     || 0,
        won:         Number(r.won)         || 0,
        ggr:         Number(r.ggr)         || 0,
      })));
    } finally {
      setLoading(false);
    }
  }, [rangeStartIso, rangeEndIso]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  // ── Realtime refresh on new transactions OR spins ────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel('casino_finance_watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => void fetchAll())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'spins' }, () => void fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  const chartStyle = { background: '#111118', border: '1px solid #ffffff20', borderRadius: 8 };
  const PRESETS: { id: Preset; label: string }[] = [
    { id: 'today',  label: 'Today' },
    { id: 'week',   label: 'This Week' },
    { id: 'month',  label: 'This Month' },
    { id: 'last30', label: 'Last 30 Days' },
    { id: 'custom', label: 'Custom' },
  ];

  // ── Totals for the game table ──────────────────────────────────────────────
  const gameTotals = useMemo(() => ({
    spins:    gameStats.reduce((a, g) => a + g.spin_count, 0),
    wagered:  gameStats.reduce((a, g) => a + g.total_bets, 0),
    payouts:  gameStats.reduce((a, g) => a + g.total_payouts, 0),
    ggr:      gameStats.reduce((a, g) => a + g.ggr, 0),
  }), [gameStats]);

  return (
    <div className="flex flex-col gap-6">

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
          {PRESETS.map((p) => (
            <button key={p.id} onClick={() => setPreset(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-orbitron tracking-wider transition-colors ${
                preset === p.id ? 'bg-[#FFD700] text-black' : 'text-white/50 hover:text-white'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex gap-2 items-end">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/50" />
            <span className="text-white/30 self-center">→</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/50" />
          </div>
        )}
        <button onClick={() => void fetchAll()}
          className="ml-auto px-4 py-2 rounded-lg bg-[#FFD700]/20 hover:bg-[#FFD700]/30 text-[#FFD700] text-xs font-semibold transition-colors">
          ↻ Refresh
        </button>
        {loading && <span className="text-white/30 text-xs">Loading…</span>}
      </div>

      {loading && !summary ? (
        <LoadingSkeleton rows={10} />
      ) : (
        <>
          {/* ── Core financial stats ──────────────────────────────────────── */}
          <section>
            <h2 className="text-white/50 text-xs font-orbitron uppercase tracking-widest mb-3">
              Financial Overview
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <StatCard title="Total Deposited"   value={fmt(summary?.total_deposited   ?? 0)} icon="📲" color="green"  subtitle="M-Pesa inflows only" />
              <StatCard title="Total Withdrawn"   value={fmt(summary?.total_withdrawn   ?? 0)} icon="💸" color="red"    subtitle="M-Pesa outflows only" />
              <StatCard title="Net Cash Flow"
                value={`${(summary?.net_cash_flow ?? 0) < 0 ? '-' : ''}${fmt(Math.abs(summary?.net_cash_flow ?? 0))}`}
                icon="🔄" color={(summary?.net_cash_flow ?? 0) >= 0 ? 'cyan' : 'red'}
                subtitle="Deposits + debits − Withdrawals − credits" />
              <StatCard title="Player Funds"      value={fmt(summary?.player_funds      ?? 0)} icon="👥" color="purple" subtitle="Sum of player balances" />
              <StatCard title="GGR"
                value={`${(summary?.ggr ?? 0) < 0 ? '-' : ''}${fmt(Math.abs(summary?.ggr ?? 0))}`}
                icon="💰" color={(summary?.ggr ?? 0) >= 0 ? 'yellow' : 'red'}
                subtitle="Wagered − Won (gaming only)" />
            </div>
          </section>

          {/* ── Wagering + pending ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Wagered"        value={fmt(summary?.total_wagered        ?? 0)} icon="🎰" color="cyan"   subtitle="Bets placed" />
            <StatCard title="Total Won"            value={fmt(summary?.total_won            ?? 0)} icon="🏆" color="purple" subtitle="Payouts to players" />
            <StatCard title="Pending Deposits"     value={fmt(summary?.pending_deposits     ?? 0)} icon="⏳" color="yellow" subtitle="Awaiting confirmation" />
            <StatCard title="Pending Withdrawals"  value={fmt(summary?.pending_withdrawals  ?? 0)} icon="⌛" color="yellow" subtitle="Awaiting processing" />
          </div>

          {/* ── Admin adjustments ─────────────────────────────────────────── */}
          <section>
            <h2 className="text-white/50 text-xs font-orbitron uppercase tracking-widest mb-3">
              Admin Adjustments
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard
                title="Admin Credits Paid"
                value={fmt(summary?.admin_credits_paid ?? 0)}
                icon="💸" color="red"
                subtitle="Casino paid to players — reduces house balance"
              />
              <StatCard
                title="Admin Debits Taken"
                value={fmt(summary?.admin_debits_taken ?? 0)}
                icon="💰" color="green"
                subtitle="Reclaimed from players — increases house balance"
              />
              <StatCard
                title="Casino Account Balance"
                value={fmt(summary?.casino_balance ?? 0)}
                icon="🏦" color="cyan"
                subtitle="Live casino ledger balance"
              />
            </div>
          </section>

          {/* ── Jackpot summary ──────────────────────────────────────────── */}
          <section>
            <h2 className="text-white/50 text-xs font-orbitron uppercase tracking-widest mb-3">
              Jackpot Financials
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Jackpot Pool"      value={fmt(summary?.jackpot_pool     ?? 0)} icon="🎯" color="yellow" subtitle="Live jackpot totals" />
              <StatCard title="Total JP Paid"     value={fmt(summary?.jackpot_paid     ?? 0)} icon="💵" color="green"  subtitle="All-time jackpot payouts" />
              <StatCard title="Jackpot Wins"      value={(summary?.jackpot_wins_count  ?? 0).toLocaleString()} icon="⭐" color="purple" subtitle="Number of jackpot hits" />
              <StatCard title="Largest Jackpot"   value={fmt(summary?.jackpot_largest  ?? 0)} icon="👑" color="cyan"   subtitle="Biggest single payout" />
            </div>
          </section>

          {/* ── Money Flow chart ─────────────────────────────────────────── */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="text-white/60 text-xs font-orbitron uppercase tracking-widest">Money Flow</h2>
                <p className="text-white/30 text-xs mt-0.5">Daily deposits · withdrawals · admin adjustments · wagers · wins · GGR</p>
              </div>
              <div className="flex gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
                <button onClick={() => setChartLine('bar')}
                  className={`px-3 py-1 rounded text-xs font-orbitron transition-colors ${chartLine === 'bar' ? 'bg-[#FFD700] text-black' : 'text-white/50 hover:text-white'}`}>
                  Bar
                </button>
                <button onClick={() => setChartLine('line')}
                  className={`px-3 py-1 rounded text-xs font-orbitron transition-colors ${chartLine === 'line' ? 'bg-[#FFD700] text-black' : 'text-white/50 hover:text-white'}`}>
                  Line
                </button>
              </div>
            </div>

            {flowSeries.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-8">
                No data for this period. Data appears once players transact.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                {chartLine === 'bar' ? (
                  <BarChart data={flowSeries} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="bucket" tick={{ fill: '#ffffff40', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} />
                    <Tooltip contentStyle={chartStyle} formatter={(v) => `KES ${Number(v).toLocaleString()}`} />
                    <Legend wrapperStyle={{ color: '#ffffff80', fontSize: 11 }} />
                    <Bar dataKey="deposits"    name="Deposits"       fill="#22C55E" radius={[3,3,0,0]} />
                    <Bar dataKey="withdrawals" name="Withdrawals"    fill="#EF4444" radius={[3,3,0,0]} />
                    <Bar dataKey="admin_out"   name="Admin Credits"  fill="#F97316" radius={[3,3,0,0]} />
                    <Bar dataKey="admin_in"    name="Admin Debits"   fill="#06B6D4" radius={[3,3,0,0]} />
                    <Bar dataKey="wagered"     name="Wagered"        fill="#00FFFF" radius={[3,3,0,0]} />
                    <Bar dataKey="won"         name="Won"            fill="#A855F7" radius={[3,3,0,0]} />
                    <Bar dataKey="ggr"         name="GGR"            fill="#FFD700" radius={[3,3,0,0]} />
                  </BarChart>
                ) : (
                  <LineChart data={flowSeries} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="bucket" tick={{ fill: '#ffffff40', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} />
                    <Tooltip contentStyle={chartStyle} formatter={(v) => `KES ${Number(v).toLocaleString()}`} />
                    <Legend wrapperStyle={{ color: '#ffffff80', fontSize: 11 }} />
                    <Line type="monotone" dataKey="deposits"    name="Deposits"      stroke="#22C55E" strokeWidth={2}   dot={false} />
                    <Line type="monotone" dataKey="withdrawals" name="Withdrawals"   stroke="#EF4444" strokeWidth={2}   dot={false} />
                    <Line type="monotone" dataKey="admin_out"   name="Admin Credits" stroke="#F97316" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="admin_in"    name="Admin Debits"  stroke="#06B6D4" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="wagered"     name="Wagered"       stroke="#00FFFF" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="won"         name="Won"           stroke="#A855F7" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="ggr"         name="GGR"           stroke="#FFD700" strokeWidth={2}   dot={false} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            )}
          </section>

          {/* ── Per-game breakdown ───────────────────────────────────────── */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="text-white/60 text-xs font-orbitron uppercase tracking-widest">Game-Level Financials</h2>
                <p className="text-white/30 text-xs mt-0.5">Source: spins table — real bet and payout data</p>
              </div>
              {gameTotals.spins > 0 && (
                <div className="flex gap-4 text-xs font-orbitron">
                  <span className="text-white/40">{gameTotals.spins.toLocaleString()} spins</span>
                  <span className="text-cyan-400">{fmt(gameTotals.wagered)} wagered</span>
                  <span className="text-[#FFD700]">{fmt(gameTotals.ggr)} GGR</span>
                </div>
              )}
            </div>
            {gameStats.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-4">
                No spin data for this period.
              </p>
            ) : (
              <DataTable<GameStat>
                columns={gameColumns}
                data={gameStats}
                emptyMessage="No game data."
                pageSize={20}
              />
            )}
          </section>

          {/* ── Casino Cash Balance Redesign ────────────────────────────── */}
          <section className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8"
              style={{ background: 'rgba(0,0,0,0.3)' }}>
              <div>
                <h2 className="font-orbitron font-bold text-white tracking-widest uppercase text-sm">
                  Casino Cash Balance — Full Breakdown
                </h2>
                <p className="text-white/30 text-xs mt-0.5">Running ledger of all casino cash inflows and outflows</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="font-orbitron text-[10px] text-green-400 tracking-widest">LIVE BALANCE</span>
              </div>
            </div>

            {/* Opening balance banner — only when non-zero */}
            {(summary?.opening_balance ?? 0) !== 0 && (
              <div className="flex items-center gap-3 px-6 py-3 border-b border-white/5"
                style={{ background: 'rgba(255,215,0,0.04)' }}>
                <span className="text-[#FFD700] text-base shrink-0">⚠</span>
                <div className="flex-1 min-w-0">
                  <span className="font-orbitron text-xs text-[#FFD700]">Opening Balance: </span>
                  <span className="font-orbitron text-xs font-bold text-[#FFD700]">
                    KES {Math.round(summary?.opening_balance ?? 0).toLocaleString()}
                  </span>
                  <span className="text-white/30 text-xs ml-2">
                    — carried forward from before M-Pesa cash tracking was enabled
                  </span>
                </div>
              </div>
            )}

            {/* Two-column ledger */}
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/5">

              {/* ── Inflows column ── */}
              <div className="p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="font-orbitron text-[10px] text-green-400 uppercase tracking-widest">Cash Inflows</span>
                </div>

                {/* Opening balance row */}
                <div className="flex items-center justify-between py-2.5 px-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-orbitron font-bold bg-white/10 text-white/40 shrink-0">0</span>
                    <div>
                      <p className="text-white/50 text-xs font-orbitron">Opening Balance</p>
                      <p className="text-white/25 text-[10px]">Legacy baseline before Daraja integration cutover</p>
                    </div>
                  </div>
                  <span className="font-orbitron font-bold text-sm shrink-0 ml-3"
                    style={{ color: (summary?.opening_balance ?? 0) >= 0 ? 'rgba(255,255,255,0.4)' : '#ef4444' }}>
                    KES {Math.round(summary?.opening_balance ?? 0).toLocaleString()}
                  </span>
                </div>

                {[
                  {
                    n: '1', icon: '📲', label: 'Player Deposits (M-Pesa)',
                    sub: 'Confirmed via Safaricom Daraja callback',
                    badge: 'API Verified',
                    value: summary?.total_deposited ?? 0,
                    color: '#22c55e',
                  },
                  {
                    n: '2', icon: '↩', label: 'Admin Debits from Players',
                    sub: 'Amounts reclaimed from player wallets by admin',
                    value: summary?.admin_debits_taken ?? 0,
                    color: '#06b6d4',
                  },
                ].map((row) => (
                  <div key={row.n} className="flex items-center justify-between py-2.5 px-3 rounded-xl"
                    style={{ background: `${row.color}0a`, border: `1px solid ${row.color}18` }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-orbitron font-bold shrink-0"
                        style={{ background: `${row.color}22`, color: row.color }}>
                        {row.n}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-white/80 text-xs font-orbitron">{row.label}</p>
                          {'badge' in row && row.badge && (
                            <span className="text-[9px] font-orbitron px-1.5 py-0.5 rounded-full"
                              style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                              {row.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-white/25 text-[10px] mt-0.5 truncate">{row.sub}</p>
                      </div>
                    </div>
                    <span className="font-orbitron font-bold text-sm shrink-0 ml-3"
                      style={{ color: row.color }}>
                      + {fmt(row.value)}
                    </span>
                  </div>
                ))}

                {/* Inflow subtotal */}
                <div className="flex items-center justify-between pt-2 border-t border-white/8 px-1">
                  <span className="text-white/30 text-xs font-orbitron">Total Inflows</span>
                  <span className="font-orbitron font-bold text-sm text-green-400">
                    + {fmt((summary?.opening_balance ?? 0) + (summary?.total_deposited ?? 0) + (summary?.admin_debits_taken ?? 0))}
                  </span>
                </div>
              </div>

              {/* ── Outflows column ── */}
              <div className="p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="font-orbitron text-[10px] text-red-400 uppercase tracking-widest">Cash Outflows</span>
                </div>

                {[
                  {
                    n: '3', icon: '💸', label: 'Player Withdrawals (M-Pesa)',
                    sub: 'Completed withdrawals sent to player M-Pesa numbers',
                    value: summary?.total_withdrawn ?? 0,
                    color: '#ef4444',
                  },
                  {
                    n: '4', icon: '🎁', label: 'Admin Credits to Players',
                    sub: 'Manual credits paid to player wallets by admin',
                    value: summary?.admin_credits_paid ?? 0,
                    color: '#f97316',
                  },
                ].map((row) => (
                  <div key={row.n} className="flex items-center justify-between py-2.5 px-3 rounded-xl"
                    style={{ background: `${row.color}0a`, border: `1px solid ${row.color}18` }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-orbitron font-bold shrink-0"
                        style={{ background: `${row.color}22`, color: row.color }}>
                        {row.n}
                      </span>
                      <div className="min-w-0">
                        <p className="text-white/80 text-xs font-orbitron">{row.label}</p>
                        <p className="text-white/25 text-[10px] mt-0.5 truncate">{row.sub}</p>
                      </div>
                    </div>
                    <span className="font-orbitron font-bold text-sm shrink-0 ml-3"
                      style={{ color: row.color }}>
                      − {fmt(row.value)}
                    </span>
                  </div>
                ))}

                {/* Outflow subtotal */}
                <div className="flex items-center justify-between pt-2 border-t border-white/8 px-1">
                  <span className="text-white/30 text-xs font-orbitron">Total Outflows</span>
                  <span className="font-orbitron font-bold text-sm text-red-400">
                    − {fmt((summary?.total_withdrawn ?? 0) + (summary?.admin_credits_paid ?? 0))}
                  </span>
                </div>

                {/* Placeholder rows so columns stay even height */}
                <div className="flex-1" />
              </div>
            </div>

            {/* ── Net Balance Result ── */}
            <div className="px-6 py-5 border-t border-white/8"
              style={{
                background: (summary?.casino_balance ?? 0) >= 0
                  ? 'linear-gradient(135deg, rgba(0,255,136,0.06), rgba(0,180,100,0.03))'
                  : 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(200,30,30,0.04))',
              }}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                    style={{
                      background: (summary?.casino_balance ?? 0) >= 0
                        ? 'rgba(0,255,136,0.1)' : 'rgba(239,68,68,0.1)',
                      border: (summary?.casino_balance ?? 0) >= 0
                        ? '1px solid rgba(0,255,136,0.2)' : '1px solid rgba(239,68,68,0.2)',
                    }}>
                    🏦
                  </div>
                  <div>
                    <p className="font-orbitron font-bold text-white tracking-wide">= Casino Cash Balance</p>
                    <p className="text-white/30 text-[10px] mt-0.5">
                      Opening + Deposits + Admin Debits − Withdrawals − Admin Credits
                    </p>
                    {(summary?.casino_balance ?? 0) < 0 && (
                      <p className="text-red-400/70 text-[10px] mt-0.5 font-orbitron">
                        NET DEFICIT — casino has issued more funds than received
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-orbitron font-black text-3xl"
                    style={{
                      color: (summary?.casino_balance ?? 0) >= 0 ? '#00ff88' : '#ef4444',
                      textShadow: (summary?.casino_balance ?? 0) >= 0
                        ? '0 0 24px rgba(0,255,136,0.5)' : '0 0 24px rgba(239,68,68,0.5)',
                    }}>
                    KES {Math.round(Math.abs(summary?.casino_balance ?? 0)).toLocaleString()}
                  </p>
                  {(summary?.casino_balance ?? 0) < 0 && (
                    <p className="text-red-400/60 text-[10px] font-orbitron mt-0.5">DEFICIT</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ── Accounting note ──────────────────────────────────────────── */}
          <div className="rounded-xl px-4 py-3 text-xs text-white/30 leading-relaxed"
            style={{ background: 'rgba(255,215,0,0.03)', border: '1px solid rgba(255,215,0,0.08)' }}>
            <span className="text-white/50 font-semibold">Note: </span>
            GGR = Total Wagered (spins) − Total Won (spins). Net Cash Flow = Total Deposits − Total Withdrawals.
            Player Funds = sum of all active account balances (live snapshot). Jackpot payouts are tracked separately
            from GGR. All figures are calculated from live transaction and spin records — no data is hardcoded.
          </div>
        </>
      )}
    </div>
  );
}
