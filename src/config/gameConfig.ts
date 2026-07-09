/**
 * Central game configuration — tweak weights, RTP, volatility here.
 */

export type Volatility = 'low' | 'medium' | 'high';

export const GAME_CONFIG = {
  targetRTP: 0.965,       // 96.5% effective (base game RTP varies per game — see GAME_BASE_RTP)
  volatility: 'high' as Volatility,
  reels: 5,
  rows: 3,
  minScatterForBonus: 3,
  freeSpinsCount: 10,
  freeSpinsMultiplier: 2,
  nearWinProbability: 0.08,
  jackpotProbability: 0.0005,
};

/**
 * Per-game base RTP targets for the slot engine (rtpController).
 * These are LOWER than the effective RTP because the jackpot contribution
 * makes up the difference.
 *
 * Formula: baseRTP = targetRTP - contributionRate
 * e.g. cyber-strike-777: 0.965 - 0.02 = 0.945
 */
export const GAME_BASE_RTP: Record<string, number> = {
  'cyber-strike-777':   0.945,  // 96.5% effective − 2% jackpot contribution
  'electric-storm':     0.955,  // 96.5% effective − 1% jackpot contribution
  'quantum-vault':      0.950,  // 96.5% effective − 1.5% jackpot contribution
  'dark-matter-reels':  0.960,  // 96.5% effective − 0.5% jackpot contribution
  'neon-samurai':       0.960,  // 96.5% effective − 0.5% jackpot contribution
  'neon-jungle-fruits': 0.965,  // no jackpot — full RTP in base game
};

export function getBaseRTPForGame(gameId: string): number {
  return GAME_BASE_RTP[gameId] ?? GAME_CONFIG.targetRTP;
}

// Per-volatility dead spin rates (% of spins with no win)
export const DEAD_SPIN_RATES: Record<Volatility, number> = {
  low:    0.35,
  medium: 0.48,
  high:   0.60,
};

// Symbol weight modifiers per volatility (multiplied onto base weight)
export const VOLATILITY_WEIGHT_MODIFIERS: Record<Volatility, Record<string, number>> = {
  low: {
    bell: 1.4, star: 1.4, heart: 1.4,
    diamond: 1.2, coin: 1.2,
    shield: 0.9, skull: 0.9,
    token: 0.7, seven: 0.5,
    wild: 0.4, scatter: 0.4,
  },
  medium: {
    bell: 1.0, star: 1.0, heart: 1.0,
    diamond: 1.0, coin: 1.0,
    shield: 1.0, skull: 1.0,
    token: 1.0, seven: 1.0,
    wild: 1.0, scatter: 1.0,
  },
  high: {
    // Common symbols land more on high volatility (filling dead spins)
    bell: 0.9, star: 0.9, heart: 0.9,
    diamond: 0.8, coin: 0.8,
    // Tier 3+ symbols suppressed further — casino protection
    shield: 0.4, skull: 0.4,
    token: 0.3, seven: 0.2,
    wild: 0.5, scatter: 0.5,
  },
};

// Payout table: symbol → { 3match, 4match, 5match } multipliers (× bet)
export const PAYOUT_TABLE: Record<string, [number, number, number]> = {
  bell:    [0.5,  1,    2   ],
  star:    [0.5,  1,    2   ],
  heart:   [0.5,  1,    2   ],
  diamond: [1,    3,    8   ],
  coin:    [1,    3,    8   ],
  shield:  [2,    6,    15  ],
  skull:   [2,    6,    15  ],
  token:   [4,    12,   30  ],
  seven:   [8,    25,   80  ],
  wild:    [20,   100,  500 ],
  scatter: [0,    0,    0   ], // scatter pays via free spins only
};
