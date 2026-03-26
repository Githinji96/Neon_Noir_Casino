export type SymbolId =
  // Shared specials
  | 'wild' | 'scatter'
  // Cyber Strike 777
  | 'seven' | 'bar' | 'cherry' | 'lemon' | 'orange' | 'grape' | 'bolt' | 'cyber_wild'
  // Neon Jungle Fruits
  | 'watermelon' | 'pineapple' | 'mango' | 'coconut' | 'banana' | 'kiwi' | 'jungle_gem' | 'parrot'
  // Dark Matter Reels
  | 'blackhole' | 'nebula' | 'asteroid' | 'comet' | 'planet' | 'alien' | 'dark_crystal' | 'void'
  // Quantum Vault
  | 'atom' | 'electron' | 'quark' | 'photon' | 'neutron' | 'proton' | 'quantum_key' | 'vault'
  // Neon Samurai
  | 'katana' | 'shuriken' | 'mask' | 'dragon' | 'lotus' | 'lantern' | 'shogun' | 'torii'
  // Electric Storm
  | 'lightning' | 'thunder' | 'cloud' | 'raindrop' | 'tornado' | 'hail' | 'storm_eye' | 'rainbow';

export interface Symbol {
  id: SymbolId;
  label: string;
  emoji: string;
  weight: number;
  multiplier: number;
  isPremium: boolean;
}

// Base weights/multipliers — same structure across all themes
const BASE: Omit<Symbol, 'id' | 'label' | 'emoji'>[] = [
  { weight: 20, multiplier: 1,   isPremium: false }, // common 1
  { weight: 18, multiplier: 1,   isPremium: false }, // common 2
  { weight: 18, multiplier: 1,   isPremium: false }, // common 3
  { weight: 15, multiplier: 2,   isPremium: false }, // mid 1
  { weight: 15, multiplier: 2,   isPremium: false }, // mid 2
  { weight: 12, multiplier: 3,   isPremium: false }, // mid-high 1
  { weight: 10, multiplier: 4,   isPremium: false }, // high
  { weight:  6, multiplier: 5,   isPremium: true  }, // premium
  { weight:  3, multiplier: 0,   isPremium: true  }, // wild
  { weight:  3, multiplier: 0,   isPremium: true  }, // scatter
];

function make(id: SymbolId, label: string, emoji: string, idx: number): Symbol {
  return { id, label, emoji, ...BASE[idx] };
}

// ── Cyber Strike 777 ────────────────────────────────────────────────────────
export const CYBER_SYMBOLS: Symbol[] = [
  make('cherry',     'Cherry',     '🍒', 0),
  make('lemon',      'Lemon',      '🍋', 1),
  make('orange',     'Orange',     '🍊', 2),
  make('grape',      'Grape',      '🍇', 3),
  make('bar',        'BAR',        '🎰', 4),
  make('bolt',       'Bolt',       '⚡', 5),
  make('cyber_wild', 'Cyber',      '🤖', 6),
  make('seven',      'Seven',      '7️⃣', 7),
  make('wild',       'Wild',       '🃏', 8),
  make('scatter',    'Scatter',    '🌀', 9),
];

// ── Neon Jungle Fruits ───────────────────────────────────────────────────────
export const JUNGLE_SYMBOLS: Symbol[] = [
  make('banana',     'Banana',     '🍌', 0),
  make('kiwi',       'Kiwi',       '🥝', 1),
  make('mango',      'Mango',      '🥭', 2),
  make('pineapple',  'Pineapple',  '🍍', 3),
  make('watermelon', 'Watermelon', '🍉', 4),
  make('coconut',    'Coconut',    '🥥', 5),
  make('parrot',     'Parrot',     '🦜', 6),
  make('jungle_gem', 'Gem',        '💚', 7),
  make('wild',       'Wild',       '🃏', 8),
  make('scatter',    'Scatter',    '🌺', 9),
];

