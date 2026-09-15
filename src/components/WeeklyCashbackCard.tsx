/**
 * WeeklyCashbackCard — displays the player's current weekly cashback status,
 * countdown to next calculation, and a claim button when available.
 *
 * Neon Noir theme: black / dark-purple background, neon-yellow accents,
 * bronze / amber tones for cashback, muted grey labels.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVIPStore } from '../store/vipStore';
import type { WeeklyCashback, WeeklyCashbackStatus } from '../store/vipStore';

// EAT = UTC+3
const EAT_OFFSET_MS = 3 * 3600_000;

/** Next Sunday 23:59:59 EAT as a UTC Date */
function nextSundayEAT(): Date {
  const now      = new Date();
  const eatNow   = new Date(now.getTime() + EAT_OFFSET_MS);
  const dow      = eatNow.getUTCDay(); // 0=Sun … 6=Sat
  const daysLeft = dow === 0 ? 0 : 7 - dow; // days until Sunday in EAT

  const sundayEAT = new Date(eatNow);
  sundayEAT.setUTCDate(eatNow.getUTCDate() + daysLeft);
  sundayEAT.setUTCHours(23, 59, 59, 0);

  // Convert back to UTC
  return new Date(sundayEAT.getTime() - EAT_OFFSET_MS);
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0h 0m';
  const totalSec = Math.floor(ms / 1000);
  const days  = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins  = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function fmtKES(n: number): string {
  return `KES ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusLabel(wc: WeeklyCashback | null): string {
  if (!wc) return 'Weekly cashback accumulating';
  switch (wc.status) {
    case 'ACCUMULATING':  return 'Weekly cashback accumulating';
    case 'READY_TO_CLAIM': return 'Weekly cashback available';
    case 'CLAIMED':        return 'Weekly cashback claimed';
    case 'EXPIRED':        return 'No cashback this week';
    default:               return '';
  }
}

function statusColor(status: WeeklyCashbackStatus | undefined): string {
  switch (status) {
    case 'READY_TO_CLAIM': return '#FFD700';
    case 'CLAIMED':        return '#4ade80';
    case 'EXPIRED':        return 'rgba(255,255,255,0.3)';
    default:               return 'rgba(255,215,0,0.5)';
  }
}

interface Props {
  userId: string;
  tierColor: string;
  tierLabel: string;
  cashbackRate: number; // e.g. 1 for 1%
}

export default function WeeklyCashbackCard({ userId, tierColor, tierLabel, cashbackRate }: Props) {
  const { currentWeekCashback, claimingCashback, claimWeeklyCashback } = useVIPStore();
  const [countdown, setCountdown] = useState('');
  const [claimMsg, setClaimMsg] = useState('');
  const [claimErr, setClaimErr] = useState('');

  // Live countdown tick
  useEffect(() => {
    const target = nextSundayEAT();
    const tick = () => {
      const ms = target.getTime() - Date.now();
      setCountdown(formatCountdown(ms));
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  async function handleClaim() {
    setClaimMsg('');
    setClaimErr('');
    const result = await claimWeeklyCashback(userId);
    if (result.ok) {
      // Sync balance in game store
      import('../store/gameStore').then(({ useGameStore }) => {
        useGameStore.setState((s) => ({
          balance: Math.round((s.balance + result.amount) * 100) / 100,
        }));
      });
      setClaimMsg(`Weekly cashback of ${fmtKES(result.amount)} has been credited to your wallet.`);
      setTimeout(() => setClaimMsg(''), 6000);
    } else {
      setClaimErr(result.error ?? 'Failed to claim. Please try again.');
      setTimeout(() => setClaimErr(''), 5000);
    }
  }

  const wc = currentWeekCashback;
  const isReady    = wc?.status === 'READY_TO_CLAIM';
  const isClaimed  = wc?.status === 'CLAIMED';
  const isAccum    = !wc || wc.status === 'ACCUMULATING';
  const amount     = wc?.cashbackAmount ?? 0;
  const sColor     = statusColor(wc?.status);

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'rgba(255,215,0,0.06)',
        border: '1px solid rgba(255,215,0,0.2)',
      }}
    >
      {/* ── Header row ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-orbitron text-[10px] tracking-[0.25em] uppercase mb-1"
            style={{ color: sColor }}>
            {statusLabel(wc)}
          </p>

          {/* Amount */}
          <p className="font-orbitron text-3xl font-black text-yellow-400 leading-tight">
            {isAccum ? (
              <span className="text-xl text-yellow-400/40">accumulating…</span>
            ) : (
              fmtKES(amount)
            )}
          </p>

          {/* Rate + description */}
          <p className="text-white/30 text-xs mt-1 font-orbitron">
            {cashbackRate}% of eligible weekly net losses
          </p>

          {/* Next calculation */}
          <p className="text-white/25 text-[10px] mt-0.5 font-orbitron">
            {isClaimed
              ? 'Claimed this week'
              : `Next calculation: Sunday, 23:59 EAT`}
          </p>

          {/* Countdown — only while accumulating */}
          {(isAccum || (wc && !isClaimed)) && countdown && (
            <p className="text-white/20 text-[10px] mt-0.5 font-orbitron">
              Next cashback calculation in {countdown}
            </p>
          )}
        </div>

        {/* ── Claim button ── */}
        <div className="shrink-0 flex flex-col items-end gap-2">
          <motion.button
            onClick={handleClaim}
            disabled={!isReady || claimingCashback}
            whileTap={isReady ? { scale: 0.95 } : {}}
            className="px-5 py-3 rounded-xl font-orbitron text-sm font-bold tracking-widest text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
            style={{
              background: isClaimed
                ? 'rgba(74,222,128,0.2)'
                : 'linear-gradient(135deg, #FFD700, #FFA500)',
              boxShadow: isReady ? '0 0 16px rgba(255,215,0,0.4)' : 'none',
              color: isClaimed ? '#4ade80' : '#000',
              border: isClaimed ? '1px solid rgba(74,222,128,0.4)' : 'none',
            }}
          >
            {claimingCashback && (
              <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
            )}
            {isClaimed ? 'CLAIMED' : claimingCashback ? 'CLAIMING...' : 'CLAIM'}
          </motion.button>

          {/* Tier badge */}
          <span
            className="text-[9px] font-orbitron px-2 py-0.5 rounded-full uppercase tracking-widest"
            style={{ background: `${tierColor}22`, color: tierColor, border: `1px solid ${tierColor}44` }}
          >
            {tierLabel}
          </span>
        </div>
      </div>

      {/* ── Net loss detail (when ready or claimed) ── */}
      {wc && (wc.status === 'READY_TO_CLAIM' || wc.status === 'CLAIMED') && (
        <div
          className="mt-4 pt-4 border-t grid grid-cols-3 gap-2 text-center"
          style={{ borderColor: 'rgba(255,215,0,0.12)' }}
        >
          {[
            { label: 'Eligible Bets',    value: fmtKES(wc.eligibleBets) },
            { label: 'Eligible Payouts', value: fmtKES(wc.eligiblePayouts) },
            { label: 'Net Loss',         value: fmtKES(wc.eligibleNetLoss) },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-white/25 text-[9px] font-orbitron uppercase tracking-widest">{item.label}</p>
              <p className="text-white/60 text-xs font-orbitron font-bold mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Success / error messages ── */}
      <AnimatePresence>
        {claimMsg && (
          <motion.p
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-green-400 text-xs font-orbitron mt-3"
          >
            ✓ {claimMsg}
          </motion.p>
        )}
        {claimErr && (
          <motion.p
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-red-400 text-xs font-orbitron mt-3"
          >
            ✕ {claimErr}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
