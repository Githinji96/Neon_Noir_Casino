/**
 * LuckyWheelGame — Neon Lucky Wheel (single-phase).
 *
 * Segment geometry contract
 * ─────────────────────────
 * The SVG is drawn so that segment[0] occupies [−90°, −90° + deg) in SVG
 * space, i.e. it starts at the top (12 o'clock) and arcs clockwise.
 * CSS `transform: rotate(R deg)` rotates the WHEEL clockwise by R degrees.
 *
 * To land segment[i] under the top pointer the wheel's zero-position must
 * be rotated so that segment[i]'s midpoint sits at 0° (top).
 *
 * Midpoint of segment[i] in the wheel's own frame (measured clockwise
 * from top):  mid_i = i * deg + deg/2
 *
 * Required additional clockwise rotation to bring mid_i to top:
 *   Δ = (360 − mid_i) mod 360
 *
 * Full target (with minimum 5 extra spins for visual effect):
 *   target = floor(prevAngle / 360) * 360   ← strip fractional turns
 *            + ceil(prevAngle / 360) * 360   ← ensure we go forward
 *            + 5 * 360                       ← extra spins
 *            + Δ                             ← land on winner
 *
 * Implemented cleanly as:
 *   target = prevAngle
 *            + (360 − (prevAngle % 360))     ← complete the current partial turn
 *            + 5 * 360                        ← 5 full spins
 *            + Δ                              ← winner offset
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useMiniGameStore } from '../../../store/miniGameStore';
import MiniGameLayout from '../MiniGameLayout';
import type { MiniGameConfig, MiniGameOutcome, PrizeTier } from '../../../types/miniGames';

// ---------------------------------------------------------------------------
// Colour palette — one per segment, cycles for large wheels
// ---------------------------------------------------------------------------
const SEGMENT_COLORS = [
  '#FFD700', '#a855f7', '#06b6d4', '#ec4899',
  '#22c55e', '#f97316', '#3b82f6', '#ef4444',
  '#84cc16', '#8b5cf6', '#14b8a6', '#f59e0b',
];
const DARK_SEGMENT_COLORS = [
  'rgba(255,215,0,0.18)',  'rgba(168,85,247,0.18)', 'rgba(6,182,212,0.18)',
  'rgba(236,72,153,0.18)', 'rgba(34,197,94,0.18)',  'rgba(249,115,22,0.18)',
  'rgba(59,130,246,0.18)', 'rgba(239,68,68,0.18)',  'rgba(132,204,22,0.18)',
  'rgba(139,92,246,0.18)', 'rgba(20,184,166,0.18)', 'rgba(245,158,11,0.18)',
];

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function degPerSegment(count: number): number {
  return 360 / count;
}

/**
 * Compute the clockwise CSS rotation (degrees) that stops segment[winIndex]
 * under the top pointer, starting from prevAngle.
 *
 * Rules:
 *  - Always increases (never decreases) — CSS transitions require this.
 *  - At least 5 full extra rotations for visual effect.
 *  - The winner's midpoint ends exactly at 0° (top).
 */
function computeTargetRotation(
  winIndex: number,
  segCount: number,
  prevAngle: number,
): number {
  const deg   = degPerSegment(segCount);
  const mid_i = winIndex * deg + deg / 2;          // midpoint of winner in wheel frame
  const delta = (360 - mid_i + 360) % 360;         // extra CW rotation needed

  // Bring prevAngle up to the next full 360° boundary, then add 5 spins + delta
  const remainder     = prevAngle % 360;
  const toNextFullRev = remainder === 0 ? 0 : (360 - remainder);
  return prevAngle + toNextFullRev + 5 * 360 + delta;
}

// Spin duration scales mildly with segment count, fixed base of 4 s
const SPIN_DURATION_S = (segCount: number) => 4 + segCount * 0.05;

// ---------------------------------------------------------------------------
// WheelSVG
// ---------------------------------------------------------------------------
interface WheelSVGProps {
  tiers:          PrizeTier[];
  segmentCount:   number;
  rotation:       number;    // cumulative clockwise degrees
  spinning:       boolean;
  isLanding:      boolean;   // true = final landing spin (ease-out), false = preview (linear)
  winIndex:       number | null;   // highlight winner after animation
  onTransitionEnd: () => void;
}

