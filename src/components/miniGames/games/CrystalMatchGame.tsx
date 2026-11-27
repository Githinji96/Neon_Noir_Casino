/**
 * CrystalMatchGame component — crystal-matching mini game (single-phase).
 * Task 9.1 — Mini Jackpot Games spec
 * Requirements: 9.1–9.7
 *
 * The play_mini_game RPC returns a prize tier object:
 *   { label, multiplier, probability, symbol?, segment_index }
 *
 * Since the server doesn't generate a crystal grid, we deterministically
 * build one client-side from the outcome: the winning symbol fills
 * min_match_count cells, the rest are random from a symbol pool.
 * This is purely visual — the authoritative result is the server payout.
 */

import { useMemo } from 'react';
import { useMiniGameStore } from '../../../store/miniGameStore';
import MiniGameLayout from '../MiniGameLayout';
import type { MiniGameConfig, MiniGameOutcome } from '../../../types/miniGames';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape returned by play_mini_game for crystal-match */
type CrystalOutcome = MiniGameOutcome;

interface GameSpecificRules {
  grid_size?: [number, number];
  min_match_count?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CRYSTAL_POOL = ['💎', '⭐', '🔮', '🔷', '💠', '❤️', '💚', '💙'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGridSize(rules: GameSpecificRules): [number, number] {
  if (
    Array.isArray(rules.grid_size) &&
    rules.grid_size.length === 2 &&
    rules.grid_size[0] > 0 &&
    rules.grid_size[1] > 0
  ) {
    return [rules.grid_size[0], rules.grid_size[1]];
  }
  return [3, 3];
}

/**
 * Build a visual crystal grid from the outcome.
 * The winning symbol (from outcome.symbol or derived from label) appears
 * exactly minMatch times; remaining cells get random other symbols.
 * Uses segment_index as a deterministic seed so the same round always
 * shows the same grid.
 */
function buildGrid(
  rows: number,
  cols: number,
  outcome: CrystalOutcome,
  minMatch: number
): { grid: string[][]; matchedPositions: Set<string> } {
  const isWin = outcome.multiplier > 0;
  const total = rows * cols;

  // Pick the winning symbol
  const winSymbol =
    outcome.symbol ??
    CRYSTAL_POOL[(outcome.segment_index ?? 0) % CRYSTAL_POOL.length];

  // Seeded shuffle using segment_index for determinism
  const seed = outcome.segment_index ?? 0;
  const pseudoRandom = (i: number) => ((seed * 1103515245 + i * 12345) & 0x7fffffff) / 0x7fffffff;

  const flat: string[] = [];

  if (isWin) {
    // Place exactly minMatch winning symbols, rest are other crystals
    const matchCount = Math.min(minMatch, total);
    const positions = Array.from({ length: total }, (_, i) => i);

    // Fisher-Yates shuffle with seeded rng
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(pseudoRandom(i + seed) * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    const winPositions = new Set(positions.slice(0, matchCount));

    // Fill pool without the win symbol for other cells
    const otherPool = CRYSTAL_POOL.filter((s) => s !== winSymbol);

    for (let i = 0; i < total; i++) {
      if (winPositions.has(i)) {
        flat.push(winSymbol);
      } else {
        flat.push(otherPool[(seed + i * 7) % otherPool.length]);
      }
    }
  } else {
    // No win — fill with varied crystals, ensuring winSymbol appears < minMatch times
    const otherPool = CRYSTAL_POOL.filter((s) => s !== winSymbol);
    for (let i = 0; i < total; i++) {
      flat.push(otherPool[(seed + i * 3) % otherPool.length]);
    }
  }

  // Reshape into grid
  const grid: string[][] = [];
  for (let r = 0; r < rows; r++) {
    grid.push(flat.slice(r * cols, r * cols + cols));
  }

  // Find matched positions
  const matchedPositions = new Set<string>();
  if (isWin) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === winSymbol) {
          matchedPositions.add(`${r}-${c}`);
        }
      }
    }
  }

  return { grid, matchedPositions };
}

// ---------------------------------------------------------------------------
// PlaceholderGrid
// ---------------------------------------------------------------------------

