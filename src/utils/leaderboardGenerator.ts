/**
 * Leaderboard Generator
 * Generates a pool of 1000+ fictitious players with realistic casino data.
 * No backend required — entirely client-side simulation.
 */

const NAME_PREFIXES = [
  'Lucky','Spin','Neon','Crypto','Lady','Night','Royal','Mega','Jackpot','Shadow',
  'Nova','Golden','Dark','Silent','Diamond','Cash','Bet','Hyper','Cyber','Turbo',
  'Wild','Blaze','Flash','Storm','Volt','Ace','King','Queen','Wolf','Tiger',
  'Dragon','Phoenix','Panda','Fox','Hawk','Viper','Ghost','Ninja','Samurai','Rogue',
];

const NAME_SUFFIXES = [
  'Ace','Master','Wolf','King','Luck','Fox','Flush','Spin','Hunter','Panda',
  'Player','Nova','Seven','Star','Phoenix','Wizard','Legend','Hero','Shark','Pro',
  'Boss','Chief','Lord','Duke','Prince','Rider','Racer','Dealer','Punter','Crusher',
];

const COUNTRIES = [
  { code: 'KE', flag: '🇰🇪', name: 'Kenya' },
  { code: 'US', flag: '🇺🇸', name: 'USA' },
  { code: 'GB', flag: '🇬🇧', name: 'UK' },
  { code: 'CA', flag: '🇨🇦', name: 'Canada' },
  { code: 'DE', flag: '🇩🇪', name: 'Germany' },
  { code: 'JP', flag: '🇯🇵', name: 'Japan' },
  { code: 'KR', flag: '🇰🇷', name: 'Korea' },
  { code: 'CN', flag: '🇨🇳', name: 'China' },
  { code: 'ZA', flag: '🇿🇦', name: 'South Africa' },
  { code: 'BR', flag: '🇧🇷', name: 'Brazil' },
  { code: 'AU', flag: '🇦🇺', name: 'Australia' },
  { code: 'FR', flag: '🇫🇷', name: 'France' },
  { code: 'NG', flag: '🇳🇬', name: 'Nigeria' },
  { code: 'GH', flag: '🇬🇭', name: 'Ghana' },
  { code: 'IN', flag: '🇮🇳', name: 'India' },
  { code: 'MX', flag: '🇲🇽', name: 'Mexico' },
  { code: 'AE', flag: '🇦🇪', name: 'UAE' },
  { code: 'SG', flag: '🇸🇬', name: 'Singapore' },
];

// Real game titles from the app — slots (from GAME_LISTINGS) + live tables (from liveTablesData)
export const GAMES = [
  // ── Slot games ─────────────────────────────────────────────────────────────
  'Cyber Strike 777',
  'Neon Jungle Fruits',
  'Dark Matter Reels',
  'Quantum Vault',
  'Neon Samurai',
  'Electric Storm',
  'Crystal Grid',
  'Solar Flare',
  'Midnight Heist',
  'Ocean Depths',
  'Dragon Forge',
  // ── Live Blackjack ─────────────────────────────────────────────────────────
  'Neon Blackjack VIP',
  'Classic Blackjack',
  'Speed Blackjack',
  // ── Live Roulette ──────────────────────────────────────────────────────────
  'Lightning Roulette',
  'European Roulette',
  'Neon Roulette',
  // ── Live Baccarat ──────────────────────────────────────────────────────────
  'Baccarat Noir',
  'Speed Baccarat',
  'Mini Baccarat',
  // ── Live Poker ─────────────────────────────────────────────────────────────
  "Texas Hold'em VIP",
  "Casino Hold'em",
  'Three Card Poker',
];

const AVATARS = [
  '😎','🤠','👑','🦊','🐯','🦁','🐺','🤖','👾','🎭',
  '🃏','🎲','🦅','🐉','🦄','👽','🤑','💎','🎰','⚡',
];

