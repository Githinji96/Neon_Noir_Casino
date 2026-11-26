/**
 * MysteryMultiplierGame component — single-phase multiplier mini game.
 * Task 6.1 — Mini Jackpot Games spec
 * Requirements: 8.1–8.6
 */

import { useMiniGameStore } from '../../../store/miniGameStore';
import MiniGameLayout from '../MiniGameLayout';
import type { MiniGameConfig } from '../../../types/miniGames';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface MysteryMultiplierGameProps {
  gameId: 'mystery-multiplier';
  config: MiniGameConfig;
  userId: string;
}

// ---------------------------------------------------------------------------
// Rules panel — compact version shown in game content area (Requirement 8.1)
// ---------------------------------------------------------------------------
function RulesPanel({ config }: { config: MiniGameConfig }) {
  const tiers = config.prize_tiers;

  // Derive min/max multiplier from prize_tiers
  const multipliers = tiers.map((t) => t.multiplier);
  const minMultiplier = multipliers.length > 0 ? Math.min(...multipliers) : 0;
  const maxMultiplier = multipliers.length > 0 ? Math.max(...multipliers) : 0;

  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: 'rgba(168,85,247,0.06)',
        border: '1px solid rgba(168,85,247,0.3)',
      }}
    >
      {/* Multiplier range — single compact row */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="flex-1 rounded-lg py-1.5 px-2 text-center"
          style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}
        >
          <p className="font-orbitron uppercase" style={{ fontSize: '0.55rem', color: 'rgba(156,163,175,0.6)' }}>Min</p>
          <p className="font-orbitron font-bold text-xs" style={{ color: '#FFD700' }}>{minMultiplier.toFixed(2)}x</p>
        </div>
        <div
          className="flex-1 rounded-lg py-1.5 px-2 text-center"
          style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}
        >
          <p className="font-orbitron uppercase" style={{ fontSize: '0.55rem', color: 'rgba(156,163,175,0.6)' }}>Max</p>
          <p className="font-orbitron font-bold text-xs" style={{ color: '#FFD700' }}>{maxMultiplier.toFixed(2)}x</p>
        </div>
      </div>

      {/* Prize tier table — up to 4 rows */}
      {tiers.length > 0 && (
        <div className="overflow-hidden rounded-lg" style={{ border: '1px solid rgba(168,85,247,0.2)' }}>
          <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: '0.65rem' }}>
            <thead>
              <tr style={{ background: 'rgba(168,85,247,0.15)' }}>
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
// Result content — observable payout calculation (Requirement 8.5)
// ---------------------------------------------------------------------------
function ResultContent({
  multiplier,
  stake,
  payout,
}: {
  multiplier: number;
  stake: number;
  payout: number;
}) {
  const isWin  = payout > stake;
  const isLoss = payout < stake;

  const formulaColor = isWin ? '#22c55e' : isLoss ? '#ef4444' : '#FFD700';

  return (
    <div
      className="w-full rounded-lg py-3 px-4 text-center"
      style={{
        background: isWin
          ? 'rgba(34,197,94,0.08)'
          : isLoss
          ? 'rgba(239,68,68,0.08)'
          : 'rgba(255,215,0,0.08)',
        border: `1px solid ${isWin ? 'rgba(34,197,94,0.3)' : isLoss ? 'rgba(239,68,68,0.3)' : 'rgba(255,215,0,0.3)'}`,
      }}
      aria-label="Payout calculation"
    >
      <p
        className="font-orbitron text-xs uppercase tracking-widest mb-2"
        style={{ color: 'rgba(156,163,175,0.6)' }}
      >
        Your Result
      </p>
      {/* Observable formula: {multiplier}x × KES {stake} = KES {payout} */}
      <p
        className="font-orbitron font-bold"
        style={{ color: formulaColor, fontSize: '1.05rem', letterSpacing: '0.04em' }}
        aria-live="polite"
      >
        {multiplier.toFixed(2)}x × KES {stake.toFixed(2)} = KES {payout.toFixed(2)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function MysteryMultiplierGame({
  gameId,
  config,
  userId,
}: MysteryMultiplierGameProps) {
  const submitRound   = useMiniGameStore((s) => s.submitRound);
  const roundPhase    = useMiniGameStore((s) => s.roundPhase);
  const currentRound  = useMiniGameStore((s) => s.currentRound);

  // ── Derive result values ──────────────────────────────────────────────────
  // outcome payload for Mystery Multiplier: { multiplier: number }
  const outcomeMultiplier =
    currentRound?.outcome != null
      ? (currentRound.outcome as { multiplier: number }).multiplier
      : null;
  const payout  = currentRound?.payout ?? null;
  const stake   = currentRound?.stake ?? config.min_bet;

  // ── Action handler — submit round (Requirement 8.2) ───────────────────────
  const handleAction = (stake: number) => {
    if (roundPhase !== 'idle' && roundPhase !== 'error') return;
    void submitRound(userId, stake);
  };

  // ── Build resultContent prop (Requirement 8.3, 8.5) ──────────────────────
  const resultContent =
    roundPhase === 'result' &&
    outcomeMultiplier !== null &&
    payout !== null ? (
      <ResultContent
        multiplier={outcomeMultiplier}
        stake={stake}
        payout={payout}
      />
    ) : undefined;

  return (
    <MiniGameLayout
      gameId={gameId}
      config={config}
      userId={userId}
      actionLabel="REVEAL MULTIPLIER"
      onAction={handleAction}
      resultContent={resultContent}
    >
      {/* Rules panel rendered above bet controls (Requirement 8.1) */}
      <RulesPanel config={config} />
    </MiniGameLayout>
  );
}
