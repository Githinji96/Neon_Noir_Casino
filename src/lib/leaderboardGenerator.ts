/**
 * Leaderboard Generator
 * Generates a pool of 1000+ fictitious casino players with realistic win data.
 * Designed to be replaced with a real API in the future.
 */

export type LeaderboardGameType = 'slot' | 'blackjack' | 'roulette' | 'baccarat' | 'poker';

export interface LeaderboardEntry {
  id: string;
  username: string;
  country: string;
  countryFlag: string;
  game: string;
  gameType: LeaderboardGameType;
  amount: number;
  timestamp: number; // unix ms
  avatar: string;
  isRealPlayer?: boolean;
  userId?: string;
}

// ─── Data pools ───────────────────────────────────────────────────────────────

const BASE_NAMES = [
  'LuckyAce', 'SpinMaster', 'NeonWolf', 'CryptoKing', 'LadyLuck',
  'NightFox', 'RoyalFlush', 'MegaSpin', 'JackpotHunter', 'LuckyPanda',
  'ShadowPlayer', 'NovaKing', 'GoldenSeven', 'QueenLuck', 'DarkPhoenix',
  'SilentWolf', 'DiamondKing', 'CashMachine', 'SpinWizard', 'BetLegend',
  'FireWolf', 'IceQueen', 'StarGazer', 'ThunderBolt', 'CyberAce',
  'GoldRush', 'LuckyDragon', 'NeonTiger', 'CrystalBet', 'PhoenixRise',
  'WildCard', 'JokerKing', 'SilverFox', 'GoldenEagle', 'NightStar',
  'SpeedDemon', 'LuckMaster', 'VaultHunter', 'BetKing', 'SpinQueen',
  'NeonRider', 'CashFlow', 'GrandSlam', 'PlatinumAce', 'DiamondRush',
  'LuckyCharm', 'SpinDoctor', 'BetWizard', 'GoldMiner', 'CryptoWolf',
  'ShadowFox', 'NeonKnight', 'FireDragon', 'IceWolf', 'StarPlayer',
  'ThunderKing', 'CyberWolf', 'GoldFever', 'LuckyStrike', 'NeonPanda',
  'CrystalKing', 'PhoenixBlaze', 'WildSpin', 'JokerAce', 'SilverStar',
  'GoldenPath', 'NightHunter', 'SpeedKing', 'LuckSeeker', 'VaultMaster',
];

const COUNTRIES: { name: string; flag: string }[] = [
  { name: 'Kenya', flag: '🇰🇪' },
  { name: 'USA', flag: '🇺🇸' },
  { name: 'UK', flag: '🇬🇧' },
  { name: 'Canada', flag: '🇨🇦' },
  { name: 'Germany', flag: '🇩🇪' },
  { name: 'Japan', flag: '🇯🇵' },
  { name: 'Korea', flag: '🇰🇷' },
  { name: 'China', flag: '🇨🇳' },
  { name: 'South Africa', flag: '🇿🇦' },
  { name: 'Brazil', flag: '🇧🇷' },
  { name: 'Australia', flag: '🇦🇺' },
  { name: 'France', flag: '🇫🇷' },
  { name: 'Nigeria', flag: '🇳🇬' },
  { name: 'India', flag: '🇮🇳' },
  { name: 'Mexico', flag: '🇲🇽' },
  { name: 'UAE', flag: '🇦🇪' },
];

// Real games from the app — slots + live tables, with their actual bet ranges
// and realistic max payout multipliers so generated wins look credible.
//
// Slot max multiplier reference (from gameConfig payout table):
//   wild 5x = 500× bet, seven 5x = 80× bet, typical big win ~50-200× bet
// Live table max multiplier reference:
//   Roulette straight-up = 36×, Blackjack natural = 2.5×, Baccarat tie = 9×,
//   Poker straight flush = 40×
interface GameEntry {
  name: string;
  type: LeaderboardGameType;
  minBet: number;   // smallest realistic bet a player would place
  maxBet: number;   // largest realistic single bet
  maxMult: number;  // maximum realistic payout multiplier for this game
}

