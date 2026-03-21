export type SymbolId =
  | 'bell'
  | 'star'
  | 'heart'
  | 'diamond'
  | 'coin'
  | 'shield'
  | 'skull'
  | 'token'
  | 'seven'
  | 'wild'
  | 'scatter';

export interface Symbol {
  id: SymbolId;
  label: string;
  emoji: string;
  weight: number;
  multiplier: number;
  isPremium: boolean;
}

export const SYMBOLS: Symbol[] = [
  { id: 'bell',    label: 'Bell',    emoji: '🔔', weight: 20, multiplier: 1, isPremium: false },
  { id: 'star',    label: 'Star',    emoji: '⭐', weight: 18, multiplier: 1, isPremium: false },
  { id: 'heart',   label: 'Heart',   emoji: '❤️', weight: 18, multiplier: 1, isPremium: false },
  { id: 'diamond', label: 'Diamond', emoji: '💎', weight: 15, multiplier: 2, isPremium: false },
  { id: 'coin',    label: 'Coin',    emoji: '🪙', weight: 15, multiplier: 2, isPremium: false },
  { id: 'shield',  label: 'Shield',  emoji: '🛡️', weight: 12, multiplier: 3, isPremium: false },
  { id: 'skull',   label: 'Skull',   emoji: '💀', weight: 12, multiplier: 3, isPremium: false },
  { id: 'token',   label: 'Token',   emoji: '🎰', weight: 10, multiplier: 4, isPremium: false },
  { id: 'seven',   label: 'Seven',   emoji: '7️⃣', weight:  6, multiplier: 5, isPremium: true  },
  { id: 'wild',    label: 'Wild',    emoji: '🃏', weight:  3, multiplier: 0, isPremium: true  },
  { id: 'scatter', label: 'Scatter', emoji: '🌀', weight:  3, multiplier: 0, isPremium: true  },
];

export const TOTAL_WEIGHT = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

export function getSymbol(id: SymbolId): Symbol {
  const symbol = SYMBOLS.find(s => s.id === id);
  if (!symbol) throw new Error(`Unknown symbol id: ${id}`);
  return symbol;
}
