/**
 * MiniSlotGame component — three-reel slot mini game (single-phase).
 * Task 8.1 — Mini Jackpot Games spec
 * Requirements: 7.1–7.9
 *
 * Reel animation reuses the `reelSpin` / `reelSpinFast` keyframes defined
 * in `src/styles/index.css` (same pattern as GameCanvas.tsx). No keyframe
 * duplication — the global stylesheet already provides them.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useMiniGameStore } from '../../../store/miniGameStore';
import MiniGameLayout from '../MiniGameLayout';
import type { MiniGameConfig } from '../../../types/miniGames';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REEL_COUNT = 3;
const VISIBLE_ROWS = 3; // symbols visible per reel window
const CELL_SIZE = 56;   // px — reduced from 72 for compact layout
const ROW_GAP   = 4;    // px

// Stop stagger timings (milliseconds) — mirrors GameCanvas pattern
const STOP_BASE = 1000;  // first reel stops at
const STOP_GAP  = 300;   // each subsequent reel stops this much later

// Spin duration for the CSS animation
const SPIN_DUR = '0.40s';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SlotOutcome {
  reels: string[];           // e.g. ["🍒","🍒","🍒"]
  payline?: string;          // e.g. "top"
  win_key?: string;          // e.g. "three_cherries"
  multiplier?: number;       // e.g. 5.0 — present when there is a win
}

interface GameSpecificRules {
  reel_symbols?: string[];
  wild_enabled?: boolean;
  bonus_enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive reel symbol pool from config; fall back to a sensible default set */
function getReelSymbols(rules: GameSpecificRules): string[] {
  if (rules.reel_symbols && rules.reel_symbols.length > 0) {
    return rules.reel_symbols;
  }
  return ['🍒', '🍋', '🍊', '⭐', '💎', '🔔', '7️⃣'];
}

/** Shuffle an array in place (Fisher-Yates) and return it */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Build a reel strip of length `stripLength` ending with `targetSymbol`
 * at the centre row (index 1). The strip is used both for the spinning
 * visual (top overflow symbols) and the final display.
 */
function buildReelStrip(symbols: string[], targetSymbol: string, stripLength: number): string[] {
  // Fill with random symbols, then place target at the "landing" position
  const pool = shuffle([...symbols, ...symbols, ...symbols]);
  const strip = pool.slice(0, stripLength);
  // The visible window shows indices [strip.length - VISIBLE_ROWS, strip.length - 1]
  // We want the centre row (VISIBLE_ROWS/2 offset from end) to show targetSymbol
  const targetIdx = strip.length - Math.floor(VISIBLE_ROWS / 2) - 1;
  strip[targetIdx] = targetSymbol;
  return strip;
}

// ---------------------------------------------------------------------------
// ReelColumn — single reel with CSS animation
// ---------------------------------------------------------------------------

interface ReelColumnProps {
  symbols: string[];       // what to display (final state)
  spinning: boolean;
  isWin: boolean;          // true if this reel contributes to a payline win
  targetSymbol: string;    // final symbol to land on (centre row)
  reelSymbols: string[];   // full symbol pool for scramble effect
}

