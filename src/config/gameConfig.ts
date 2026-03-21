/**
 * Central game configuration — tweak weights, RTP, volatility here.
 */

export type Volatility = 'low' | 'medium' | 'high';

export const GAME_CONFIG = {
  targetRTP: 0.965,       // 96.5%
  volatility: 'high' as Volatility,
  reels: 5,
  rows: 3,
  minScatterForBonus: 3,
  freeSpinsCount: 10,
  freeSpinsMultiplier: 2, // base multiplier during free spins
  jackpotProbability: 0.001, // 0.1% chance per spin
  nearWinProbability: 0.08,  // 8% of dead spins show near-win
};

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
    bell: 0.7, star: 0.7, heart: 0.7,
    diamond: 0.9, coin: 0.9,
    shield: 1.1, skull: 1.1,
    token: 1.3, seven: 1.5,
    wild: 1.8, scatter: 1.6,
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
