/**
 * WeeklyCashbackHistory — shows past weekly cashback records.
 * Neon Noir theme — no external deps beyond framer-motion.
 */
import { useVIPStore, type WeeklyCashback } from '../store/vipStore';

const EAT_OFFSET_MS = 3 * 3600_000;

function formatEATDate(iso: string): string {
  const utc = new Date(iso);
  const eat = new Date(utc.getTime() + EAT_OFFSET_MS);
  return eat.toLocaleDateString('en-KE', {
    day: '2-digit', month: 'short', year: 'numeric',
    timeZone: 'Africa/Nairobi',
  });
}

function weekLabel(wc: WeeklyCashback): string {
  return `${formatEATDate(wc.weekStart)} – ${formatEATDate(wc.weekEnd)}`;
}

const STATUS_COLORS: Record<string, string> = {
  ACCUMULATING:   'rgba(255,215,0,0.5)',
  READY_TO_CLAIM: '#FFD700',
  CLAIMED:        '#4ade80',
  EXPIRED:        'rgba(255,255,255,0.2)',
};

const TIER_COLORS: Record<string, string> = {
  bronze:   '#CD7F32',
  silver:   '#C0C0C0',
  gold:     '#FFD700',
  platinum: '#E5E4E2',
  diamond:  '#B9F2FF',
};

function fmtKES(n: number): string {
  return `KES ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function WeeklyCashbackHistory() {
  const { cashbackHistory } = useVIPStore();

  if (!cashbackHistory.length) return null;

  return (
    <div>
      <h2 className="font-orbitron text-xs text-white/40 tracking-widest uppercase mb-4">
        Weekly Cashback History
      </h2>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto rounded-xl"
        style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <table className="w-full text-xs font-orbitron">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
              {['Week', 'Tier', 'Rate', 'Net Loss', 'Cashback', 'Status', 'Claimed'].map((h) => (
                <th key={h} className="px-3 py-3 text-left text-white/30 tracking-widest uppercase font-bold text-[10px]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cashbackHistory.map((wc) => (
              <tr
                key={wc.id}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                className="hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-3 py-3 text-white/50 whitespace-nowrap">{weekLabel(wc)}</td>
                <td className="px-3 py-3">
                  <span className="capitalize" style={{ color: TIER_COLORS[wc.vipTier] ?? '#fff' }}>
                    {wc.vipTier}
                  </span>
                </td>
                <td className="px-3 py-3 text-white/50">{(wc.cashbackRate * 100).toFixed(0)}%</td>
                <td className="px-3 py-3 text-white/60">{fmtKES(wc.eligibleNetLoss)}</td>
                <td className="px-3 py-3 font-bold text-yellow-400">
                  {wc.cashbackAmount > 0 ? fmtKES(wc.cashbackAmount) : '—'}
                </td>
                <td className="px-3 py-3">
                  <span
                    className="px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest"
                    style={{
                      color: STATUS_COLORS[wc.status] ?? '#fff',
                      background: `${STATUS_COLORS[wc.status] ?? '#fff'}18`,
                      border: `1px solid ${STATUS_COLORS[wc.status] ?? '#fff'}33`,
                    }}
                  >
                    {wc.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-3 py-3 text-white/30">
                  {wc.claimedAt ? formatEATDate(wc.claimedAt) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="sm:hidden flex flex-col gap-3">
        {cashbackHistory.map((wc) => (
          <div
            key={wc.id}
            className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-[10px] font-orbitron">{weekLabel(wc)}</span>
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-orbitron uppercase tracking-widest"
                style={{
                  color: STATUS_COLORS[wc.status] ?? '#fff',
                  background: `${STATUS_COLORS[wc.status] ?? '#fff'}18`,
                  border: `1px solid ${STATUS_COLORS[wc.status] ?? '#fff'}33`,
                }}
              >
                {wc.status.replace('_', ' ')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
              <span className="text-white/30">Tier</span>
              <span className="capitalize font-orbitron" style={{ color: TIER_COLORS[wc.vipTier] ?? '#fff' }}>
                {wc.vipTier}
              </span>
              <span className="text-white/30">Rate</span>
              <span className="text-white/60 font-orbitron">{(wc.cashbackRate * 100).toFixed(0)}%</span>
              <span className="text-white/30">Net Loss</span>
              <span className="text-white/60 font-orbitron">{fmtKES(wc.eligibleNetLoss)}</span>
              <span className="text-white/30">Cashback</span>
              <span className="font-orbitron font-bold text-yellow-400">
                {wc.cashbackAmount > 0 ? fmtKES(wc.cashbackAmount) : '—'}
              </span>
              {wc.claimedAt && (
                <>
                  <span className="text-white/30">Claimed</span>
                  <span className="text-white/40 font-orbitron">{formatEATDate(wc.claimedAt)}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
