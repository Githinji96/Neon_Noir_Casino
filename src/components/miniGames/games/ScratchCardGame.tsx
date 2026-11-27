/**
 * ScratchCardGame component — two-phase scratch card mini game.
 * Task 11.1 — Mini Jackpot Games spec
 * Requirements: 5.1–5.7
 *
 * Flow:
 *   Phase 1 (initiateRound): player sets bet → presses SCRATCH CARD → stake debited,
 *     server stores predetermined outcome → roundPhase = 'betting'. Card surface
 *     becomes interactive (scratch canvas enabled).
 *   Phase 2 (claimResult):   player scratches >50% of canvas surface → claimResult
 *     called automatically → roundPhase = 'result'. Outcome and payout revealed.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMiniGameStore } from '../../../store/miniGameStore';
import MiniGameLayout from '../MiniGameLayout';
import type { MiniGameConfig } from '../../../types/miniGames';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Typed outcome payload returned by claim_mini_game_result for scratch cards */
interface ScratchOutcome {
  label: string;
  multiplier: number;
}

// ---------------------------------------------------------------------------
// Card design themes (Requirement 5.6)
// Design 0: Purple/neon  |  Design 1: Gold/cyan
// ---------------------------------------------------------------------------
interface CardDesign {
  primaryColor: string;
  secondaryColor: string;
  borderColor: string;
  glowColor: string;
  scratchLayerColor: string;
  scratchLayerAlt: string;
  label: string;
}

const CARD_DESIGNS: CardDesign[] = [
  {
    // Design 0 — Purple/neon theme
    primaryColor: '#a855f7',
    secondaryColor: '#7c3aed',
    borderColor: 'rgba(168,85,247,0.7)',
    glowColor: 'rgba(168,85,247,0.45)',
    scratchLayerColor: '#3d2b6b',
    scratchLayerAlt: '#4a3080',
    label: 'NEON',
  },
  {
    // Design 1 — Gold/cyan theme
    primaryColor: '#06b6d4',
    secondaryColor: '#0891b2',
    borderColor: 'rgba(6,182,212,0.7)',
    glowColor: 'rgba(255,215,0,0.45)',
    scratchLayerColor: '#1a3a4a',
    scratchLayerAlt: '#1e4558',
    label: 'GOLD',
  },
];

function getCardDesign(config: MiniGameConfig): CardDesign {
  const raw = config.game_specific_rules?.card_design;
  const idx = typeof raw === 'number' && raw >= 0 && raw < CARD_DESIGNS.length ? raw : 0;
  return CARD_DESIGNS[idx];
}

