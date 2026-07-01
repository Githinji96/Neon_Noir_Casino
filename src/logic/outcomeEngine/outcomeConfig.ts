/**
 * Outcome Engine — Configuration
 * All tunable parameters. No magic numbers in logic files.
 */

export type VolatilityLevel = 'low' | 'medium' | 'high';
export type GameMode = 'roulette' | 'blackjack' | 'baccarat' | 'poker';

export interface OutcomeConfig {
  targetRTP: number;
  volatility: VolatilityLevel;
  maxRTPAdjustment: number;      // max ±fraction bias can shift base probability
  sessionStreakThreshold: number; // consecutive wins before soft suppression kicks in
  maxPayoutMultiplier: number;   // hard cap on single-round payout as multiple of bet
  winRateWindow: number;         // rolling window size for win rate tracking
  winRateThreshold: number;      // if win rate over window exceeds this, apply variance shift
}

export const DEFAULT_CONFIG: OutcomeConfig = {
  targetRTP: 0.96,
  volatility: 'medium',
  maxRTPAdjustment: 0.12,       // wider range — allows stronger suppression
  sessionStreakThreshold: 4,    // tighter — suppress winning streaks sooner
  maxPayoutMultiplier: 20,
  winRateWindow: 20,
  winRateThreshold: 0.45,       // suppress if player wins >45% of last 20 rounds
};

/**
 * Realistic base win probabilities per game.
 * These are the RAW probabilities BEFORE RTP correction.
 * Kept conservative — the balancer boosts when needed, never the other way.
 *
 * Real casino house edges:
 *   Blackjack: dealer wins ~49.5%, push ~8%, player wins ~42.5%
 *   Roulette:  18/37 = 48.65% on even-money (European)
 *   Baccarat:  player hand wins 44.62% of non-tie rounds
 *   Poker:     ~38% player win rate (casino hold'em style)
 */
export const BASE_WIN_PROB: Record<GameMode, number> = {
  roulette:  0.4200,  // reduced from 0.4865 — house edge enforced harder
  blackjack: 0.3800,  // reduced from 0.4250
  baccarat:  0.3900,  // reduced from 0.4462
  poker:     0.3500,  // reduced from 0.4300
};

/** Payout multipliers — what the player receives (including stake) */
export const GAME_PAYOUTS: Record<GameMode, Record<string, number>> = {
  roulette:  { win: 2, zero: 36 },
  blackjack: { win: 2, blackjack: 2.5, push: 1 },  // blackjack pays 3:2 = 2.5×
  baccarat:  { player: 2, banker: 1.95, tie: 9 },   // banker pays 0.95:1 (5% commission)
  poker:     { win: 2, pair: 1.5, flush: 3, straight: 2.5, full_house: 4 },
};

/** Volatility modifiers */
export const VOLATILITY_MODIFIERS: Record<VolatilityLevel, {
  bigWinChance: number;
  bigWinMultiplier: number;
  smallWinBoost: number;
}> = {
  low:    { bigWinChance: 0.008, bigWinMultiplier: 3,  smallWinBoost: 1.15 },
  medium: { bigWinChance: 0.020, bigWinMultiplier: 5,  smallWinBoost: 1.0  },
  high:   { bigWinChance: 0.040, bigWinMultiplier: 10, smallWinBoost: 0.8  },
};

/** Per-game target RTPs — realistic for a simulated (not perfect-play) environment */
export const GAME_TARGET_RTP: Record<GameMode, number> = {
  roulette:  0.9450,  // 94.5% — European roulette house edge applied
  blackjack: 0.9200,  // 92.0% — simulated play, not perfect strategy
  baccarat:  0.9300,  // 93.0% — reduced from unrealistic 98.76%
  poker:     0.9200,  // 92.0% — casino hold'em style
};