function PlaceholderGrid({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div className="flex flex-col items-center gap-1.5" aria-label="Crystal grid — waiting for round">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-1.5">
          {Array.from({ length: cols }, (_, c) => (
            <div
              key={c}
              style={{
                width: 52, height: 52,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 10,
                background: 'rgba(168,85,247,0.06)',
                border: '1px solid rgba(168,85,247,0.2)',
                fontSize: 22, userSelect: 'none',
                color: 'rgba(168,85,247,0.3)',
              }}
            >
              ?
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CrystalGrid
// ---------------------------------------------------------------------------

function CrystalGrid({
  grid,
  matchedPositions,
  isWin,
}: {
  grid: string[][];
  matchedPositions: Set<string>;
  isWin: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5" role="img" aria-label="Final crystal arrangement">
      {grid.map((row, r) => (
        <div key={r} className="flex gap-1.5">
          {row.map((symbol, c) => {
            const key = `${r}-${c}`;
            const matched = matchedPositions.has(key);
            return (
              <div
                key={c}
                style={{
                  width: 52, height: 52,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 10,
                  background: matched ? 'rgba(255,215,0,0.15)' : 'rgba(8,8,20,0.9)',
                  border: matched
                    ? '2px solid rgba(255,215,0,0.85)'
                    : isWin
                    ? '1px solid rgba(168,85,247,0.4)'
                    : '1px solid rgba(168,85,247,0.2)',
                  boxShadow: matched ? '0 0 12px rgba(255,215,0,0.5)' : undefined,
                  fontSize: 24, userSelect: 'none',
                  transition: 'all 0.25s ease',
                }}
                aria-label={`${symbol}${matched ? ' (matched)' : ''}`}
              >
                {symbol}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RulesPanel
// ---------------------------------------------------------------------------

function RulesPanel({ config }: { config: MiniGameConfig }) {
  const rules = config.game_specific_rules as GameSpecificRules;
  const [rows, cols] = getGridSize(rules);
  const minMatch = rules.min_match_count ?? 3;
  const tiers = config.prize_tiers;

  return (
    <div
      className="rounded-xl p-3 mb-1"
      style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.3)' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="flex-1 rounded-lg py-1.5 px-2 text-center"
          style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)' }}
        >
          <p className="font-orbitron uppercase" style={{ fontSize: '0.55rem', color: 'rgba(156,163,175,0.6)' }}>Grid</p>
          <p className="font-orbitron font-bold text-xs" style={{ color: '#06b6d4' }}>{rows}×{cols}</p>
        </div>
        <div
          className="flex-1 rounded-lg py-1.5 px-2 text-center"
          style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}
        >
          <p className="font-orbitron uppercase" style={{ fontSize: '0.55rem', color: 'rgba(156,163,175,0.6)' }}>Min Match</p>
          <p className="font-orbitron font-bold text-xs" style={{ color: '#a855f7' }}>{minMatch}</p>
        </div>
      </div>

      {tiers.length > 0 && (
        <div className="overflow-hidden rounded-lg" style={{ border: '1px solid rgba(168,85,247,0.2)' }}>
          <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: '0.65rem' }}>
            <thead>
              <tr style={{ background: 'rgba(168,85,247,0.15)' }}>
                <th className="font-orbitron text-left py-1 px-2 uppercase" style={{ color: 'rgba(156,163,175,0.8)', fontWeight: 600 }}>Tier</th>
                <th className="font-orbitron text-center py-1 px-2 uppercase" style={{ color: 'rgba(156,163,175,0.8)', fontWeight: 600 }}>×</th>
                <th className="font-orbitron text-right py-1 px-2 uppercase" style={{ color: 'rgba(156,163,175,0.8)', fontWeight: 600 }}>%</th>
              </tr>
            </thead>
            <tbody>
              {tiers.slice(0, 5).map((tier, idx) => (
                <tr
                  key={idx}
                  style={{
                    background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(168,85,247,0.04)',
                    borderTop: '1px solid rgba(168,85,247,0.1)',
                  }}
                >
                  <td className="py-1 px-2" style={{ color: '#e5e7eb' }}>{tier.symbol ? `${tier.symbol} ` : ''}{tier.label}</td>
                  <td className="py-1 px-2 text-center font-orbitron font-bold" style={{ color: '#FFD700' }}>{tier.multiplier.toFixed(1)}x</td>
                  <td className="py-1 px-2 text-right" style={{ color: 'rgba(156,163,175,0.7)' }}>{(tier.probability * 100).toFixed(0)}%</td>
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
// ResultContent
// ---------------------------------------------------------------------------

function ResultContent({
  outcome,
  stake,
  payout,
  roundId,
}: {
  outcome: CrystalOutcome;
  stake: number;
  payout: number;
  roundId: string;
}) {
  const isWin = outcome.multiplier > 0 && payout > 0;
  const netChange = payout - stake;
  const tierLabel = outcome.label ?? '';

  return (
    <div
      className="w-full rounded-lg py-3 px-4"
      style={{
        background: isWin ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.06)',
        border: `1px solid ${isWin ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}`,
      }}
      aria-label="Crystal Match round result"
    >
      <p
        className="font-orbitron font-bold text-center uppercase tracking-widest mb-3"
        style={{ color: isWin ? '#22c55e' : '#ef4444', fontSize: '0.9rem' }}
        aria-live="polite"
      >
        {isWin ? '💎 Match Found!' : '💔 No Match'}
      </p>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-orbitron text-xs uppercase tracking-wider" style={{ color: 'rgba(156,163,175,0.6)' }}>Round ID</span>
          <span className="font-mono text-xs" style={{ color: 'rgba(6,182,212,0.9)' }} title={roundId}>{roundId.slice(0, 8)}…</span>
        </div>

        {tierLabel && (
          <div className="flex items-center justify-between">
            <span className="font-orbitron text-xs uppercase tracking-wider" style={{ color: 'rgba(156,163,175,0.6)' }}>Tier</span>
            <span className="font-orbitron font-bold text-xs" style={{ color: '#FFD700' }}>{tierLabel}</span>
          </div>
        )}

        <div
          className="rounded-lg py-2 px-3 text-center mt-1"
          style={{
            background: isWin ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${isWin ? 'rgba(34,197,94,0.2)' : 'rgba(168,85,247,0.15)'}`,
          }}
        >
          <p
            className="font-orbitron font-bold"
            style={{ color: isWin ? '#22c55e' : '#ef4444', fontSize: '0.9rem' }}
          >
            {outcome.multiplier.toFixed(2)}x × KES {stake.toFixed(2)} = KES {payout.toFixed(2)}
          </p>
          {netChange !== 0 && (
            <p className="text-xs mt-0.5" style={{ color: isWin ? 'rgba(34,197,94,0.8)' : 'rgba(239,68,68,0.7)' }}>
              {netChange > 0 ? `+KES ${netChange.toFixed(2)}` : `-KES ${Math.abs(netChange).toFixed(2)}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CrystalMatchGame — main exported component
// ---------------------------------------------------------------------------

export default function CrystalMatchGame({
  gameId,
  config,
  userId,
}: {
  gameId: 'crystal-match';
  config: MiniGameConfig;
  userId: string;
}) {
  const submitRound  = useMiniGameStore((s) => s.submitRound);
  const roundPhase   = useMiniGameStore((s) => s.roundPhase);
  const currentRound = useMiniGameStore((s) => s.currentRound);

  const rules    = config.game_specific_rules as GameSpecificRules;
  const [rows, cols] = getGridSize(rules);
  const minMatch = rules.min_match_count ?? 3;

  const outcome: CrystalOutcome | null =
    roundPhase === 'result' && currentRound?.outcome != null
      ? (currentRound.outcome as CrystalOutcome)
      : null;

  const payout  = currentRound?.payout  ?? 0;
  const stake   = currentRound?.stake   ?? config.min_bet;
  const roundId = currentRound?.roundId ?? '';

  // Build the visual grid whenever outcome changes — memoized so it's stable
  const gridData = useMemo(() => {
    if (!outcome) return null;
    return buildGrid(rows, cols, outcome, minMatch);
  }, [outcome, rows, cols, minMatch]);

  const isWin = (outcome?.multiplier ?? 0) > 0 && payout > 0;

  const handleAction = (stake: number) => {
    if (roundPhase !== 'idle' && roundPhase !== 'error') return;
    void submitRound(userId, stake);
  };

  const resultContent =
    roundPhase === 'result' && outcome !== null ? (
      <ResultContent outcome={outcome} stake={stake} payout={payout} roundId={roundId} />
    ) : undefined;

  return (
    <MiniGameLayout
      gameId={gameId}
      config={config}
      userId={userId}
      actionLabel="MATCH CRYSTALS"
      onAction={handleAction}
      resultContent={resultContent}
    >
      <RulesPanel config={config} />

      <div
        className="rounded-xl py-4 px-3 mb-1"
        style={{
          background: 'rgba(8,8,20,0.9)',
          border: '1px solid rgba(168,85,247,0.25)',
          // Safe: only access matchedPositions.size when gridData is non-null
          boxShadow: isWin && gridData ? '0 0 28px rgba(255,215,0,0.3)' : undefined,
        }}
      >
        <div className="flex items-center justify-center mb-3">
          <span
            className="font-orbitron text-xs uppercase tracking-widest"
            style={{ color: 'rgba(6,182,212,0.6)' }}
          >
            Crystal Grid
          </span>
        </div>

        {/* Show revealed grid after result, placeholder otherwise */}
        {roundPhase === 'result' && gridData ? (
          <CrystalGrid
            grid={gridData.grid}
            matchedPositions={gridData.matchedPositions}
            isWin={isWin}
          />
        ) : (
          <PlaceholderGrid rows={rows} cols={cols} />
        )}

        {roundPhase === 'processing' && (
          <p
            className="font-orbitron text-xs text-center mt-3 uppercase tracking-widest"
            style={{ color: 'rgba(168,85,247,0.6)' }}
            aria-live="polite"
          >
            Generating crystals…
          </p>
        )}
      </div>
    </MiniGameLayout>
  );
}
