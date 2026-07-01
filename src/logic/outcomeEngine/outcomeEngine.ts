/**
 * Outcome Engine — Main Entry Point
 *
 * Usage:
 *   const engine = createOutcomeEngine('blackjack');
 *   const result = engine.resolve({ bet: 100 });
 *
 * Each table gets its own engine instance (isolated session tracking).
 *
 * Flow per round:
 *   1. Compute RTP deviation + rolling win rate → probability delta
 *   2. Apply delta to base win probability (clamped to [0.05, 0.90])
 *   3. Run game-specific resolver with weighted RNG
 *   4. Cap payout at maxPayoutMultiplier
 *   5. Record round stats for future corrections
 *   6. Return result with diagnostics
 */

import {
  DEFAULT_CONFIG, BASE_WIN_PROB, GAME_TARGET_RTP,
  type GameMode, type OutcomeConfig,
} from './outcomeConfig';
import { computeProbabilityDelta } from './rtpBalancer';
import { createSessionTracker, type SessionTracker } from './sessionTracker';
import {
  resolveRoulette, resolveBlackjack, resolveBaccarat, resolvePoker,
  type RoundResult,
} from './gameResolvers';

export type { RoundResult } from './gameResolvers';

export interface ResolveInput {
  bet: number;
  config?: Partial<OutcomeConfig>;
}

export interface ResolveOutput extends RoundResult {
  effectiveWinProb: number;
  rtpDelta: number;
  sessionRTP: number;
  winRateLast20: number;
}

export interface OutcomeEngine {
  resolve: (input: ResolveInput) => ResolveOutput;
  getStats: () => ReturnType<SessionTracker['getStats']>;
  resetSession: () => void;
}

/** Create an isolated outcome engine for a specific game mode */
export function createOutcomeEngine(gameMode: GameMode): OutcomeEngine {
  const tracker = createSessionTracker();

  // Use per-game target RTP
  const gameConfig: OutcomeConfig = {
    ...DEFAULT_CONFIG,
    targetRTP: GAME_TARGET_RTP[gameMode],
  };

  return {
    resolve(input: ResolveInput): ResolveOutput {
      const config = { ...gameConfig, ...input.config };
      const { bet } = input;

      // 1. Compute probability delta
      const rtpDelta = computeProbabilityDelta(config, tracker);

      // 2. Effective win probability — clamped to [0.05, 0.65]
      // Hard cap at 0.65 — even with max boost, player can't win more than 65% of rounds
      const baseProb = BASE_WIN_PROB[gameMode];
      const effectiveWinProb = Math.max(0.05, Math.min(0.65, baseProb + rtpDelta));

      // 3. Resolve outcome
      let result: RoundResult;
      switch (gameMode) {
        case 'roulette':  result = resolveRoulette(bet, effectiveWinProb, config.volatility);  break;
        case 'blackjack': result = resolveBlackjack(bet, effectiveWinProb, config.volatility); break;
        case 'baccarat':  result = resolveBaccarat(bet, effectiveWinProb, config.volatility);  break;
        case 'poker':     result = resolvePoker(bet, effectiveWinProb, config.volatility);     break;
      }

      // 4. Cap payout
      const cappedPayout = Math.min(result.payout, bet * config.maxPayoutMultiplier);
      result = { ...result, payout: cappedPayout };

      // 5. Record round
      tracker.record(bet, result.payout, result.isBigWin);

      const stats = tracker.getStats();
      const sessionRTP = stats.totalBet > 0
        ? Math.round((stats.totalPayout / stats.totalBet) * 10000) / 100
        : 0;
      const winRateLast20 = tracker.getWinRateLastN(20);

      if (import.meta.env.DEV) {
        console.log(`[OutcomeEngine:${gameMode}]`, {
          bet,
          effectiveWinProb: `${(effectiveWinProb * 100).toFixed(1)}%`,
          rtpDelta: `${(rtpDelta * 100).toFixed(2)}%`,
          outcome: result.outcome,
          payout: result.payout,
          sessionRTP: `${sessionRTP}%`,
          winRateLast20: `${(winRateLast20 * 100).toFixed(0)}%`,
        });
      }

      return { ...result, effectiveWinProb, rtpDelta, sessionRTP, winRateLast20 };
    },

    getStats() {
      return tracker.getStats();
    },

    resetSession() {
      tracker.reset();
    },
  };
}

// ─── Legacy singleton (backward compat with LiveTableRoom) ───────────────────
// Each game mode gets its own singleton engine
const _engines: Partial<Record<GameMode, OutcomeEngine>> = {};

export const outcomeEngine = {
  resolve(input: { gameMode: GameMode; bet: number; config?: Partial<OutcomeConfig> }): ResolveOutput {
    if (!_engines[input.gameMode]) {
      _engines[input.gameMode] = createOutcomeEngine(input.gameMode);
    }
    return _engines[input.gameMode]!.resolve({ bet: input.bet, config: input.config });
  },
  getStats(gameMode: GameMode) {
    return _engines[gameMode]?.getStats();
  },
};
