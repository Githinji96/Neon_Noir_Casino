/**
 * Outcome Engine — Main Entry Point
 *
 * Usage:
 *   const result = outcomeEngine.resolve({ gameMode: 'roulette', bet: 50 });
 *
 * Flow per round:
 *   1. Compute RTP deviation → probability delta
 *   2. Apply delta to base win probability (clamped)
 *   3. Apply volatility modifier
 *   4. Run game-specific resolver with weighted RNG
 *   5. Record round stats
 *   6. Return result
 */

import { DEFAULT_CONFIG, BASE_WIN_PROB, type GameMode, type OutcomeConfig } from './outcomeConfig';
import { computeProbabilityDelta } from './rtpBalancer';
import { recordRound, getSessionStats } from './sessionTracker';
import { resolveRoulette, resolveBlackjack, resolveBaccarat, resolvePoker, type RoundResult } from './gameResolvers';

export type { RoundResult } from './gameResolvers';

export interface ResolveInput {
  gameMode: GameMode;
  bet: number;
  config?: Partial<OutcomeConfig>;
}

export interface ResolveOutput extends RoundResult {
  effectiveWinProb: number;
  rtpDelta: number;
  sessionRTP: number;
}

// Merge user config with defaults
function mergeConfig(partial?: Partial<OutcomeConfig>): OutcomeConfig {
  return { ...DEFAULT_CONFIG, ...partial };
}

export const outcomeEngine = {
  resolve(input: ResolveInput): ResolveOutput {
    const config = mergeConfig(input.config);
    const { gameMode, bet } = input;

    // 1. Compute probability delta from RTP balancer
    const rtpDelta = computeProbabilityDelta(config);

    // 2. Effective win probability = base + delta, clamped to [0.05, 0.95]
    const baseProb = BASE_WIN_PROB[gameMode];
    const effectiveWinProb = Math.max(0.05, Math.min(0.95, baseProb + rtpDelta));

    // 3. Resolve outcome via game-specific resolver
    let result: RoundResult;
    switch (gameMode) {
      case 'roulette':  result = resolveRoulette(bet, effectiveWinProb, config.volatility);  break;
      case 'blackjack': result = resolveBlackjack(bet, effectiveWinProb, config.volatility); break;
      case 'baccarat':  result = resolveBaccarat(bet, effectiveWinProb, config.volatility);  break;
      case 'poker':     result = resolvePoker(bet, effectiveWinProb, config.volatility);     break;
    }

    // 4. Cap payout at maxPayoutMultiplier
    const cappedPayout = Math.min(result.payout, bet * config.maxPayoutMultiplier);
    result = { ...result, payout: cappedPayout };

    // 5. Record round for future RTP tracking
    recordRound(bet, result.payout, result.isBigWin);

    const stats = getSessionStats();
    const sessionRTP = stats.totalBet > 0
      ? Math.round((stats.totalPayout / stats.totalBet) * 10000) / 100
      : 0;

    if (import.meta.env.DEV) {
      console.log('[OutcomeEngine]', {
        gameMode, bet,
        effectiveWinProb: `${(effectiveWinProb * 100).toFixed(2)}%`,
        rtpDelta: `${(rtpDelta * 100).toFixed(2)}%`,
        outcome: result.outcome,
        payout: result.payout,
        sessionRTP: `${sessionRTP}%`,
      });
    }

    return { ...result, effectiveWinProb, rtpDelta, sessionRTP };
  },

  getStats() {
    return getSessionStats();
  },
};
