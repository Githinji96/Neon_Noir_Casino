/**
 * BetHistoryPage — /admin/users/:userId/bet-history
 *
 * Displays a player's aggregated and individual bet records.
 * Read-only. All data fetched via SECURITY DEFINER RPCs that
 * enforce admin auth and player-ownership server-side.
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAdminStore } from '../../store/adminStore';
import LoadingSkeleton from '../../components/admin/LoadingSkeleton';
import StatCard from '../../components/admin/StatCard';
import { GAME_LISTINGS } from '../../config/mockData';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GameSummaryRow {
  game_id:       string;
  spin_count:    number;
  total_wagered: number;
  total_wins:    number;
  ggr:           number;
}

interface SpinRow {
  id:         string;
  created_at: string;
  game_id:    string;
  bet:        number;
  payout:     number;
  ggr:        number;
  result:     'WIN' | 'PUSH' | 'LOSS';
}

type DatePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'custom';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function presetRange(preset: DatePreset): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const start = new Date(now); start.setHours(0, 0, 0, 0);

  if (preset === 'today')     return { start, end };
  if (preset === 'yesterday') {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1); end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (preset === 'last7')  { start.setDate(start.getDate() - 6);  return { start, end }; }
  if (preset === 'last30') { start.setDate(start.getDate() - 29); return { start, end }; }
  return { start, end };
}

function fmt(n: number) {
  return `KES ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function gameLabel(gameId: string) {
  // Live table games are stored as "live_blackjack", "live_roulette" etc.
  if (gameId.startsWith('live_')) {
    const type = gameId.replace('live_', '');
    return `Live ${type.charAt(0).toUpperCase()}${type.slice(1)}`;
  }
  return GAME_LISTINGS.find((g) => g.id === gameId)?.title
    ?? gameId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const PAGE_SIZE = 25;

// ─── Game Options data ─────────────────────────────────────────────────────

interface GameOption { id: string; label: string; }
interface GameGroup  { label: string; options: GameOption[]; }

const SLOT_OPTIONS: GameOption[] = (() => {
  const seen = new Set<string>();
  // Exclude jackpot games and mega-moolah-noir from the Slots group
  return GAME_LISTINGS
    .filter((g) => {
      if (g.isJackpotGame) return false;
      if (seen.has(g.id)) return false;
      seen.add(g.id);
      return true;
    })
    .map((g) => ({ id: g.id, label: g.title }));
})();

const JACKPOT_OPTIONS: GameOption[] = (() => {
  const seen = new Set<string>();
  return GAME_LISTINGS
    .filter((g) => {
      if (!g.isJackpotGame) return false;
      if (seen.has(g.id)) return false;
      seen.add(g.id);
      return true;
    })
    .map((g) => ({ id: g.id, label: g.title }));
})();

const LIVE_OPTIONS: GameOption[] = [
  { id: 'live_blackjack', label: 'Live Blackjack' },
  { id: 'live_roulette',  label: 'Live Roulette'  },
  { id: 'live_baccarat',  label: 'Live Baccarat'  },
  { id: 'live_poker',     label: 'Live Poker'      },
];

const GAME_GROUPS: GameGroup[] = [
  { label: 'Jackpots',    options: JACKPOT_OPTIONS },
  { label: 'Slots',       options: SLOT_OPTIONS    },
  { label: 'Live Tables', options: LIVE_OPTIONS    },
];

const ALL_OPTIONS: GameOption[] = [
  { id: '', label: 'All Games' },
  ...JACKPOT_OPTIONS,
  ...SLOT_OPTIONS,
  ...LIVE_OPTIONS,
];

// ─── Custom Game Dropdown ──────────────────────────────────────────────────

interface GameDropdownProps {
  value:    string;
  onChange: (v: string) => void;
}

function GameDropdown({ value, onChange }: GameDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Keyboard: Escape closes, Enter toggles
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const selectedLabel = ALL_OPTIONS.find((o) => o.id === value)?.label ?? 'All Games';

  return (
    <div ref={ref} className="relative" style={{ minWidth: 220 }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-2 rounded-xl text-sm font-orbitron transition-all focus:outline-none"
        style={{
          background:   'rgba(255,255,255,0.04)',
          border:       `1px solid ${open ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.10)'}`,
          color:        value ? '#a855f7' : 'rgba(255,255,255,0.65)',
          boxShadow:    open ? '0 0 12px rgba(168,85,247,0.15)' : 'none',
        }}
      >
        <span className="truncate">{selectedLabel}</span>
        <svg
          className="shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          width="12" height="12" viewBox="0 0 12 12" fill="none"
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="listbox"
          aria-label="Select game"
          className="absolute left-0 z-50 mt-1.5 w-full overflow-y-auto rounded-xl py-1.5"
          style={{
            background:   '#0d0d1a',
            border:       '1px solid rgba(168,85,247,0.22)',
            boxShadow:    '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(168,85,247,0.08)',
            maxHeight:    320,
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(168,85,247,0.25) transparent',
          }}
        >
          {/* ALL GAMES option */}
          <DropdownOption
            id=""
            label="All Games"
            selected={value === ''}
            onSelect={(id) => { onChange(id); setOpen(false); }}
          />

          {/* Divider */}
          <div style={{ height: 1, margin: '4px 12px', background: 'rgba(255,255,255,0.07)' }} />

          {/* Groups */}
          {GAME_GROUPS.map((group) => (
            <div key={group.label}>
              {/* Category header */}
              <div
                className="px-4 pt-2 pb-1 font-orbitron text-[10px] tracking-[0.2em] uppercase select-none"
                style={{ color: 'rgba(168,85,247,0.55)' }}
              >
                {group.label}
              </div>
              {group.options.map((opt) => (
                <DropdownOption
                  key={opt.id}
                  id={opt.id}
                  label={opt.label}
                  selected={value === opt.id}
                  onSelect={(id) => { onChange(id); setOpen(false); }}
                />
              ))}
              <div style={{ height: 1, margin: '4px 12px', background: 'rgba(255,255,255,0.07)' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface DropdownOptionProps {
  id: string; label: string; selected: boolean;
  onSelect: (id: string) => void;
}
function DropdownOption({ id, label, selected, onSelect }: DropdownOptionProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={0}
      onClick={() => onSelect(id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(id); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="px-4 py-2 cursor-pointer text-sm font-orbitron tracking-wide transition-colors outline-none"
      style={{
        background: selected
          ? 'rgba(168,85,247,0.12)'
          : hovered
          ? 'rgba(168,85,247,0.07)'
          : 'transparent',
        color: selected
          ? '#c084fc'
          : hovered
          ? 'rgba(192,132,252,0.9)'
          : 'rgba(255,255,255,0.60)',
        borderLeft: selected ? '2px solid rgba(168,85,247,0.7)' : '2px solid transparent',
      }}
    >
      {label}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BetHistoryPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate   = useNavigate();

  // Must be an admin — AdminAuthGuard already enforces this at the route level
  const { adminProfile } = useAdminStore();
  void adminProfile; // used for role display if needed

  const [username, setUsername]           = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);

  // ── Filters ──────────────────────────────────────────────────────────────
  const [preset, setPreset]               = useState<DatePreset>('today');
  const [customStart, setCustomStart]     = useState('');
  const [customEnd,   setCustomEnd]       = useState('');
  const [gameFilter,  setGameFilter]      = useState('');   // '' = all games
  const [showDetail,  setShowDetail]      = useState(false);

  // ── Summary data ─────────────────────────────────────────────────────────
  const [summary, setSummary]             = useState<GameSummaryRow[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // ── Detail data ───────────────────────────────────────────────────────────
  const [spins, setSpins]                 = useState<SpinRow[]>([]);
  const [totalSpins, setTotalSpins]       = useState(0);
  const [page, setPage]                   = useState(1);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ── Derived date range ───────────────────────────────────────────────────
  const { startIso, endIso } = useMemo(() => {
    if (preset === 'custom') {
      if (!customStart || !customEnd) return { startIso: null, endIso: null };
      return {
        startIso: new Date(customStart + 'T00:00:00').toISOString(),
        endIso:   new Date(customEnd   + 'T23:59:59').toISOString(),
      };
    }
    const { start, end } = presetRange(preset);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }, [preset, customStart, customEnd]);

  // ── Fetch player username ────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        setUsername(data?.username ?? userId);
        setLoadingProfile(false);
      });
  }, [userId]);

  // ── Fetch game summary ───────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    if (!userId || !startIso || !endIso) return;
    setLoadingSummary(true);
    const { data, error } = await supabase.rpc('admin_get_player_bet_summary', {
      p_player_id: userId,
      p_start:     startIso,
      p_end:       endIso,
      p_game_id:   gameFilter || null,
    });
    if (!error && data) {
      setSummary((data as GameSummaryRow[]).map((r) => ({
        game_id:       r.game_id,
        spin_count:    Number(r.spin_count),
        total_wagered: Number(r.total_wagered),
        total_wins:    Number(r.total_wins),
        ggr:           Number(r.ggr),
      })));
    }
    setLoadingSummary(false);
  }, [userId, startIso, endIso, gameFilter]);

  useEffect(() => { void fetchSummary(); }, [fetchSummary]);

  // ── Fetch individual spins (paginated) ───────────────────────────────────
  const fetchDetail = useCallback(async (pg: number) => {
    if (!userId || !startIso || !endIso) return;
    setLoadingDetail(true);

    const [detailRes, countRes] = await Promise.all([
      supabase.rpc('admin_get_player_bets', {
        p_player_id: userId,
        p_start:     startIso,
        p_end:       endIso,
        p_game_id:   gameFilter || null,
        p_limit:     PAGE_SIZE,
        p_offset:    (pg - 1) * PAGE_SIZE,
      }),
      supabase.rpc('admin_get_player_bets_count', {
        p_player_id: userId,
        p_start:     startIso,
        p_end:       endIso,
        p_game_id:   gameFilter || null,
      }),
    ]);

    if (!detailRes.error && detailRes.data) setSpins(detailRes.data as SpinRow[]);
    if (!countRes.error && countRes.data != null) setTotalSpins(Number(countRes.data));
    setLoadingDetail(false);
  }, [userId, startIso, endIso, gameFilter]);

  useEffect(() => {
    if (showDetail) { void fetchDetail(page); }
  }, [showDetail, fetchDetail, page]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [startIso, endIso, gameFilter]);

  // ── Aggregated totals ────────────────────────────────────────────────────
  const totals = useMemo(() => ({
    spins:    summary.reduce((a, r) => a + r.spin_count,    0),
    wagered:  summary.reduce((a, r) => a + r.total_wagered, 0),
    wins:     summary.reduce((a, r) => a + r.total_wins,    0),
    ggr:      summary.reduce((a, r) => a + r.ggr,           0),
  }), [summary]);

  const totalPages = Math.max(1, Math.ceil(totalSpins / PAGE_SIZE));

  // ── Unique games for filter dropdown ────────────────────────────────────
  // Static — built from GAME_LISTINGS + LIVE_OPTIONS constants above

  // ─────────────────────────────────────────────────────────────────────────

  if (loadingProfile) return <LoadingSkeleton rows={6} />;

  const DATE_PRESETS: { id: DatePreset; label: string }[] = [
    { id: 'today',     label: 'Today'       },
    { id: 'yesterday', label: 'Yesterday'   },
    { id: 'last7',     label: 'Last 7 Days' },
    { id: 'last30',    label: 'Last 30 Days' },
    { id: 'custom',    label: 'Custom'      },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* ── Breadcrumb + Back ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-white/40 text-xs font-orbitron tracking-wider">
          <button onClick={() => navigate('/admin/users')} className="hover:text-white transition-colors">Users</button>
          <span>/</span>
          <button onClick={() => navigate(`/admin/users/${userId}`)} className="hover:text-white transition-colors">{username}</button>
          <span>/</span>
          <span className="text-[#FFD700]">Bet History</span>
        </div>
        <button
          onClick={() => navigate(`/admin/users/${userId}`)}
          className="text-white/50 hover:text-white text-sm transition-colors flex items-center gap-1"
        >
          ← Back to User
        </button>
      </div>

      {/* ── Header ── */}
      <div>
        <p className="text-white/30 text-xs font-orbitron tracking-[0.3em] uppercase mb-1">Bet History</p>
        <h2 className="font-orbitron text-2xl font-bold text-white">
          🎰 <span className="text-[#FFD700]">{username}</span>
        </h2>
        <p className="text-white/30 text-xs mt-1">Read-only. Source: spins table.</p>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-wrap gap-3 items-end">
        {/* Date preset tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-orbitron tracking-wider transition-colors ${
                preset === p.id
                  ? 'bg-[#FFD700] text-black font-bold'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date inputs */}
        {preset === 'custom' && (
          <div className="flex gap-2 items-center">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#FFD700]/50" />
            <span className="text-white/30 text-xs">to</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#FFD700]/50" />
          </div>
        )}

        {/* Game filter */}
        <div className="flex flex-col gap-1">
          <label className="text-white/40 text-[10px] uppercase tracking-widest">Game</label>
          <GameDropdown value={gameFilter} onChange={setGameFilter} />
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Spins"   value={totals.spins.toLocaleString()} icon="🎰" color="yellow" />
        <StatCard title="Total Wagered" value={fmt(totals.wagered)}           icon="💰" color="cyan"   />
        <StatCard title="Total Wins"    value={fmt(totals.wins)}              icon="🏆" color="green"  />
        <StatCard
          title="Total GGR"
          value={fmt(totals.ggr)}
          icon={totals.ggr >= 0 ? '📈' : '📉'}
          color={totals.ggr >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* ── Game Summary Table ── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h3 className="text-white/60 text-xs uppercase tracking-widest">By Game</h3>
        </div>

        {loadingSummary ? (
          <div className="p-6"><LoadingSkeleton rows={4} /></div>
        ) : summary.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-4xl opacity-20">🎰</span>
            <p className="text-white/30 font-orbitron text-sm tracking-widest">
              No betting history available for this player.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  {['Game', 'Spins', 'Total Wagered', 'Total Wins', 'GGR'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-widest text-white/50">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.map((row) => (
                  <tr key={row.game_id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-3 text-white font-semibold">{gameLabel(row.game_id)}</td>
                    <td className="px-4 py-3 text-white/70 font-mono">{row.spin_count.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-white/80">{fmt(row.total_wagered)}</td>
                    <td className="px-4 py-3 font-mono text-green-400">{fmt(row.total_wins)}</td>
                    <td className="px-4 py-3">
                      <span className={`font-mono font-bold ${row.ggr >= 0 ? 'text-[#FFD700]' : 'text-red-400'}`}>
                        {fmt(row.ggr)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr className="border-t border-white/20 bg-white/[0.06]">
                  <td className="px-4 py-3 text-white/60 text-xs font-orbitron uppercase tracking-wider">Total</td>
                  <td className="px-4 py-3 text-white font-mono font-bold">{totals.spins.toLocaleString()}</td>
                  <td className="px-4 py-3 text-white font-mono font-bold">{fmt(totals.wagered)}</td>
                  <td className="px-4 py-3 text-green-400 font-mono font-bold">{fmt(totals.wins)}</td>
                  <td className="px-4 py-3">
                    <span className={`font-mono font-bold ${totals.ggr >= 0 ? 'text-[#FFD700]' : 'text-red-400'}`}>
                      {fmt(totals.ggr)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Individual Bets ── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-white/60 text-xs uppercase tracking-widest">Individual Bets</h3>
          <button
            onClick={() => {
              setShowDetail((v) => {
                if (!v) void fetchDetail(page);
                return !v;
              });
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-orbitron tracking-wider transition-colors ${
              showDetail
                ? 'bg-white/10 text-white/60 hover:bg-white/15'
                : 'bg-[#FFD700]/10 text-[#FFD700] border border-[#FFD700]/30 hover:bg-[#FFD700]/20'
            }`}
          >
            {showDetail ? 'HIDE BETS' : 'VIEW BETS'}
          </button>
        </div>

        {showDetail && (
          <>
            {loadingDetail ? (
              <div className="p-6"><LoadingSkeleton rows={5} /></div>
            ) : spins.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <p className="text-white/30 font-orbitron text-sm tracking-widest">No individual bets found.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        {['Date / Time', 'Game', 'Bet Amount', 'Win / Payout', 'GGR', 'Result'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-widest text-white/50 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {spins.map((spin) => (
                        <tr key={spin.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                          <td className="px-4 py-3 text-white/50 text-xs whitespace-nowrap">
                            {new Date(spin.created_at).toLocaleString('en-KE', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-3 text-white/80 whitespace-nowrap">{gameLabel(spin.game_id)}</td>
                          <td className="px-4 py-3 font-mono text-white/80">{fmt(spin.bet)}</td>
                          <td className="px-4 py-3 font-mono text-green-400">{fmt(spin.payout)}</td>
                          <td className="px-4 py-3">
                            <span className={`font-mono ${spin.ggr >= 0 ? 'text-[#FFD700]' : 'text-red-400'}`}>
                              {fmt(spin.ggr)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-orbitron font-bold uppercase ${
                              spin.result === 'WIN'  ? 'bg-green-500/20 text-green-400'  :
                              spin.result === 'PUSH' ? 'bg-blue-500/20 text-blue-400'    :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {spin.result}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-white/40 text-xs font-orbitron">
                    Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, totalSpins)} of {totalSpins.toLocaleString()} bets
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={page === 1}
                      onClick={() => { setPage((p) => p - 1); void fetchDetail(page - 1); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-orbitron border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ← Prev
                    </button>

                    {/* Page number pills */}
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pg: number;
                      if (totalPages <= 7) {
                        pg = i + 1;
                      } else if (page <= 4) {
                        pg = i + 1;
                      } else if (page >= totalPages - 3) {
                        pg = totalPages - 6 + i;
                      } else {
                        pg = page - 3 + i;
                      }
                      return (
                        <button
                          key={pg}
                          onClick={() => { setPage(pg); void fetchDetail(pg); }}
                          className={`w-8 h-8 rounded-lg text-xs font-orbitron transition-colors ${
                            pg === page
                              ? 'bg-[#FFD700] text-black font-bold'
                              : 'text-white/40 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {pg}
                        </button>
                      );
                    })}

                    <button
                      disabled={page === totalPages}
                      onClick={() => { setPage((p) => p + 1); void fetchDetail(page + 1); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-orbitron border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