// ── Dark Matter Reels ────────────────────────────────────────────────────────
export const DARK_MATTER_SYMBOLS: Symbol[] = [
  make('asteroid',     'Asteroid',  '☄️',  0),
  make('comet',        'Comet',     '🌠', 1),
  make('nebula',       'Nebula',    '🌌', 2),
  make('planet',       'Planet',    '🪐', 3),
  make('alien',        'Alien',     '👾', 4),
  make('void',         'Void',      '🕳️',  5),
  make('dark_crystal', 'Crystal',   '🔮', 6),
  make('blackhole',    'Blackhole', '⚫', 7),
  make('wild',         'Wild',      '🃏', 8),
  make('scatter',      'Scatter',   '✨', 9),
];

// ── Quantum Vault ────────────────────────────────────────────────────────────
export const QUANTUM_SYMBOLS: Symbol[] = [
  make('electron',    'Electron',  '⚛️',  0),
  make('quark',       'Quark',     '🔵', 1),
  make('photon',      'Photon',    '💡', 2),
  make('neutron',     'Neutron',   '⚪', 3),
  make('proton',      'Proton',    '🔴', 4),
  make('atom',        'Atom',      '🧬', 5),
  make('quantum_key', 'Q-Key',     '🗝️',  6),
  make('vault',       'Vault',     '🏦', 7),
  make('wild',        'Wild',      '🃏', 8),
  make('scatter',     'Scatter',   '🌀', 9),
];

// ── Neon Samurai ─────────────────────────────────────────────────────────────
export const SAMURAI_SYMBOLS: Symbol[] = [
  make('shuriken', 'Shuriken', '🌟', 0),
  make('lotus',    'Lotus',    '🌸', 1),
  make('lantern',  'Lantern',  '🏮', 2),
  make('torii',    'Torii',    '⛩️',  3),
  make('mask',     'Mask',     '🎭', 4),
  make('dragon',   'Dragon',   '🐉', 5),
  make('katana',   'Katana',   '⚔️',  6),
  make('shogun',   'Shogun',   '👺', 7),
  make('wild',     'Wild',     '🃏', 8),
  make('scatter',  'Scatter',  '🎋', 9),
];

// ── Electric Storm ───────────────────────────────────────────────────────────
export const STORM_SYMBOLS: Symbol[] = [
  make('raindrop',  'Raindrop',  '💧', 0),
  make('cloud',     'Cloud',     '☁️',  1),
  make('hail',      'Hail',      '🌨️',  2),
  make('tornado',   'Tornado',   '🌪️',  3),
  make('thunder',   'Thunder',   '🌩️',  4),
  make('rainbow',   'Rainbow',   '🌈', 5),
  make('lightning', 'Lightning', '⚡', 6),
  make('storm_eye', 'Eye',       '🌀', 7),
  make('wild',      'Wild',      '🃏', 8),
  make('scatter',   'Scatter',   '❄️',  9),
];

// ── Registry ─────────────────────────────────────────────────────────────────
export const GAME_SYMBOLS: Record<string, Symbol[]> = {
  'cyber-strike-777':   CYBER_SYMBOLS,
  'neon-jungle-fruits': JUNGLE_SYMBOLS,
  'dark-matter-reels':  DARK_MATTER_SYMBOLS,
  'quantum-vault':      QUANTUM_SYMBOLS,
  'neon-samurai':       SAMURAI_SYMBOLS,
  'electric-storm':     STORM_SYMBOLS,
};

export function getSymbolsForGame(gameId: string): Symbol[] {
  return GAME_SYMBOLS[gameId] ?? CYBER_SYMBOLS;
}

// Legacy — used by existing code that imports SYMBOLS directly (defaults to Cyber Strike)
export const SYMBOLS = CYBER_SYMBOLS;
export const TOTAL_WEIGHT = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

export function getSymbol(id: SymbolId): Symbol {
  // Search all symbol sets
  for (const set of Object.values(GAME_SYMBOLS)) {
    const found = set.find((s) => s.id === id);
    if (found) return found;
  }
  throw new Error(`Unknown symbol id: ${id}`);
}
