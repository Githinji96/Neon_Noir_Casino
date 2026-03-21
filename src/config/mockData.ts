export interface GameListing {
  id: string;
  title: string;
  thumbnail: string;
  badge: 'HOT' | 'NEW';
  rtp: number;
  volatility: 'Low' | 'Medium' | 'High';
}

export interface JackpotData {
  id: string;
  name: string;
  baseAmount: number;
  tags: string[];
}

export interface PopularGame {
  id: string;
  title: string;
  icon: string;
  rtp: number;
  volatility: 'Low' | 'Medium' | 'High';
}

export const GAME_LISTINGS: GameListing[] = [
  {
    id: 'cyber-strike-777',
    title: 'Cyber Strike 777',
    thumbnail: 'https://picsum.photos/seed/game1/300/200',
    badge: 'HOT',
    rtp: 96.5,
    volatility: 'High',
  },
  {
    id: 'neon-jungle-fruits',
    title: 'Neon Jungle Fruits',
    thumbnail: 'https://picsum.photos/seed/game2/300/200',
    badge: 'NEW',
    rtp: 95.2,
    volatility: 'Medium',
  },
  {
    id: 'dark-matter-reels',
    title: 'Dark Matter Reels',
    thumbnail: 'https://picsum.photos/seed/game3/300/200',
    badge: 'HOT',
    rtp: 97.0,
    volatility: 'High',
  },
  {
    id: 'quantum-vault',
    title: 'Quantum Vault',
    thumbnail: 'https://picsum.photos/seed/game4/300/200',
    badge: 'NEW',
    rtp: 94.8,
    volatility: 'Low',
  },
  {
    id: 'neon-samurai',
    title: 'Neon Samurai',
    thumbnail: 'https://picsum.photos/seed/game5/300/200',
    badge: 'HOT',
    rtp: 96.1,
    volatility: 'Medium',
  },
  {
    id: 'electric-storm',
    title: 'Electric Storm',
    thumbnail: 'https://picsum.photos/seed/game6/300/200',
    badge: 'NEW',
    rtp: 95.7,
    volatility: 'High',
  },
];

export const JACKPOT_DATA: JackpotData[] = [
  {
    id: 'mega-moolah-noir',
    name: 'Mega Moolah Noir',
    baseAmount: 3429102.55,
    tags: ['Daily', 'Progressive'],
  },
  {
    id: 'electric-pulse',
    name: 'Electric Pulse',
    baseAmount: 1250000.0,
    tags: ['Hourly', 'Progressive'],
  },
  {
    id: 'crystal-vault',
    name: 'Crystal Vault',
    baseAmount: 875500.75,
    tags: ['Daily'],
  },
  {
    id: 'shadow-fortune',
    name: 'Shadow Fortune',
    baseAmount: 512000.0,
    tags: ['Weekly', 'Progressive'],
  },
  {
    id: 'neon-nexus',
    name: 'Neon Nexus',
    baseAmount: 250000.5,
    tags: ['Hourly'],
  },
];

export const POPULAR_GAMES: PopularGame[] = [
  {
    id: 'cyber-strike-777',
    title: 'Cyber Strike 777',
    icon: '⚡',
    rtp: 96.5,
    volatility: 'High',
  },
  {
    id: 'neon-samurai',
    title: 'Neon Samurai',
    icon: '⚔️',
    rtp: 96.1,
    volatility: 'Medium',
  },
  {
    id: 'dark-matter-reels',
    title: 'Dark Matter Reels',
    icon: '🌌',
    rtp: 97.0,
    volatility: 'High',
  },
  {
    id: 'quantum-vault',
    title: 'Quantum Vault',
    icon: '💎',
    rtp: 94.8,
    volatility: 'Low',
  },
  {
    id: 'electric-storm',
    title: 'Electric Storm',
    icon: '🌩️',
    rtp: 95.7,
    volatility: 'High',
  },
];
