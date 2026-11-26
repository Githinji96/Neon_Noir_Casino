/**
 * TreasureChestGame component — two-phase treasure chest mini game.
 * Task 12.1 — Mini Jackpot Games spec
 * Requirements: 6.1–6.8
 *
 * Flow:
 *   Phase 1 (initiateRound): player sets bet → presses OPEN CHESTS → stake debited,
 *     server stores predetermined prize chest → roundPhase = 'betting'. Chests become
 *     clickable.
 *   Phase 2 (claimResult): player clicks a chest → sets selected_index on currentRound.outcome
 *     → claimResult called → roundPhase = 'result'. Prize chest revealed.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMiniGameStore } from '../../../store/miniGameStore';
import MiniGameLayout from '../MiniGameLayout';
import type { MiniGameConfig } from '../../../types/miniGames';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Typed outcome payload returned by claim_mini_game_result for treasure chest */
interface TreasureOutcome {
  prize_index: number;     // which chest index contains the prize (0-based, server-assigned)
  label: string;           // prize tier label (e.g. "3x")
  multiplier: number;      // payout multiplier
  selected_index: number;  // which chest the player picked
  segment_index?: number;  // prize tier index in the prize_tiers array
}

// ---------------------------------------------------------------------------
// Helpers — chest count from config (Req 6.1)
// ---------------------------------------------------------------------------
function getChestCount(config: MiniGameConfig): number {
  const raw = config.game_specific_rules?.chest_count;
  const n = typeof raw === 'number' ? Math.round(raw) : 3;
  return Math.max(2, Math.min(10, n));
}