// ---------------------------------------------------------------------------
// RulesPanel — compact, displayed in idle state (Requirement 5.1)
// ---------------------------------------------------------------------------
function RulesPanel({ config }: { config: MiniGameConfig }) {
  const tiers = config.prize_tiers;
  const design = getCardDesign(config);

  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: `rgba(${hexToRgb(design.primaryColor)},0.06)`,
        border: `1px solid ${design.borderColor}`,
      }}
    >
      <p
        className="font-orbitron text-xs uppercase tracking-widest mb-2"
        style={{ color: `rgba(${hexToRgb(design.primaryColor)},0.7)` }}
      >
        Prize Tiers
      </p>

      {tiers.length > 0 && (
        <div
          className="overflow-hidden rounded-lg"
          style={{ border: `1px solid ${design.borderColor.replace('0.7', '0.2')}` }}
        >
          <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: '0.65rem' }}>
            <thead>
              <tr style={{ background: `rgba(${hexToRgb(design.primaryColor)},0.15)` }}>
                <th className="font-orbitron text-left py-1 px-2 uppercase tracking-wide" style={{ color: 'rgba(156,163,175,0.8)', fontWeight: 600 }}>Tier</th>
                <th className="font-orbitron text-center py-1 px-2 uppercase tracking-wide" style={{ color: 'rgba(156,163,175,0.8)', fontWeight: 600 }}>×</th>
                <th className="font-orbitron text-right py-1 px-2 uppercase tracking-wide" style={{ color: 'rgba(156,163,175,0.8)', fontWeight: 600 }}>%</th>
              </tr>
            </thead>
            <tbody>
              {tiers.slice(0, 5).map((tier, idx) => (
                <tr
                  key={idx}
                  style={{
                    background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : `rgba(${hexToRgb(design.primaryColor)},0.04)`,
                    borderTop: `1px solid rgba(${hexToRgb(design.primaryColor)},0.1)`,
                  }}
                >
                  <td className="py-1 px-2" style={{ color: '#e5e7eb' }}>
                    {tier.symbol ? `${tier.symbol} ` : ''}
                    {tier.label}
                  </td>
                  <td className="py-1 px-2 text-center font-orbitron font-bold" style={{ color: '#FFD700' }}>
                    {tier.multiplier.toFixed(1)}x
                  </td>
                  <td className="py-1 px-2 text-right" style={{ color: 'rgba(156,163,175,0.8)' }}>
                    {(tier.probability * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CardFace — the underneath card with mystery symbol or revealed prize
// ---------------------------------------------------------------------------
interface CardFaceProps {
  design: CardDesign;
  outcome: ScratchOutcome | null;
  payout: number | null;
  stake: number;
  phase: string;
}

function CardFace({ design, outcome, payout, stake, phase }: CardFaceProps) {
  const isResult = phase === 'result';
  const isWin = isResult && payout !== null && payout > stake;
  const resultBg = isWin
    ? 'rgba(34,197,94,0.12)'
    : isResult
    ? 'rgba(239,68,68,0.08)'
    : `rgba(${hexToRgb(design.primaryColor)},0.06)`;
  const resultBorder = isWin
    ? 'rgba(34,197,94,0.5)'
    : isResult
    ? 'rgba(239,68,68,0.4)'
    : design.borderColor;

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center rounded-xl select-none"
      style={{
        background: resultBg,
        border: `2px solid ${resultBorder}`,
        boxShadow: isResult
          ? `0 0 28px ${isWin ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.3)'}`
          : `0 0 24px ${design.glowColor}`,
      }}
      aria-hidden="true"
    >
      {!isResult ? (
        // Mystery state — pulsing "?"
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          className="flex flex-col items-center gap-1"
        >
          <span
            className="font-orbitron font-black"
            style={{ fontSize: '3rem', color: design.primaryColor, letterSpacing: '0.05em' }}
          >
            ?
          </span>
          <span
            className="font-orbitron text-xs uppercase tracking-widest"
            style={{ color: `rgba(${hexToRgb(design.primaryColor)},0.6)` }}
          >
            Scratch to Reveal
          </span>
        </motion.div>
      ) : (
        // Result state — show prize or loss
        <AnimatePresence>
          <motion.div
            key="reveal"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: 'backOut' }}
            className="flex flex-col items-center gap-2 px-4 text-center"
          >
            <span style={{ fontSize: '2.5rem' }} aria-hidden="true">
              {isWin ? '🏆' : '😔'}
            </span>
            {outcome ? (
              <>
                <p
                  className="font-orbitron font-bold"
                  style={{
                    color: isWin ? '#22c55e' : '#ef4444',
                    fontSize: '1.1rem',
                    letterSpacing: '0.05em',
                  }}
                >
                  {outcome.label}
                </p>
                <p
                  className="font-orbitron text-sm"
                  style={{ color: '#FFD700' }}
                >
                  {outcome.multiplier.toFixed(2)}x
                </p>
              </>
            ) : (
              <p className="font-orbitron text-sm" style={{ color: 'rgba(156,163,175,0.7)' }}>
                No prize this time
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScratchCanvas — HTML Canvas overlay that handles the scratch mechanic
// (Requirements 5.1, 5.3, 5.5)
// ---------------------------------------------------------------------------
interface ScratchCanvasProps {
  /** Width/height of the canvas in pixels */
  width: number;
  height: number;
  design: CardDesign;
  /** Whether scratching is allowed (only in 'betting' phase) */
  scratchEnabled: boolean;
  /** Called when coverage exceeds 50% — triggers Phase 2 */
  onReveal: () => void;
}

function ScratchCanvas({ width, height, design, scratchEnabled, onReveal }: ScratchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  /** Guard: ensure claimResult is called at most once per round */
  const claimedRef = useRef(false);
  /** Track whether the layer has been drawn for this phase */
  const layerDrawnRef = useRef(false);

  // Draw scratch layer when scratchEnabled becomes true (Phase 1 → betting)
  useEffect(() => {
    if (!scratchEnabled) {
      // Reset guard when a new round starts
      claimedRef.current = false;
      layerDrawnRef.current = false;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || layerDrawnRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw gradient scratch layer
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, design.scratchLayerColor);
    gradient.addColorStop(1, design.scratchLayerAlt);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Decorative stripe pattern
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = design.primaryColor;
    for (let x = 0; x < width; x += 16) {
      ctx.fillRect(x, 0, 6, height);
    }
    ctx.globalAlpha = 1;

    // "SCRATCH HERE" text hint
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(${hexToRgb(design.primaryColor)},0.55)`;
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✦ SCRATCH HERE ✦', width / 2, height / 2);

    layerDrawnRef.current = true;
  }, [scratchEnabled, width, height, design]);

  // Compute coverage ratio — sample every 4th pixel for performance
  const computeCoverage = useCallback((): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    const imageData = ctx.getImageData(0, 0, width, height);
    let transparent = 0;
    // Check alpha channel (index 3 of each RGBA group); step by 4 pixels (16 bytes)
    for (let i = 3; i < imageData.data.length; i += 16) {
      if (imageData.data[i] < 128) transparent++;
    }
    const total = imageData.data.length / 16;
    return transparent / total;
  }, [width, height]);

  // Erase a circle at (x, y) on the canvas
  const scratch = useCallback(
    (x: number, y: number) => {
      if (!scratchEnabled || claimedRef.current) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, 28, 0, Math.PI * 2);
      ctx.fill();

      // Check coverage every scratch stroke
      const coverage = computeCoverage();
      if (coverage > 0.5 && !claimedRef.current) {
        claimedRef.current = true;
        onReveal();
      }
    },
    [scratchEnabled, computeCoverage, onReveal]
  );

  // Resolve canvas-relative coordinates from a PointerEvent
  const getCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (width / rect.width),
      y: (e.clientY - rect.top) * (height / rect.height),
    };
  };

  // Resolve canvas-relative coordinates from a TouchEvent
  const getTouchCanvasPos = (
    e: React.TouchEvent<HTMLCanvasElement>,
    touch: React.Touch
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (touch.clientX - rect.left) * (width / rect.width),
      y: (touch.clientY - rect.top) * (height / rect.height),
    };
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      role="application"
      aria-label="Scratch card — scratch to reveal prize"
      className="absolute inset-0 w-full h-full rounded-xl"
      style={{
        cursor: scratchEnabled ? 'crosshair' : 'default',
        touchAction: 'none', // prevent scroll-on-drag on mobile
        display: 'block',
      }}
      onPointerDown={(e) => {
        if (!scratchEnabled) return;
        isDrawingRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        const { x, y } = getCanvasPos(e);
        scratch(x, y);
      }}
      onPointerMove={(e) => {
        if (!scratchEnabled || !isDrawingRef.current) return;
        const { x, y } = getCanvasPos(e);
        scratch(x, y);
      }}
      onPointerUp={() => {
        isDrawingRef.current = false;
      }}
      onPointerLeave={() => {
        isDrawingRef.current = false;
      }}
      onTouchStart={(e) => {
        if (!scratchEnabled) return;
        isDrawingRef.current = true;
        e.preventDefault();
        const touch = e.touches[0];
        if (!touch) return;
        const { x, y } = getTouchCanvasPos(e, touch);
        scratch(x, y);
      }}
      onTouchMove={(e) => {
        // Prevent page scroll while scratching
        e.preventDefault();
        if (!scratchEnabled || !isDrawingRef.current) return;
        const touch = e.touches[0];
        if (!touch) return;
        const { x, y } = getTouchCanvasPos(e, touch);
        scratch(x, y);
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// PhaseInstructions — contextual hint text
// ---------------------------------------------------------------------------
function PhaseInstructions({ phase, hasRoundId }: { phase: string; hasRoundId: boolean }) {
  if (phase === 'idle') {
    return (
      <p className="text-xs text-center py-1" style={{ color: 'rgba(156,163,175,0.6)' }}>
        Set your bet and press{' '}
        <strong style={{ color: '#FFD700' }}>SCRATCH CARD</strong> to lock in your stake.
      </p>
    );
  }
  if (phase === 'processing' && !hasRoundId) {
    return (
      <p className="text-xs text-center py-1" style={{ color: 'rgba(168,85,247,0.8)' }}>
        Placing bet…
      </p>
    );
  }
  if (phase === 'processing' && hasRoundId) {
    return (
      <p className="text-xs text-center py-1" style={{ color: 'rgba(6,182,212,0.8)' }}>
        Revealing your prize…
      </p>
    );
  }
  if (phase === 'betting') {
    return (
      <p className="text-xs text-center py-1" style={{ color: '#FFD700' }}>
        ✦ Stake locked! <strong>Scratch the card</strong> to reveal your prize!
      </p>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// ResultContent — shown inside MiniGameLayout's result area
// ---------------------------------------------------------------------------
function ResultContent({
  outcome,
  stake,
  payout,
}: {
  outcome: ScratchOutcome | null;
  stake: number;
  payout: number | null;
}) {
  if (!outcome || payout === null) return null;

  const isWin = payout > stake;

  return (
    <div
      className="w-full rounded-lg py-3 px-4 text-center"
      style={{
        background: isWin ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.06)',
        border: `1px solid ${isWin ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)'}`,
      }}
      aria-label="Round result"
    >
      <p
        className="font-orbitron text-xs uppercase tracking-widest mb-1"
        style={{ color: 'rgba(156,163,175,0.6)' }}
      >
        {isWin ? '🏆 You Won!' : '😔 No Prize'}
      </p>
      {isWin ? (
        <>
          <p
            className="font-orbitron font-bold text-lg"
            style={{ color: '#22c55e' }}
            aria-live="polite"
          >
            {outcome.label}
          </p>
          <p className="font-orbitron text-sm mt-0.5" style={{ color: '#FFD700' }}>
            {outcome.multiplier.toFixed(2)}x × KES {stake.toFixed(2)} = KES {payout.toFixed(2)}
          </p>
        </>
      ) : (
        <p className="font-orbitron text-sm" style={{ color: 'rgba(156,163,175,0.7)' }}>
          Better luck next time!
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScratchCardGame — main component
// ---------------------------------------------------------------------------

interface ScratchCardGameProps {
  gameId: 'scratch-cards';
  config: MiniGameConfig;
  userId: string;
}

// Canvas dimensions (logical pixels — CSS scales to container)
const CANVAS_WIDTH  = 320;
const CANVAS_HEIGHT = 180;

export default function ScratchCardGame({ gameId, config, userId }: ScratchCardGameProps) {
  // ── Store ──────────────────────────────────────────────────────────────────
  const roundPhase    = useMiniGameStore((s) => s.roundPhase);
  const currentRound  = useMiniGameStore((s) => s.currentRound);
  const roundError    = useMiniGameStore((s) => s.roundError);
  const initiateRound = useMiniGameStore((s) => s.initiateRound);
  const claimResult   = useMiniGameStore((s) => s.claimResult);
  const resetRound    = useMiniGameStore((s) => s.resetRound);

  // ── Local state ────────────────────────────────────────────────────────────
  /** Whether Phase 2 claimResult has been dispatched this round */
  const [revealDispatched, setRevealDispatched] = useState(false);

  // Reset reveal guard when round resets to idle
  useEffect(() => {
    if (roundPhase === 'idle') {
      setRevealDispatched(false);
    }
  }, [roundPhase]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const design  = getCardDesign(config);
  const outcome =
    roundPhase === 'result' && currentRound?.outcome
      ? (currentRound.outcome as ScratchOutcome)
      : null;
  const payout = currentRound?.payout ?? null;
  const stake  = currentRound?.stake ?? config.min_bet;

  // True when Phase 1 has resolved and we have a real roundId from server
  // (not just the temporary idempotencyKey placeholder)
  const hasRoundId =
    currentRound !== null &&
    currentRound.roundId !== '' &&
    currentRound.roundId !== currentRound.idempotencyKey;

  // ── Phase 1: initiate round (Requirement 5.2, 5.7) ────────────────────────
  const handleAction = useCallback((stake: number) => {
    if (roundPhase !== 'idle' && roundPhase !== 'error') return;
    setRevealDispatched(false);
    void initiateRound(userId, stake);
  }, [roundPhase, initiateRound, userId]);

  // ── Phase 2: scratch reveal (Requirement 5.3, 5.5) ────────────────────────
  // Called by ScratchCanvas when coverage exceeds 50%.
  // Guard: only trigger if roundPhase === 'betting' (Req 5.5).
  const handleReveal = useCallback(() => {
    if (roundPhase !== 'betting') return; // Req 5.5 — block if not in betting phase
    if (revealDispatched) return;          // Req 5.5 — block duplicate payout requests
    setRevealDispatched(true);
    void claimResult(userId);
  }, [roundPhase, revealDispatched, claimResult, userId]);

  // ── Action button label (phase-aware) ─────────────────────────────────────
  const actionLabel: string = (() => {
    if (roundPhase === 'processing' && !hasRoundId) return 'PLACING BET…';
    if (roundPhase === 'processing' && hasRoundId)  return 'REVEALING…';
    if (roundPhase === 'betting')                    return 'SCRATCHING…';
    return 'SCRATCH CARD';
  })();

  // ── ResultContent for MiniGameLayout ──────────────────────────────────────
  const resultContent =
    roundPhase === 'result' ? (
      <ResultContent outcome={outcome} stake={stake} payout={payout} />
    ) : undefined;

  // Whether to show the card surface (betting / processing phase 2 / result)
  const showCard =
    roundPhase === 'betting' ||
    (roundPhase === 'processing' && hasRoundId) ||
    roundPhase === 'result';

  // Scratch layer is interactive only during 'betting' phase and before reveal dispatched
  const scratchEnabled = roundPhase === 'betting' && !revealDispatched;

  return (
    <MiniGameLayout
      gameId={gameId}
      config={config}
      userId={userId}
      actionLabel={actionLabel}
      onAction={handleAction}
      resultContent={resultContent}
    >
      {/* ── Phase instructions ────────────────────────────────────────────── */}
      <div className="mb-2">
        <PhaseInstructions phase={roundPhase} hasRoundId={hasRoundId} />
      </div>

      {/* ── Scratch card surface (betting / processing-p2 / result) ──────── */}
      <AnimatePresence>
        {showCard && (
          <motion.div
            key="card-area"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.25 }}
            className="mb-3"
          >
            {/* Card design badge */}
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span
                className="font-orbitron text-xs uppercase tracking-widest"
                style={{ color: `rgba(${hexToRgb(design.primaryColor)},0.7)` }}
              >
                {design.label} CARD
              </span>
              {roundPhase === 'betting' && (
                <span
                  className="font-orbitron text-xs uppercase tracking-widest"
                  style={{ color: 'rgba(156,163,175,0.5)' }}
                >
                  Scratch &gt;50% to reveal
                </span>
              )}
            </div>

            {/* Card container — CardFace underneath, ScratchCanvas on top */}
            <div
              className="relative rounded-xl overflow-hidden"
              style={{
                width: '100%',
                paddingTop: `${(CANVAS_HEIGHT / CANVAS_WIDTH) * 100}%`,
                background: '#050010',
                border: `2px solid ${design.borderColor}`,
                boxShadow: `0 0 20px ${design.glowColor}`,
              }}
            >
              {/* Absolute fill wrapper */}
              <div className="absolute inset-0">
                {/* Card face (underneath) */}
                <CardFace
                  design={design}
                  outcome={outcome}
                  payout={payout}
                  stake={stake}
                  phase={roundPhase}
                />

                {/* Scratch canvas overlay — hidden after result revealed */}
                {roundPhase !== 'result' && (
                  <ScratchCanvas
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    design={design}
                    scratchEnabled={scratchEnabled}
                    onReveal={handleReveal}
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Rules panel (idle state only) ────────────────────────────────── */}
      {roundPhase === 'idle' && <RulesPanel config={config} />}

      {/* ── Retry panel for Phase 2 errors ───────────────────────────────── */}
      <AnimatePresence>
        {roundPhase === 'error' && revealDispatched && (
          <motion.div
            key="retry-reveal"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-0 mb-2 px-3 py-3 rounded-lg text-xs text-center"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
            }}
          >
            <p style={{ color: '#ef4444' }} className="mb-2">
              {roundError ?? 'Could not retrieve the outcome. Your stake was not charged again.'}
            </p>
            <button
              type="button"
              onClick={() => {
                // Restore to betting phase and retry claimResult
                useMiniGameStore.setState((s) => ({
                  roundPhase: 'betting',
                  roundError: null,
                  currentRound: s.currentRound
                    ? { ...s.currentRound, outcome: {} }
                    : s.currentRound,
                }));
                setRevealDispatched(false);
              }}
              className="px-4 py-1.5 rounded-lg font-orbitron font-bold text-xs uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
              style={{
                background: 'rgba(255,215,0,0.15)',
                border: '1px solid rgba(255,215,0,0.4)',
                color: '#FFD700',
              }}
            >
              Retry Reveal
            </button>
            <button
              type="button"
              onClick={resetRound}
              className="ml-2 px-3 py-1.5 rounded-lg font-orbitron text-xs uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              style={{
                background: 'rgba(168,85,247,0.12)',
                border: '1px solid rgba(168,85,247,0.3)',
                color: '#a855f7',
              }}
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </MiniGameLayout>
  );
}

// ---------------------------------------------------------------------------
// Utility — convert a 6-digit hex color string to "R,G,B" for rgba()
// ---------------------------------------------------------------------------
function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r},${g},${b}`;
}