const GAMES: GameEntry[] = [
  // ── Slots (bet ladder: 0.20 – 10,000; typical sessions 1–500) ────────────
  { name: 'Cyber Strike 777',   type: 'slot',      minBet: 100,  maxBet: 500,   maxMult: 200  },
  { name: 'Neon Jungle Fruits', type: 'slot',      minBet: 1,    maxBet: 200,   maxMult: 150  },
  { name: 'Dark Matter Reels',  type: 'slot',      minBet: 1,    maxBet: 200,   maxMult: 200  },
  { name: 'Quantum Vault',      type: 'slot',      minBet: 1,    maxBet: 200,   maxMult: 150  },
  { name: 'Neon Samurai',       type: 'slot',      minBet: 1,    maxBet: 200,   maxMult: 180  },
  { name: 'Electric Storm',     type: 'slot',      minBet: 1,    maxBet: 200,   maxMult: 200  },
  { name: 'Crystal Grid',       type: 'slot',      minBet: 1,    maxBet: 100,   maxMult: 120  },
  { name: 'Solar Flare',        type: 'slot',      minBet: 1,    maxBet: 100,   maxMult: 120  },
  { name: 'Midnight Heist',     type: 'slot',      minBet: 1,    maxBet: 100,   maxMult: 130  },
  { name: 'Ocean Depths',       type: 'slot',      minBet: 1,    maxBet: 100,   maxMult: 120  },
  { name: 'Dragon Forge',       type: 'slot',      minBet: 1,    maxBet: 100,   maxMult: 130  },
  // ── Blackjack (max payout: 2.5× for natural BJ) ──────────────────────────
  { name: 'Neon Blackjack VIP', type: 'blackjack', minBet: 50,   maxBet: 5000,  maxMult: 3    },
  { name: 'Classic Blackjack',  type: 'blackjack', minBet: 5,    maxBet: 500,   maxMult: 3    },
  { name: 'Speed Blackjack',    type: 'blackjack', minBet: 10,   maxBet: 1000,  maxMult: 3    },
  // ── Roulette (straight-up pays 36×) ──────────────────────────────────────
  { name: 'Lightning Roulette', type: 'roulette',  minBet: 1,    maxBet: 2000,  maxMult: 36   },
  { name: 'European Roulette',  type: 'roulette',  minBet: 5,    maxBet: 500,   maxMult: 36   },
  { name: 'Neon Roulette',      type: 'roulette',  minBet: 5,    maxBet: 1000,  maxMult: 36   },
  // ── Baccarat (tie pays 9×) ────────────────────────────────────────────────
  { name: 'Baccarat Noir',      type: 'baccarat',  minBet: 10,   maxBet: 3000,  maxMult: 9    },
  { name: 'Speed Baccarat',     type: 'baccarat',  minBet: 5,    maxBet: 1000,  maxMult: 9    },
  { name: 'Mini Baccarat',      type: 'baccarat',  minBet: 5,    maxBet: 200,   maxMult: 9    },
  // ── Poker (typical max ~40× for strong hands) ─────────────────────────────
  { name: "Texas Hold'em VIP",  type: 'poker',     minBet: 25,   maxBet: 10000, maxMult: 20   },
  { name: "Casino Hold'em",     type: 'poker',     minBet: 5,    maxBet: 500,   maxMult: 20   },
  { name: 'Three Card Poker',   type: 'poker',     minBet: 5,    maxBet: 300,   maxMult: 20   },
];

const AVATARS = [
  '🧑', '👩', '🦊', '🐺', '🤖', '👾', '🎭', '🎰', '🃏', '🎲',
  '🦁', '🐯', '🐉', '🦋', '🦅', '🐼', '🦝', '🎩', '💎', '🌟',
];

// ─── Win amount generator ─────────────────────────────────────────────────────

/**
 * Generate a realistic win amount for a specific game.
 * - Picks a random bet within the game's actual bet range
 * - Applies a multiplier drawn from a realistic distribution for that game type
 * - Result is always ≤ maxBet × maxMult, grounded in real game mechanics
 */