function ReelColumn({ symbols, spinning, isWin, targetSymbol, reelSymbols }: ReelColumnProps) {
  const visH = VISIBLE_ROWS * CELL_SIZE + (VISIBLE_ROWS - 1) * ROW_GAP;
  const step = -(CELL_SIZE + ROW_GAP);

  const animName = spinning ? 'reelSpin' : '';
  // Key the div on animName so React restarts the animation on spin start/stop
  const animKey = `${animName}-${targetSymbol}`;

  // While spinning, build a randomised strip; when stopped, show the 3 final symbols
  const displaySymbols = spinning
    ? buildReelStrip(reelSymbols, targetSymbol, VISIBLE_ROWS + 2)
    : symbols;

  return (
    <div
      style={{
        width: CELL_SIZE,
        height: visH,
        overflow: 'hidden',
        borderRadius: 10,
        position: 'relative',
        background: '#080814',
        border: isWin
          ? '2px solid rgba(255,215,0,0.85)'
          : '1px solid rgba(168,85,247,0.3)',
        boxShadow: isWin
          ? '0 0 18px rgba(255,215,0,0.45), inset 0 0 10px rgba(255,215,0,0.08)'
          : '0 0 8px rgba(0,0,0,0.6)',
        // CSS variable consumed by the global reelSpin keyframes
        ['--reel-step' as string]: `${step}px`,
      }}
    >
      {/* Spinning or static strip */}
      <div
        key={animKey}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: ROW_GAP,
          animation: spinning
            ? `${animName} ${SPIN_DUR} linear infinite`
            : undefined,
          willChange: spinning ? 'transform' : undefined,
        }}
      >
        {displaySymbols.map((sym, i) => (
          <SymbolCell key={i} symbol={sym} isWin={isWin && !spinning} size={CELL_SIZE} />
        ))}
      </div>

      {/* Gold top accent line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: 'rgba(255,215,0,0.5)',
          borderRadius: '10px 10px 0 0',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SymbolCell — single symbol tile
// ---------------------------------------------------------------------------

interface SymbolCellProps {
  symbol: string;
  isWin: boolean;
  size: number;
}

function SymbolCell({ symbol, isWin, size }: SymbolCellProps) {
  const fs = Math.floor(size * 0.50);
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        background: '#0d0d1e',
        fontSize: fs,
        lineHeight: 1,
        userSelect: 'none',
        animation: isWin ? 'symbolPulse 0.6s ease-in-out infinite alternate' : undefined,
        transition: 'opacity 0.2s',
      }}
    >
      {symbol}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PaylineIndicator — visualises the active payline row
// ---------------------------------------------------------------------------

function PaylineIndicator({ payline }: { payline: string | undefined }) {
  if (!payline) return null;

  const label =
    payline === 'top'    ? 'Top'    :
    payline === 'middle' ? 'Middle' :
    payline === 'bottom' ? 'Bottom' :
    payline;

  return (
    <div
      className="flex items-center gap-2 justify-center mt-2"
      aria-label={`Active payline: ${label}`}
    >
      <div style={{ width: 24, height: 2, background: 'rgba(255,215,0,0.7)', borderRadius: 1 }} />
      <span
        className="font-orbitron text-xs uppercase tracking-widest"
        style={{ color: 'rgba(255,215,0,0.7)' }}
      >
        {label} line
      </span>
      <div style={{ width: 24, height: 2, background: 'rgba(255,215,0,0.7)', borderRadius: 1 }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// WildBonusTag — badge showing which special features are enabled
// ---------------------------------------------------------------------------

function WildBonusTag({ wildEnabled, bonusEnabled }: { wildEnabled: boolean; bonusEnabled: boolean }) {
  if (!wildEnabled && !bonusEnabled) return null;

  return (
    <div className="flex items-center gap-2 justify-center mt-3 flex-wrap">
      {wildEnabled && (
        <span
          className="font-orbitron text-xs px-2 py-0.5 rounded-full"
          style={{
            background: 'rgba(168,85,247,0.2)',
            border: '1px solid rgba(168,85,247,0.5)',
            color: '#a855f7',
            letterSpacing: '0.05em',
          }}
        >
          WILD active
        </span>
      )}
      {bonusEnabled && (
        <span
          className="font-orbitron text-xs px-2 py-0.5 rounded-full"
          style={{
            background: 'rgba(6,182,212,0.15)',
            border: '1px solid rgba(6,182,212,0.4)',
            color: '#06b6d4',
            letterSpacing: '0.05em',
          }}
        >
          BONUS active
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SlotResultContent — result panel shown when roundPhase === 'result'
// ---------------------------------------------------------------------------

interface SlotResultContentProps {
  outcome: SlotOutcome;
  stake: number;
  payout: number;
  wildEnabled: boolean;
  bonusEnabled: boolean;
}

function SlotResultContent({ outcome, stake, payout, wildEnabled, bonusEnabled }: SlotResultContentProps) {
  const isWin = payout > 0 && outcome.win_key !== undefined && outcome.win_key !== '';
  const isBonus = bonusEnabled && outcome.win_key?.includes('bonus');
  const isWild  = wildEnabled  && outcome.reels?.some((s) => s === '🃏' || s === '⭐');

  return (
    <div
      className="w-full rounded-lg py-3 px-4"
      style={{
        background: isWin
          ? 'rgba(34,197,94,0.08)'
          : 'rgba(239,68,68,0.06)',
        border: `1px solid ${isWin ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}`,
      }}
      aria-label="Slot round result"
    >
      {isWin ? (
        <>
          {/* Win banner */}
          <p
            className="font-orbitron font-bold text-center uppercase tracking-widest mb-2"
            style={{ color: '#22c55e', fontSize: '0.95rem' }}
            aria-live="polite"
          >
            🎉 You Win!
          </p>

          {/* Win combination */}
          {outcome.reels && (
            <div className="flex justify-center gap-3 mb-2">
              {outcome.reels.map((sym, i) => (
                <span key={i} style={{ fontSize: 24 }}>{sym}</span>
              ))}
            </div>
          )}

          {/* Payline info */}
          {outcome.payline && (
            <p
              className="font-orbitron text-xs text-center uppercase tracking-widest mb-1"
              style={{ color: 'rgba(255,215,0,0.7)' }}
            >
              Payline: {outcome.payline}
            </p>
          )}

          {/* Win key (prize combination name) */}
          {outcome.win_key && (
            <p
              className="text-xs text-center mb-2"
              style={{ color: 'rgba(156,163,175,0.7)' }}
            >
              {outcome.win_key.replace(/_/g, ' ')}
            </p>
          )}

          {/* Wild / Bonus labels */}
          {isWild && (
            <p className="text-xs text-center mb-1" style={{ color: '#a855f7' }}>
              🃏 Wild substitution applied
            </p>
          )}
          {isBonus && (
            <p className="text-xs text-center mb-1" style={{ color: '#06b6d4' }}>
              ✨ Bonus outcome triggered
            </p>
          )}

          {/* Payout formula */}
          {outcome.multiplier !== undefined && (
            <p
              className="font-orbitron font-bold text-center text-sm mt-2"
              style={{ color: '#22c55e' }}
            >
              {outcome.multiplier.toFixed(2)}x × KES {stake.toFixed(2)} = KES {payout.toFixed(2)}
            </p>
          )}
        </>
      ) : (
        <>
          {/* No-win */}
          <p
            className="font-orbitron font-bold text-center uppercase tracking-widest mb-2"
            style={{ color: '#ef4444', fontSize: '0.9rem' }}
            aria-live="polite"
          >
            No Win
          </p>
          {outcome.reels && (
            <div className="flex justify-center gap-3">
              {outcome.reels.map((sym, i) => (
                <span key={i} style={{ fontSize: 24, opacity: 0.5 }}>{sym}</span>
              ))}
            </div>
          )}
          <p
            className="text-xs text-center mt-2"
            style={{ color: 'rgba(156,163,175,0.5)' }}
          >
            Better luck next spin
          </p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SlotReels — animated 3-reel display
// ---------------------------------------------------------------------------

interface SlotReelsProps {
  finalSymbols: string[];         // length === 3, the landed symbols
  reelSymbols: string[];          // full pool
  spinning: boolean;
  spinningReels: boolean[];       // per-reel spinning state
  hasWin: boolean;
}

function SlotReels({ finalSymbols, reelSymbols, spinning, spinningReels, hasWin }: SlotReelsProps) {
  // Build 3-row display columns from final symbols
  // Each reel shows the landing symbol in the centre row; top/bottom are adjacent symbols
  const buildVisibleSymbols = (sym: string): string[] => {
    const pool = reelSymbols.length > 0 ? reelSymbols : ['🎰'];
    const before = pool[Math.floor(Math.random() * pool.length)];
    const after  = pool[Math.floor(Math.random() * pool.length)];
    return [before, sym, after];
  };

  return (
    <div
      className="flex justify-center items-center gap-3 py-4"
      role="img"
      aria-label="Slot machine reels"
    >
      {Array.from({ length: REEL_COUNT }, (_, col) => {
        const sym = finalSymbols[col] ?? reelSymbols[0] ?? '🎰';
        const isSpinning = spinningReels[col] ?? spinning;
        const isWin = hasWin && !spinning && !isSpinning;

        return (
          <ReelColumn
            key={col}
            symbols={buildVisibleSymbols(sym)}
            spinning={isSpinning}
            isWin={isWin}
            targetSymbol={sym}
            reelSymbols={reelSymbols}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MiniSlotGame — main exported component
// ---------------------------------------------------------------------------

interface MiniSlotGameProps {
  gameId: 'mini-slot';
  config: MiniGameConfig;
  userId: string;
}

export default function MiniSlotGame({ gameId, config, userId }: MiniSlotGameProps) {
  const submitRound  = useMiniGameStore((s) => s.submitRound);
  const roundPhase   = useMiniGameStore((s) => s.roundPhase);
  const currentRound = useMiniGameStore((s) => s.currentRound);

  // ── Config-derived values ────────────────────────────────────────────────
  const rules       = config.game_specific_rules as GameSpecificRules;
  const reelSymbols = getReelSymbols(rules);
  const wildEnabled  = rules.wild_enabled  ?? false;
  const bonusEnabled = rules.bonus_enabled ?? false;

  // ── Outcome parsing ──────────────────────────────────────────────────────
  const outcome: SlotOutcome | null =
    roundPhase === 'result' && currentRound?.outcome != null
      ? (currentRound.outcome as SlotOutcome)
      : null;

  const payout  = currentRound?.payout  ?? 0;
  const stake   = currentRound?.stake   ?? config.min_bet;

  // Determine what the final reel symbols should be
  const finalSymbols: string[] =
    outcome?.reels?.length === REEL_COUNT
      ? outcome.reels
      : Array.from({ length: REEL_COUNT }, () => reelSymbols[0] ?? '🎰');

  const hasWin = outcome != null && outcome.win_key != null && outcome.win_key !== '' && payout > 0;

  // ── Animation state ──────────────────────────────────────────────────────
  const [isAnimating, setIsAnimating]       = useState(false);
  const [spinningReels, setSpinningReels]   = useState<boolean[]>(Array(REEL_COUNT).fill(false));
  const stopTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // When roundPhase transitions to 'result', trigger the staggered stop animation
  const prevPhaseRef = useRef(roundPhase);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = roundPhase;

    if (prev === 'processing' && roundPhase === 'result') {
      // Start spinning all reels immediately
      setIsAnimating(true);
      setSpinningReels(Array(REEL_COUNT).fill(true));

      // Clear any existing timers
      stopTimers.current.forEach(clearTimeout);
      stopTimers.current = [];

      // Stagger each reel's stop
      let stoppedCount = 0;
      for (let col = 0; col < REEL_COUNT; col++) {
        const t = setTimeout(() => {
          setSpinningReels((prev) => {
            const next = [...prev];
            next[col] = false;
            return next;
          });
          stoppedCount++;
          if (stoppedCount === REEL_COUNT) {
            setIsAnimating(false);
          }
        }, STOP_BASE + col * STOP_GAP);
        stopTimers.current.push(t);
      }
    }

    if (roundPhase === 'idle') {
      // Reset animation state on Play Again — clear any pending stagger timers first
      stopTimers.current.forEach(clearTimeout);
      stopTimers.current = [];
      setIsAnimating(false);
      setSpinningReels(Array(REEL_COUNT).fill(false));
    }

    return () => {
      stopTimers.current.forEach(clearTimeout);
      stopTimers.current = [];
    };
  }, [roundPhase]);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      stopTimers.current.forEach(clearTimeout);
    };
  }, []);

  // ── Action handler ───────────────────────────────────────────────────────
  const handleSpin = useCallback((stake: number) => {
    if (roundPhase !== 'idle' && roundPhase !== 'error') return;
    void submitRound(userId, stake);
  }, [roundPhase, submitRound, userId]);

  // ── Symbols visible in the reel area ─────────────────────────────────────
  // While idle/processing, show default symbols (or whatever is on screen)
  const displaySymbols: string[] =
    roundPhase === 'result' || isAnimating
      ? finalSymbols
      : Array.from({ length: REEL_COUNT }, () => reelSymbols[0] ?? '🎰');

  // ── Result content passed to MiniGameLayout ──────────────────────────────
  // Only show result panel after animation completes (no more spinning reels)
  const allStopped = spinningReels.every((s) => !s);
  const resultContent =
    roundPhase === 'result' && outcome != null && allStopped ? (
      <SlotResultContent
        outcome={outcome}
        stake={stake}
        payout={payout}
        wildEnabled={wildEnabled}
        bonusEnabled={bonusEnabled}
      />
    ) : undefined;

  // ── Payline info (shown below reels) ─────────────────────────────────────
  const showPayline = roundPhase === 'result' && outcome != null && allStopped;

  return (
    <MiniGameLayout
      gameId={gameId}
      config={config}
      userId={userId}
      actionLabel="SPIN"
      onAction={handleSpin}
      resultContent={resultContent}
    >
      {/* ── Reel area ──────────────────────────────────────────────────── */}
      <div
        className="rounded-xl py-2 px-3 mb-1"
        style={{
          background: 'rgba(8,8,20,0.9)',
          border: '1px solid rgba(168,85,247,0.25)',
          boxShadow: hasWin && allStopped
            ? '0 0 28px rgba(255,215,0,0.35)'
            : undefined,
        }}
      >
        {/* Title strip */}
        <div className="flex items-center justify-center mb-1">
          <span
            className="font-orbitron text-xs uppercase tracking-widest"
            style={{ color: 'rgba(255,215,0,0.5)' }}
          >
            Mini Slot Jackpot
          </span>
        </div>

        {/* 3-reel display */}
        <SlotReels
          finalSymbols={displaySymbols}
          reelSymbols={reelSymbols}
          spinning={isAnimating}
          spinningReels={spinningReels}
          hasWin={hasWin && allStopped}
        />

        {/* Payline indicator */}
        {showPayline && (
          <PaylineIndicator payline={outcome?.payline} />
        )}

        {/* Wild / Bonus feature badges */}
        <WildBonusTag wildEnabled={wildEnabled} bonusEnabled={bonusEnabled} />
      </div>
    </MiniGameLayout>
  );
}
