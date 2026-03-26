export type GameType = 'blackjack' | 'roulette' | 'baccarat' | 'poker';
export type TableStatus = 'live' | 'waiting' | 'full';

export interface LiveTable {
  id: string;
  gameType: GameType;
  name: string;
  dealerName: string;
  dealerAvatar: string;
  currentPlayers: number;
  maxPlayers: number;
  minBet: number;
  maxBet: number;
  status: TableStatus;
  featured?: boolean;
}

export const INITIAL_TABLES: LiveTable[] = [
  // Blackjack
  { id: 'bj-1', gameType: 'blackjack', name: 'Neon Blackjack VIP', dealerName: 'Sophia', dealerAvatar: '👩', currentPlayers: 5, maxPlayers: 7, minBet: 50, maxBet: 5000, status: 'live', featured: true },
  { id: 'bj-2', gameType: 'blackjack', name: 'Classic Blackjack', dealerName: 'Marcus', dealerAvatar: '👨', currentPlayers: 3, maxPlayers: 7, minBet: 5, maxBet: 500, status: 'live' },
  { id: 'bj-3', gameType: 'blackjack', name: 'Speed Blackjack', dealerName: 'Elena', dealerAvatar: '👩‍🦰', currentPlayers: 7, maxPlayers: 7, minBet: 10, maxBet: 1000, status: 'full' },
  // Roulette
  { id: 'rl-1', gameType: 'roulette', name: 'Lightning Roulette', dealerName: 'Viktor', dealerAvatar: '👨‍🦱', currentPlayers: 12, maxPlayers: 20, minBet: 1, maxBet: 2000, status: 'live', featured: true },
  { id: 'rl-2', gameType: 'roulette', name: 'European Roulette', dealerName: 'Aria', dealerAvatar: '👩‍🦳', currentPlayers: 6, maxPlayers: 20, minBet: 1, maxBet: 500, status: 'live' },
  { id: 'rl-3', gameType: 'roulette', name: 'Neon Roulette', dealerName: 'Zara', dealerAvatar: '🧑', currentPlayers: 0, maxPlayers: 20, minBet: 5, maxBet: 1000, status: 'waiting' },
  // Baccarat
  { id: 'bc-1', gameType: 'baccarat', name: 'Baccarat Noir', dealerName: 'James', dealerAvatar: '🧑‍💼', currentPlayers: 4, maxPlayers: 9, minBet: 10, maxBet: 3000, status: 'live', featured: true },
  { id: 'bc-2', gameType: 'baccarat', name: 'Speed Baccarat', dealerName: 'Luna', dealerAvatar: '👩‍🦱', currentPlayers: 9, maxPlayers: 9, minBet: 5, maxBet: 1000, status: 'full' },
  { id: 'bc-3', gameType: 'baccarat', name: 'Mini Baccarat', dealerName: 'Chen', dealerAvatar: '🧑‍🦲', currentPlayers: 2, maxPlayers: 9, minBet: 1, maxBet: 200, status: 'live' },
  // Poker
  { id: 'pk-1', gameType: 'poker', name: 'Texas Hold\'em VIP', dealerName: 'Dante', dealerAvatar: '🧔', currentPlayers: 5, maxPlayers: 9, minBet: 25, maxBet: 10000, status: 'live', featured: true },
  { id: 'pk-2', gameType: 'poker', name: 'Casino Hold\'em', dealerName: 'Mia', dealerAvatar: '👩‍🦰', currentPlayers: 3, maxPlayers: 9, minBet: 5, maxBet: 500, status: 'live' },
  { id: 'pk-3', gameType: 'poker', name: 'Three Card Poker', dealerName: 'Rex', dealerAvatar: '👨‍🦳', currentPlayers: 0, maxPlayers: 9, minBet: 5, maxBet: 300, status: 'waiting' },
];

export const GAME_CATEGORIES: { id: GameType | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: 'All Tables', icon: '🎮' },
  { id: 'blackjack', label: 'Blackjack', icon: '🃏' },
  { id: 'roulette', label: 'Roulette', icon: '🎡' },
  { id: 'baccarat', label: 'Baccarat', icon: '🎴' },
  { id: 'poker', label: 'Poker', icon: '♠️' },
];

export const CHIP_VALUES = [1, 5, 10, 50, 100, 500];

// Payout multipliers per game
export const PAYOUTS: Record<GameType, Record<string, number>> = {
  roulette: { win: 2, zero: 36 },
  blackjack: { win: 2, blackjack: 2.5, push: 1 },
  baccarat: { player: 2, banker: 1.95, tie: 9 },
  poker: { win: 2, pair: 1.5, flush: 3 },
};