// Win amount distribution — weighted toward small wins, rare large wins
function generateWinAmount(): number {
  const roll = Math.random();
  if (roll < 0.45) return randInt(350, 2500);           // Common
  if (roll < 0.70) return randInt(2500, 12000);          // Mid
  if (roll < 0.88) return randInt(12000, 80000);         // Medium
  if (roll < 0.96) return randInt(80000, 515000);        // Large
  if (roll < 0.995) return randInt(515000, 2800000);     // Rare
  return randInt(2800000, 12000000);                      // Mega Jackpot
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let _namePool: Set<string> = new Set();

function generateUsername(): string {
  let name: string;
  let attempts = 0;
  do {
    const prefix = pick(NAME_PREFIXES);
    const suffix = pick(NAME_SUFFIXES);
    const num = Math.random() < 0.4 ? String(randInt(1, 999)) : '';
    name = `${prefix}${suffix}${num}`;
    attempts++;
  } while (_namePool.has(name) && attempts < 50);
  _namePool.add(name);
  return name;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  username: string;
  avatar: string;
  country: typeof COUNTRIES[number];
  game: string;
  amount: number;
  timestamp: number; // ms since epoch
  isNew?: boolean;
  movedUp?: boolean;
}

// Generate the full player pool once
let _playerPool: Omit<LeaderboardEntry, 'rank' | 'isNew' | 'movedUp'>[] = [];

export function initPlayerPool(size = 1200): void {
  _namePool = new Set();
  _playerPool = Array.from({ length: size }, (_, i) => ({
    id: `player_${i}_${Math.random().toString(36).slice(2)}`,
    username: generateUsername(),
    avatar: pick(AVATARS),
    country: pick(COUNTRIES),
    game: pick(GAMES),
    amount: generateWinAmount(),
    timestamp: Date.now() - randInt(0, 3600000), // up to 1hr ago
  }));
}

export function getInitialLeaderboard(count = 30): LeaderboardEntry[] {
  if (_playerPool.length === 0) initPlayerPool();
  // Sort by amount desc, take top N
  return [..._playerPool]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, count)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

export function generateNewEntry(): Omit<LeaderboardEntry, 'rank'> {
  _namePool = new Set(_playerPool.map(p => p.username)); // reset from pool
  const username = generateUsername();
  const entry = {
    id: `new_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    username,
    avatar: pick(AVATARS),
    country: pick(COUNTRIES),
    game: pick(GAMES),
    amount: generateWinAmount(),
    timestamp: Date.now(),
    isNew: true,
  };
  // Add to pool for future reference
  _playerPool.push(entry);
  if (_playerPool.length > 2000) _playerPool.shift(); // cap pool size
  return entry;
}

export function formatTimeAgo(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 5)   return 'Just now';
  if (diff < 60)  return `${diff} sec ago`;
  if (diff < 120) return '1 min ago';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  return `${Math.floor(diff / 3600)} hr ago`;
}

export function formatAmount(amount: number): string {
  return `KES ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getAmountColor(amount: number): string {
  if (amount >= 2800000) return '#FF00FF'; // mega — pink
  if (amount >= 515000)  return '#FFD700'; // rare — gold
  if (amount >= 80000)   return '#00FFFF'; // large — cyan
  if (amount >= 12000)   return '#00ff88'; // medium — green
  return '#a0e090';                         // common — light green
}

export function generateActivityMessage(entry: LeaderboardEntry): string {
  const amt = entry.amount;
  if (amt >= 2800000) return `🏆 ${entry.username} won the MEGA JACKPOT on ${entry.game}!`;
  if (amt >= 515000)  return `💰 ${entry.username} hit KES ${(amt/1000).toFixed(0)}K on ${entry.game}`;
  if (amt >= 80000)   return `🔥 ${entry.username} won KES ${(amt/1000).toFixed(0)}K on ${entry.game}`;
  return `🎰 ${entry.username} won KES ${amt.toLocaleString()} on ${entry.game}`;
}
