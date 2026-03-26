/**
 * Outcome Engine — Configuration
 * All tunable parameters. No magic numbers in logic files.
 */

export type VolatilityLevel = 'low' | 'medium' | 'high';
export type GameMode = 'roulette' | 'blackjack' | 'baccarat' | 'poker';

export interface OutcomeConfig {
  targetRTP: number;           // e.g. 0.96
  volatility: VolatilityLevel;
  maxRTPAdjustment: number;    // max ±fraction bias can shift base probability (e.g. 0.05 = 5%)
  sessionStreakThreshold: number; // consecutive wins/losses before soft compensation kicks in
  maxPayoutMultiplier: number; // hard cap on single-round payout as multiple of bet
}

export const DEFAULT_CONFIG: OutcomeConfig = {
  targetRTP: 0.96,
  volatility: 'medium',
  maxRTPAdjustment: 0.05,
  sessionStreakThreshold: 6,
  maxPayoutMultiplier: 20,
};

/** Base win probabilities per game (before any RTP adjustment) */
export const BASE_WIN_PROB: Record<GameMode, number> = {
  roulette:  0.4865, // European roulette red/black
  blackjack: 0.4750, // player win rate vs dealer
  baccarat:  0.4462, // player hand win rate
  poker:     0.4500, // simplified player win rate
};

/** Payout multipliers per game outcome */
export const GAME_PAYOUTS: Record<GameMode, Record<string, number>> = {
  roulette:  { win: 2,    zero: 36 },
  blackjack: { win: 2,    blackjack: 2.5, push: 1 },
  baccarat:  { player: 2, banker: 1.95,   tie: 9 },
  poker:     { win: 2,    pair: 1.5,       flush: 3 },
};

/** Volatility modifiers — affect payout size distribution */
export const VOLATILITY_MODIFIERS: Record<VolatilityLevel, {
  bigWinChance: number;   // extra probability of a big win outcome
  bigWinMultiplier: number; // multiplier applied on big win
  smallWinBoost: number;  // boost to small win frequency
}> = {
  low:    { bigWinChance: 0.01, bigWinMultiplier: 3,  smallWinBoost: 1.2 },
  medium: { bigWinChance: 0.03, bigWinMultiplier: 5,  smallWinBoost: 1.0 },
  high:   { bigWinChance: 0.06, bigWinMultiplier: 10, smallWinBoost: 0.8 },
};