function WheelSVG({
  tiers, segmentCount, rotation, spinning, winIndex, onTransitionEnd,
}: WheelSVGProps) {
  const SIZE   = 220;
  const RADIUS = 100;
  const CX     = SIZE / 2;
  const CY     = SIZE / 2;  const deg    = degPerSegment(segmentCount);
  const degRad = (Math.PI / 180) * deg;

  // SVG arc path for one pie slice
  function slicePath(startDeg: number): string {
    const startRad = (startDeg - 90) * (Math.PI / 180);
    const endRad   = startRad + degRad;
    const x1 = CX + RADIUS * Math.cos(startRad);
    const y1 = CY + RADIUS * Math.sin(startRad);
    const x2 = CX + RADIUS * Math.cos(endRad);
    const y2 = CY + RADIUS * Math.sin(endRad);
    return `M ${CX} ${CY} L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${deg > 180 ? 1 : 0} 1 ${x2} ${y2} Z`;
  }

  // Label positioned at the midpoint of each slice, rotated to read outward
  function labelTransform(idx: number): string {
    const midDeg = idx * deg + deg / 2;
    const midRad = (midDeg - 90) * (Math.PI / 180);
    const lx = CX + RADIUS * 0.64 * Math.cos(midRad);
    const ly = CY + RADIUS * 0.64 * Math.sin(midRad);
    return `translate(${lx},${ly}) rotate(${midDeg})`;
  }

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      className="relative flex items-center justify-center select-none w-full"
      style={{ maxWidth: SIZE, margin: '0 auto' }}
      aria-label="Lucky wheel"
      role="img"
    >
      {/* Fixed pointer at top */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', top: -12, left: '50%',
          transform: 'translateX(-50%)',
          width: 0, height: 0,
          borderLeft: '11px solid transparent',
          borderRight: '11px solid transparent',
          borderTop: '24px solid #FFD700',
          zIndex: 10,
          filter: 'drop-shadow(0 0 8px rgba(255,215,0,1))',
        }}
      />

      {/* Spinning wheel — responsive SVG */}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning && !prefersReducedMotion
            ? /* Single uniform spin — linear throughout */
              `transform ${SPIN_DURATION_S(segmentCount)}s linear`
            : 'none',
          borderRadius: '50%',
          boxShadow: '0 0 32px rgba(168,85,247,0.55)',
          display: 'block',
        }}
        onTransitionEnd={(e) => {
          // Guard: only respond to the transform transition on this SVG element
          if (e.propertyName === 'transform' && e.target === e.currentTarget) {
            onTransitionEnd();
          }
        }}
      >
        {Array.from({ length: segmentCount }, (_, i) => {
          const color     = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
          const darkColor = DARK_SEGMENT_COLORS[i % DARK_SEGMENT_COLORS.length];
          const tier      = tiers[i];
          const isWinner  = winIndex === i;
          return (
            <g key={i}>
              <path
                d={slicePath(i * deg)}
                fill={isWinner ? `${color}44` : darkColor}
                stroke={color}
                strokeWidth={isWinner ? 2.5 : 1.5}
              />
              {/* Winner glow ring */}
              {isWinner && (
                <path
                  d={slicePath(i * deg)}
                  fill="none"
                  stroke={color}
                  strokeWidth={4}
                  opacity={0.5}
                  style={{ filter: `drop-shadow(0 0 6px ${color})` }}
                />
              )}
              {tier && (
                <text
                  transform={labelTransform(i)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={segmentCount > 12 ? '7' : segmentCount > 8 ? '9' : '11'}
                  fontWeight="bold"
                  fontFamily="'Orbitron', monospace"
                  fill={color}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {tier.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Centre hub */}
        <circle cx={CX} cy={CY} r={20} fill="#050010" stroke="#FFD700" strokeWidth={3} />
        <circle cx={CX} cy={CY} r={9}  fill="#FFD700" />
      </svg>

      {/* Outer ring */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: -5, borderRadius: '50%',
          border: '2px solid rgba(168,85,247,0.4)',
          boxShadow: '0 0 24px rgba(168,85,247,0.3), inset 0 0 24px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResultOverlay — separate BET / MULTIPLIER / PAYOUT / NET RESULT rows
// ---------------------------------------------------------------------------
interface ResultOverlayProps {
  label:        string;
  multiplier:   number;
  stake:        number;
  grossPayout:  number;  // what the server credited (stake * multiplier)
  segmentColor: string;
}

function ResultOverlay({ label, multiplier, stake, grossPayout, segmentColor }: ResultOverlayProps) {
  const netResult = grossPayout - stake;
  // Win = multiplier ≥ 1 (player gets stake back or more)
  // Loss = multiplier < 1 (player gets less than their stake back, including 0x)
  const isWin = multiplier >= 1;

  const borderCol = isWin ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.35)';
  const bgCol     = isWin ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)';
  const netCol    = isWin ? '#22c55e' : '#ef4444';

  return (
    <div
      className="w-full rounded-xl p-3 text-center"
      style={{ background: bgCol, border: `1px solid ${borderCol}` }}
      role="status"
      aria-live="polite"
      aria-label="Spin result"
    >
      {/* Tier badge */}
      <div
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-2.5 font-orbitron font-bold text-xs uppercase tracking-widest"
        style={{
          background: `${segmentColor}22`,
          border: `2px solid ${segmentColor}`,
          color: segmentColor,
          boxShadow: `0 0 14px ${segmentColor}55`,
        }}
      >
        {label}
      </div>

      {/* Breakdown table */}
      <div className="flex flex-col gap-1 text-left">
        <div className="flex justify-between items-center">
          <span className="font-orbitron text-xs uppercase tracking-wider" style={{ color: 'rgba(156,163,175,0.55)' }}>Bet</span>
          <span className="font-orbitron font-bold text-xs" style={{ color: '#e5e7eb' }}>KES {stake.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-orbitron text-xs uppercase tracking-wider" style={{ color: 'rgba(156,163,175,0.55)' }}>Multiplier</span>
          <span className="font-orbitron font-bold text-xs" style={{ color: segmentColor }}>{multiplier.toFixed(2)}×</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-orbitron text-xs uppercase tracking-wider" style={{ color: 'rgba(156,163,175,0.55)' }}>Payout</span>
          <span className="font-orbitron font-bold text-xs" style={{ color: '#e5e7eb' }}>KES {grossPayout.toFixed(2)}</span>
        </div>
        <div
          className="flex justify-between items-center pt-1 mt-0.5"
          style={{ borderTop: '1px solid rgba(168,85,247,0.15)' }}
        >
          <span className="font-orbitron text-xs uppercase tracking-wider" style={{ color: 'rgba(156,163,175,0.55)' }}>Net Result</span>
          <span className="font-orbitron font-bold text-sm" style={{ color: netCol }}>
            {netResult >= 0 ? '+' : ''}KES {netResult.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Outcome message */}
      <p
        className="mt-2 font-orbitron text-xs uppercase tracking-widest"
        style={{ color: netCol }}
      >
        {isWin ? (multiplier === 1 ? '↩️ Stake returned' : '🎉 You won!') : '🍀 Better luck next time'}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function LuckyWheelGame({
  gameId,
  config,
  userId,
}: {
  gameId: 'lucky-wheel';
  config: MiniGameConfig;
  userId: string;
}) {
  const submitRound  = useMiniGameStore((s) => s.submitRound);
  const roundPhase   = useMiniGameStore((s) => s.roundPhase);
  const currentRound = useMiniGameStore((s) => s.currentRound);

  // Segment count is ALWAYS driven by prize_tiers.length so the visual
  // segments always match the server-side tier indices exactly.
  // game_specific_rules.segment_count is ignored — it was the source of
  // off-by-one mismatches when the DB config and tiers were out of sync.
  const segmentCount = Math.min(20, Math.max(2, config.prize_tiers.length));
  const tiers = config.prize_tiers.slice(0, segmentCount);

  // ── State ────────────────────────────────────────────────────────────────────
  // cumulativeAngle only ever increases — CSS transitions require monotonically
  // increasing values.
  const cumulativeAngle = useRef<number>(0);
  const [rotation, setRotation]     = useState<number>(0);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [animDone, setAnimDone]     = useState<boolean>(false);

  // ── Server outcome ───────────────────────────────────────────────────────────
  const outcome     = currentRound?.outcome as MiniGameOutcome | null | undefined;
  const grossPayout = currentRound?.payout ?? null;
  const stake       = currentRound?.stake ?? config.min_bet;

  // ── Single spin: fires once when the result arrives ──────────────────────────
  // No preview spin — one uniform linear spin from current angle to winner.
  useEffect(() => {
    if (roundPhase === 'result' && outcome != null && !animDone) {
      const target = computeTargetRotation(
        outcome.segment_index,
        segmentCount,
        cumulativeAngle.current,
      );
      cumulativeAngle.current = target;
      setRotation(target);
      setIsSpinning(true);

      // Fallback timeout in case transitionend never fires
      const fallbackMs = (SPIN_DURATION_S(segmentCount) + 1.5) * 1000;
      const timer = setTimeout(() => {
        setIsSpinning(false);
        setAnimDone(true);
      }, fallbackMs);

      return () => clearTimeout(timer);
    }
  }, [roundPhase, outcome, segmentCount, animDone]);

  // ── Reset on idle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (roundPhase === 'idle') {
      setIsSpinning(false);
      setAnimDone(false);
    }
  }, [roundPhase]);

  const handleTransitionEnd = useCallback(() => {
    setIsSpinning(false);
    setAnimDone(true);
  }, []);

  // ── Action ───────────────────────────────────────────────────────────────────
  const handleAction = (stake: number) => {
    if (roundPhase !== 'idle' && roundPhase !== 'error') return;
    setAnimDone(false);
    void submitRound(userId, stake);
  };

  // ── Derived display values ────────────────────────────────────────────────────
  const showResult =
    roundPhase === 'result' && animDone && outcome != null && grossPayout != null;

  // Highlight the winning segment only after animation completes
  const displayedWinIndex = showResult ? outcome!.segment_index : null;
  const segmentColor = SEGMENT_COLORS[
    (outcome?.segment_index ?? 0) % SEGMENT_COLORS.length
  ];

  const resultContent = showResult ? (
    <ResultOverlay
      label={outcome!.label}
      multiplier={outcome!.multiplier}
      stake={stake}
      grossPayout={grossPayout!}
      segmentColor={segmentColor}
    />
  ) : undefined;

  return (
    <MiniGameLayout
      gameId={gameId}
      config={config}
      userId={userId}
      actionLabel={isSpinning ? 'SPINNING…' : roundPhase === 'processing' ? 'SPINNING…' : roundPhase === 'result' && !animDone ? 'SPINNING…' : 'SPIN'}
      onAction={handleAction}
      resultContent={resultContent}
    >
      {/* Screen-reader live region — visually hidden, doesn't affect layout */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {showResult
          ? `Spin result: ${outcome!.label}, ${outcome!.multiplier.toFixed(2)} times multiplier, ` +
            `gross payout KES ${grossPayout!.toFixed(2)}, ` +
            `net result KES ${(grossPayout! - stake).toFixed(2)}, ` +
            `${outcome!.multiplier >= 1 ? outcome!.multiplier === 1 ? 'stake returned' : 'you won' : 'better luck next time'}`
          : ''}
      </div>

      {/* Wheel */}
      <div className="flex items-center justify-center py-2 px-2" style={{ pointerEvents: 'none' }}>
        <div style={{ width: '100%', maxWidth: 220, aspectRatio: '1', pointerEvents: 'auto' }}>
          <WheelSVG
            tiers={tiers}
            segmentCount={segmentCount}
            rotation={rotation}
            spinning={isSpinning}
            isLanding={true}
            winIndex={displayedWinIndex}
            onTransitionEnd={handleTransitionEnd}
          />
        </div>
      </div>
    </MiniGameLayout>
  );
}