function generateWinAmount(game: GameEntry): number {
  // Pick a realistic bet — weighted toward lower end (most players don't max-bet)
  const betFraction = Math.random() ** 2; // squared = skewed toward 0
  const bet = Math.round(game.minBet + betFraction * (game.maxBet - game.minBet));

  // Pick a multiplier based on game type — weighted toward common outcomes
  let mult: number;
  const roll = Math.random();

  if (game.type === 'slot') {
    // Slots: most wins are 1-5×, occasional 10-50×, rare 50-200×
    if (roll < 0.55) mult = rand(1, 5);
    else if (roll < 0.80) mult = rand(5, 20);
    else if (roll < 0.95) mult = rand(20, 80);
    else                  mult = rand(80, game.maxMult);
  } else if (game.type === 'roulette') {
    // Roulette: street/corner (6-8×) most common, straight-up (36×) rare
    if (roll < 0.40) mult = rand(1, 3);    // even-money bets
    else if (roll < 0.70) mult = rand(3, 9);   // dozen/column
    else if (roll < 0.90) mult = rand(9, 18);  // street/corner
    else                  mult = rand(18, 36);  // straight-up
  } else if (game.type === 'blackjack') {
    // Blackjack: almost always 1-2×, natural BJ is 2.5×
    if (roll < 0.85) mult = 2;
    else             mult = 3; // approx 2.5× rounded up
  } else if (game.type === 'baccarat') {
    // Baccarat: player/banker (1-2×), tie (9×) is rare
    if (roll < 0.90) mult = rand(1, 2);
    else             mult = rand(3, 9);
  } else {
    // Poker: most common is 1-3×, strong hands up to 20×
    if (roll < 0.60) mult = rand(1, 3);
    else if (roll < 0.90) mult = rand(3, 8);
    else                  mult = rand(8, game.maxMult);
  }

  return Math.round(bet * mult);
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Player pool ──────────────────────────────────────────────────────────────

let _playerPool: LeaderboardEntry[] = [];
const _usedNames = new Set<string>();

function generateUsername(): string {
  const base = BASE_NAMES[Math.floor(Math.random() * BASE_NAMES.length)];
  const addNumber = Math.random() < 0.6;
  const num = addNumber ? Math.floor(Math.random() * 999) + 1 : null;
  const name = num ? `${base}${num}` : base;
  if (_usedNames.has(name)) return generateUsername(); // retry on collision
  _usedNames.add(name);
  return name;
}

export function buildPlayerPool(size = 1000): LeaderboardEntry[] {
  _usedNames.clear();
  _playerPool = Array.from({ length: size }, (_, i) => {
    const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
    const gameEntry = GAMES[Math.floor(Math.random() * GAMES.length)];
    return {
      id: `fake-${i}-${Math.random().toString(36).slice(2)}`,
      username: generateUsername(),
      country: country.name,
      countryFlag: country.flag,
      game: gameEntry.name,
      gameType: gameEntry.type,
      amount: generateWinAmount(gameEntry),
      timestamp: Date.now() - rand(0, 3600000),
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
    };
  });
  return _playerPool;
}

export function getPlayerPool(): LeaderboardEntry[] {
  if (_playerPool.length === 0) buildPlayerPool();
  return _playerPool;
}

/** Pick N random entries from the pool, sorted by amount desc */
export function sampleLeaderboard(
  n: number,
  excludeIds: string[] = [],
  realEntries: LeaderboardEntry[] = []
): LeaderboardEntry[] {
  const pool = getPlayerPool().filter((p) => !excludeIds.includes(p.id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const fake = shuffled.slice(0, n - realEntries.length);

  // Give fake entries fresh timestamps and re-roll amount per game's bet range
  const stamped = fake.map((p) => {
    const gameEntry = GAMES.find((g) => g.name === p.game) ?? GAMES[0];
    return {
      ...p,
      timestamp: Date.now() - rand(5000, 3600000),
      amount: generateWinAmount(gameEntry),
    };
  });

  return [...realEntries, ...stamped].sort((a, b) => b.amount - a.amount);
}

/** Generate a single new winner for the live feed */
export function generateFeedEntry(): LeaderboardEntry {
  const pool = getPlayerPool();
  const p = pool[Math.floor(Math.random() * pool.length)];
  const gameEntry = GAMES[Math.floor(Math.random() * GAMES.length)];
  return {
    ...p,
    id: `feed-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    game: gameEntry.name,
    gameType: gameEntry.type,
    amount: generateWinAmount(gameEntry),
    timestamp: Date.now(),
  };
}

export function formatTimeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 15000) return 'Just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)} sec ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  return `${Math.floor(diff / 3600000)} hr ago`;
}

export function formatAmount(n: number): string {
  return `KES ${n.toLocaleString('en-US')}`;
}