// ---------------------------------------------------------------------------
// RulesPanel — compact, displayed in idle state (Req 6.1)
// ---------------------------------------------------------------------------
function RulesPanel({ config }: { config: MiniGameConfig }) {
  const tiers = config.prize_tiers;
  const chestCount = getChestCount(config);

  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: 'rgba(6,182,212,0.05)',
        border: '1px solid rgba(6,182,212,0.25)',
      }}
    >
      {/* Chests count pill */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="flex-1 rounded-lg py-1.5 px-2 text-center"
          style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)' }}
        >
          <p className="font-orbitron uppercase" style={{ fontSize: '0.55rem', color: 'rgba(156,163,175,0.6)' }}>Chests</p>
          <p className="font-orbitron font-bold text-xs" style={{ color: '#06b6d4' }}>{chestCount}</p>
        </div>
        <div
          className="flex-1 rounded-lg py-1.5 px-2 text-center"
          style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}
        >
          <p className="font-orbitron uppercase" style={{ fontSize: '0.55rem', color: 'rgba(156,163,175,0.6)' }}>Pick</p>
          <p className="font-orbitron font-bold text-xs" style={{ color: '#FFD700' }}>1</p>
        </div>
      </div>

      {/* Prize tier table — up to 4 rows */}
      {tiers.length > 0 && (
        <div className="overflow-hidden rounded-lg" style={{ border: '1px solid rgba(6,182,212,0.15)' }}>
          <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: '0.65rem' }}>
            <thead>
              <tr style={{ background: 'rgba(6,182,212,0.1)' }}>
                <th className="font-orbitron text-left py-1 px-2 uppercase tracking-wide" style={{ color: 'rgba(156,163,175,0.8)', fontWeight: 600 }}>Tier</th>
                <th className="font-orbitron text-center py-1 px-2 uppercase tracking-wide" style={{ color: 'rgba(156,163,175,0.8)', fontWeight: 600 }}>×</th>
                <th className="font-orbitron text-right py-1 px-2 uppercase tracking-wide" style={{ color: 'rgba(156,163,175,0.8)', fontWeight: 600 }}>%</th>
              </tr>
            </thead>
            <tbody>
              {tiers.slice(0, 4).map((tier, idx) => (
                <tr
                  key={idx}
                  style={{
                    background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(6,182,212,0.04)',
                    borderTop: '1px solid rgba(6,182,212,0.08)',
                  }}
                >
                  <td className="py-1 px-2" style={{ color: '#e5e7eb' }}>{tier.symbol ? `${tier.symbol} ` : ''}{tier.label}</td>
                  <td className="py-1 px-2 text-center font-orbitron font-bold" style={{ color: '#FFD700' }}>{tier.multiplier.toFixed(1)}x</td>
                  <td className="py-1 px-2 text-right" style={{ color: 'rgba(156,163,175,0.8)' }}>{(tier.probability * 100).toFixed(0)}%</td>
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
// ChestIcon — a single animated chest button (Req 6.3–6.6)
// ---------------------------------------------------------------------------
interface ChestIconProps {
  index: number;
  phase: string;        // roundPhase
  selected: boolean;    // this chest was clicked by the player
  anySelected: boolean; // some chest has been clicked this round
  outcome: TreasureOutcome | null;
  disabled: boolean;
  onClick: (index: number) => void;
}

function ChestIcon({ index, phase, selected, anySelected, outcome, disabled, onClick }: ChestIconProps) {
  const isResult = phase === 'result';
  const isBetting = phase === 'betting';

  // Determine reveal state after result
  const isPrizeChest = isResult && outcome !== null && outcome.prize_index === index;
  const isLoseChest  = isResult && outcome !== null && selected && !isPrizeChest;
  const isOtherChest = isResult && !selected;

  // Icon: closed 📦 before selection, open 📬 when selected/result
  const icon = (selected || isPrizeChest) ? '📬' : '📦';

  // Visual state
  let borderColor = 'rgba(6,182,212,0.35)';
  let bgColor     = 'rgba(6,182,212,0.07)';
  let boxShadow   = 'none';
  let opacity     = 1;

  if (isBetting && !anySelected) {
    // Pulse hint — neon cyan glow
    borderColor = 'rgba(6,182,212,0.6)';
    bgColor     = 'rgba(6,182,212,0.1)';
    boxShadow   = '0 0 12px rgba(6,182,212,0.35)';
  }

  if (isResult) {
    if (isPrizeChest) {
      // Winning chest — green glow
      borderColor = 'rgba(34,197,94,0.7)';
      bgColor     = 'rgba(34,197,94,0.12)';
      boxShadow   = '0 0 28px rgba(34,197,94,0.45)';
    } else if (isLoseChest) {
      // Selected but lost — red tint
      borderColor = 'rgba(239,68,68,0.6)';
      bgColor     = 'rgba(239,68,68,0.1)';
      boxShadow   = '0 0 14px rgba(239,68,68,0.3)';
    } else if (isOtherChest) {
      // Unselected chests dimmed
      opacity = 0.4;
    }
  }

  // Lock icon overlay when chests are not yet interactive (idle/processing phase 1)
  const showLock = !isBetting && !isResult && phase !== 'processing';

  // Framer-motion variants
  const bettingPulse = isBetting && !anySelected
    ? {
        scale: [1, 1.04, 1],
        boxShadow: [
          '0 0 8px rgba(6,182,212,0.2)',
          '0 0 18px rgba(6,182,212,0.5)',
          '0 0 8px rgba(6,182,212,0.2)',
        ],
      }
    : {};

  return (
    <motion.button
      type="button"
      onClick={() => !disabled && onClick(index)}
      disabled={disabled}
      aria-label={`Chest ${index + 1}${selected ? ' — selected' : ''}${isPrizeChest ? ' — prize' : ''}`}
      aria-pressed={selected}
      animate={bettingPulse}
      transition={
        isBetting && !anySelected
          ? { repeat: Infinity, duration: 1.8, ease: 'easeInOut', delay: index * 0.15 }
          : {}
      }
      whileHover={isBetting && !anySelected ? { scale: 1.08 } : {}}
      whileTap={isBetting && !anySelected ? { scale: 0.95 } : {}}
      className="relative flex flex-col items-center justify-center rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed"
      style={{
        background: bgColor,
        border: `2px solid ${borderColor}`,
        boxShadow,
        opacity,
        padding: '0.75rem 0.5rem',
        minWidth: 0,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {/* Lock overlay */}
      {showLock && (
        <span
          className="absolute top-1 right-1 text-xs leading-none"
          style={{ color: 'rgba(156,163,175,0.5)' }}
          aria-hidden="true"
        >
          🔒
        </span>
      )}

      {/* Chest icon with open animation */}
      <AnimatePresence mode="wait">
        {(selected || isPrizeChest) ? (
          <motion.span
            key="open"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1.15, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'backOut' }}
            style={{ fontSize: '2rem', lineHeight: 1 }}
            aria-hidden="true"
          >
            {icon}
          </motion.span>
        ) : (
          <motion.span
            key="closed"
            initial={{ scale: 1 }}
            animate={{ scale: 1 }}
            style={{ fontSize: '2rem', lineHeight: 1 }}
            aria-hidden="true"
          >
            {icon}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Chest number label */}
      <span
        className="font-orbitron mt-1"
        style={{
          fontSize: '0.6rem',
          color: selected || isPrizeChest ? '#FFD700' : 'rgba(156,163,175,0.6)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        #{index + 1}
      </span>

      {/* Result label inside chest (win/empty) */}
      {isResult && (
        <motion.span
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.25 }}
          className="font-orbitron mt-0.5"
          style={{
            fontSize: '0.55rem',
            color: isPrizeChest ? '#22c55e' : selected ? '#ef4444' : 'rgba(156,163,175,0.45)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {isPrizeChest ? '🏆 PRIZE' : selected ? 'EMPTY' : '—'}
        </motion.span>
      )}
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// ChestGrid — responsive grid of ChestIcon buttons (Req 6.2, 6.3)
// ---------------------------------------------------------------------------
interface ChestGridProps {
  chestCount: number;
  phase: string;
  selectedIndex: number | null;
  outcome: TreasureOutcome | null;
  onSelect: (index: number) => void;
}

function ChestGrid({ chestCount, phase, selectedIndex, outcome, onSelect }: ChestGridProps) {
  const isBetting = phase === 'betting';
  const isResult  = phase === 'result';
  const canSelect = isBetting && selectedIndex === null;

  // For 5 chests: render 3 on row 1, 2 centred on row 2
  // For other counts: use the existing responsive grid
  if (chestCount === 5) {
    return (
      <div role="group" aria-label="Treasure chests — pick one">
        {/* Row 1: chests 0, 1, 2 */}
        <div className="flex justify-center gap-2 mb-2">
          {[0, 1, 2].map((i) => (
            <ChestIcon
              key={i}
              index={i}
              phase={phase}
              selected={selectedIndex === i}
              anySelected={selectedIndex !== null}
              outcome={isResult ? outcome : null}
              disabled={!canSelect}
              onClick={onSelect}
            />
          ))}
        </div>
        {/* Row 2: chests 3, 4 — centred */}
        <div className="flex justify-center gap-2">
          {[3, 4].map((i) => (
            <ChestIcon
              key={i}
              index={i}
              phase={phase}
              selected={selectedIndex === i}
              anySelected={selectedIndex !== null}
              outcome={isResult ? outcome : null}
              disabled={!canSelect}
              onClick={onSelect}
            />
          ))}
        </div>
      </div>
    );
  }

  // Responsive grid for other chest counts
  let gridCols = 'repeat(3, 1fr)';
  if (chestCount <= 4)       gridCols = 'repeat(2, 1fr)';
  else if (chestCount <= 6)  gridCols = 'repeat(3, 1fr)';
  else if (chestCount <= 8)  gridCols = 'repeat(4, 1fr)';
  else                       gridCols = 'repeat(5, 1fr)';

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '0.5rem' }}
      role="group"
      aria-label="Treasure chests — pick one"
    >
      {Array.from({ length: chestCount }, (_, i) => (
        <ChestIcon
          key={i}
          index={i}
          phase={phase}
          selected={selectedIndex === i}
          anySelected={selectedIndex !== null}
          outcome={isResult ? outcome : null}
          disabled={!canSelect}
          onClick={onSelect}
        />
      ))}
    </div>
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
        <strong style={{ color: '#FFD700' }}>OPEN CHESTS</strong> to lock in your stake.
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
        Opening chest…
      </p>
    );
  }
  if (phase === 'betting') {
    return (
      <p className="text-xs text-center py-1" style={{ color: '#FFD700' }}>
        ✦ Stake locked! <strong>Click a chest</strong> to reveal your prize!
      </p>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// ResultContent — shown inside MiniGameLayout's result area (Req 6.4)
// ---------------------------------------------------------------------------
function ResultContent({
  outcome,
  stake,
  payout,
}: {
  outcome: TreasureOutcome | null;
  stake: number;
  payout: number | null;
}) {
  if (!outcome || payout === null) return null;

  const won = outcome.selected_index === outcome.prize_index;
  const chestNum = outcome.selected_index + 1;
  const prizeChestNum = outcome.prize_index + 1;

  return (
    <div
      className="w-full rounded-lg py-3 px-4 text-center"
      style={{
        background: won ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.06)',
        border: `1px solid ${won ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)'}`,
      }}
      aria-label="Round result"
    >
      {won ? (
        <>
          <p className="font-orbitron text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(156,163,175,0.6)' }}>
            Chest #{chestNum} — Prize!
          </p>
          <p className="font-orbitron font-bold text-lg" style={{ color: '#22c55e' }} aria-live="polite">
            {outcome.label}
          </p>
          <p className="font-orbitron text-sm mt-0.5" style={{ color: '#FFD700' }}>
            {outcome.multiplier.toFixed(2)}x × KES {stake.toFixed(2)} = KES {payout.toFixed(2)}
          </p>
        </>
      ) : (
        <>
          <p className="font-orbitron text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(156,163,175,0.6)' }}>
            Chest #{chestNum} — Empty
          </p>
          <p className="font-orbitron text-sm" style={{ color: 'rgba(156,163,175,0.7)' }}>
            The prize was in chest #{prizeChestNum}
          </p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TreasureChestGame — main component (Req 6.1–6.8)
// ---------------------------------------------------------------------------

interface TreasureChestGameProps {
  gameId: 'treasure-chest';
  config: MiniGameConfig;
  userId: string;
}

export default function TreasureChestGame({ gameId, config, userId }: TreasureChestGameProps) {
  // ── Store ──────────────────────────────────────────────────────────────────
  const roundPhase    = useMiniGameStore((s) => s.roundPhase);
  const currentRound  = useMiniGameStore((s) => s.currentRound);
  const roundError    = useMiniGameStore((s) => s.roundError);
  const initiateRound = useMiniGameStore((s) => s.initiateRound);
  const claimResult   = useMiniGameStore((s) => s.claimResult);
  const resetRound    = useMiniGameStore((s) => s.resetRound);

  // ── Local state ────────────────────────────────────────────────────────────
  /** Index of chest the player clicked (null = not yet selected) */
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  /** Guard: prevent double Phase 2 call (Req 6.6) */
  const [claimDispatched, setClaimDispatched] = useState(false);

  // Reset local state when round goes back to idle
  useEffect(() => {
    if (roundPhase === 'idle') {
      setSelectedIndex(null);
      setClaimDispatched(false);
    }
  }, [roundPhase]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const chestCount = getChestCount(config);

  const outcome =
    roundPhase === 'result' && currentRound?.outcome
      ? (currentRound.outcome as TreasureOutcome)
      : null;

  const payout = currentRound?.payout ?? null;
  const stake  = currentRound?.stake ?? config.min_bet;

  // True when Phase 1 has resolved (we have a real server round_id, not the temp idempotency key)
  const hasRoundId =
    currentRound !== null &&
    currentRound.roundId !== '' &&
    currentRound.roundId !== currentRound.idempotencyKey;

  // ── Phase 1: initiate round (Req 6.2) ─────────────────────────────────────
  const handleAction = useCallback((stake: number) => {
    // Only proceed from idle or error-before-selection
    if (roundPhase !== 'idle' && roundPhase !== 'error') return;
    setSelectedIndex(null);
    setClaimDispatched(false);
    void initiateRound(userId, stake);
  }, [roundPhase, initiateRound, userId]);

  // ── Phase 2: chest selection (Req 6.3, 6.5, 6.6) ─────────────────────────
  const handleChestSelect = useCallback(
    (index: number) => {
      // Only allow during betting phase, before any chest is selected
      if (roundPhase !== 'betting') return;
      if (claimDispatched) return;  // Req 6.6 — prevent multi-select
      if (selectedIndex !== null) return;

      setSelectedIndex(index);
      setClaimDispatched(true);

      // Set selected_index on currentRound.outcome before calling claimResult (Req 6.5)
      useMiniGameStore.setState((s) => ({
        currentRound: s.currentRound
          ? { ...s.currentRound, outcome: { selected_index: index } }
          : s.currentRound,
      }));

      void claimResult(userId);
    },
    [roundPhase, claimDispatched, selectedIndex, claimResult, userId]
  );

  // ── Action button label (phase-aware) ─────────────────────────────────────
  const actionLabel: string = (() => {
    if (roundPhase === 'processing' && !hasRoundId) return 'PLACING BET…';
    if (roundPhase === 'processing' && hasRoundId)  return 'OPENING CHEST…';
    if (roundPhase === 'betting')                    return 'SELECT A CHEST';
    return 'OPEN CHESTS';
  })();

  // During betting phase the action button should be a no-op / visually disabled hint
  const wrappedHandleAction = useCallback(() => {
    if (roundPhase === 'betting') return; // player interacts with chests directly
    handleAction(stake);
  }, [roundPhase, handleAction, stake]);

  // ── ResultContent for MiniGameLayout ──────────────────────────────────────
  const resultContent =
    roundPhase === 'result' ? (
      <ResultContent outcome={outcome} stake={stake} payout={payout} />
    ) : undefined;

  // Show chest grid when in betting phase, processing phase 2, or result
  const showChests =
    roundPhase === 'betting' ||
    (roundPhase === 'processing' && hasRoundId) ||
    roundPhase === 'result';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <MiniGameLayout
      gameId={gameId}
      config={config}
      userId={userId}
      actionLabel={actionLabel}
      onAction={wrappedHandleAction}
      resultContent={resultContent}
    >
      {/* ── Phase instructions ────────────────────────────────────────────── */}
      <div className="mb-2">
        <PhaseInstructions phase={roundPhase} hasRoundId={hasRoundId} />
      </div>

      {/* ── Chest grid (betting / processing-p2 / result) ─────────────────── */}
      <AnimatePresence>
        {showChests && (
          <motion.div
            key="chest-grid"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.25 }}
            className="mb-3"
          >
            {/* Header label */}
            <div className="flex items-center justify-between mb-2 px-0.5">
              <span
                className="font-orbitron text-xs uppercase tracking-widest"
                style={{ color: 'rgba(6,182,212,0.7)' }}
              >
                {chestCount} Chests
              </span>
              {roundPhase === 'betting' && selectedIndex === null && (
                <span
                  className="font-orbitron text-xs uppercase tracking-widest"
                  style={{ color: 'rgba(156,163,175,0.5)' }}
                >
                  Pick one
                </span>
              )}
            </div>

            {/* Chest grid */}
            <div
              className="rounded-xl p-3"
              style={{
                background: 'rgba(6,182,212,0.04)',
                border: '1px solid rgba(6,182,212,0.2)',
                boxShadow: roundPhase === 'betting' ? '0 0 20px rgba(6,182,212,0.12)' : 'none',
              }}
            >
              <ChestGrid
                chestCount={chestCount}
                phase={roundPhase}
                selectedIndex={selectedIndex}
                outcome={outcome}
                onSelect={handleChestSelect}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Rules panel (idle state only) ────────────────────────────────── */}
      {roundPhase === 'idle' && <RulesPanel config={config} />}

      {/* ── Retry panel for Phase 2 errors (Req 6.8) ─────────────────────── */}
      <AnimatePresence>
        {roundPhase === 'error' && claimDispatched && (
          <motion.div
            key="retry-claim"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-0 mb-2 px-3 py-3 rounded-lg text-xs text-center"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
            }}
            role="alert"
          >
            <p style={{ color: '#ef4444' }} className="mb-2">
              {roundError ?? 'Could not retrieve the outcome. Your stake was not charged again.'}
            </p>
            <button
              type="button"
              onClick={() => {
                // Restore to betting phase so player can retry with the same round_id (no new debit)
                useMiniGameStore.setState((s) => ({
                  roundPhase: 'betting',
                  roundError: null,
                  // Keep currentRound.outcome with selected_index so claimResult re-uses it
                  currentRound: s.currentRound
                    ? {
                        ...s.currentRound,
                        outcome:
                          selectedIndex !== null
                            ? { selected_index: selectedIndex }
                            : s.currentRound.outcome,
                      }
                    : s.currentRound,
                }));
                setSelectedIndex(null);   // ← allow chest re-selection
                setClaimDispatched(false);
              }}
              className="px-4 py-1.5 rounded-lg font-orbitron font-bold text-xs uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
              style={{
                background: 'rgba(255,215,0,0.15)',
                border: '1px solid rgba(255,215,0,0.4)',
                color: '#FFD700',
              }}
            >
              Retry
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
