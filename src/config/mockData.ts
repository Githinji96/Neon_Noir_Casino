export interface GameListing {
  id: string;
  title: string;
  thumbnail: string;
  badge: 'HOT' | 'NEW';
  rtp: number;
  volatility: 'Low' | 'Medium' | 'High';
  isJackpotGame?: boolean;
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

// IDs of games linked to progressive jackpots — only accessible from jackpot section
export const JACKPOT_GAME_IDS = new Set([
  'mega-moolah-noir',   // Mega Jackpot — fixed KES 100 bet
  'electric-storm',
  'quantum-vault',
  'dark-matter-reels',
  'neon-samurai',
]);

// IDs of popular choice games shown in the Popular Choices section
export const POPULAR_GAME_IDS = new Set([
  'cyber-strike-777',   // now a normal slot
  'neon-samurai',
  'dark-matter-reels',
  'quantum-vault',
  'electric-storm',
]);

export const GAME_LISTINGS: GameListing[] = [
  { id: 'mega-moolah-noir',   title: 'Mega Moolah Noir',   thumbnail: 'https://picsum.photos/id/1062/400/225', badge: 'HOT', rtp: 96.5, volatility: 'High', isJackpotGame: true },
  { id: 'cyber-strike-777',   title: 'Cyber Strike 777',   thumbnail: 'https://picsum.photos/id/1038/400/225', badge: 'HOT', rtp: 96.5, volatility: 'High'   },
  { id: 'neon-jungle-fruits', title: 'Neon Jungle Fruits', thumbnail: 'https://picsum.photos/id/1043/400/225', badge: 'NEW', rtp: 95.2, volatility: 'Medium' },
  { id: 'dark-matter-reels',  title: 'Dark Matter Reels',  thumbnail: 'https://picsum.photos/id/1022/400/225', badge: 'HOT', rtp: 97.0, volatility: 'High',   isJackpotGame: true },
  { id: 'quantum-vault',      title: 'Quantum Vault',      thumbnail: 'https://picsum.photos/id/1036/400/225', badge: 'NEW', rtp: 94.8, volatility: 'Low',    isJackpotGame: true },
  { id: 'neon-samurai',       title: 'Neon Samurai',       thumbnail: 'https://picsum.photos/id/1011/400/225', badge: 'HOT', rtp: 96.1, volatility: 'Medium', isJackpotGame: true },
  { id: 'electric-storm',     title: 'Electric Storm',     thumbnail: 'https://picsum.photos/id/1015/400/225', badge: 'NEW', rtp: 95.7, volatility: 'High',   isJackpotGame: true },
  // Pure slot games — shown in New Arrivals only, no jackpot attached
  // Using specific picsum photo IDs (not seeds) — guaranteed landscape images
  { id: 'neon-jungle-fruits', title: 'Neon Jungle Fruits', thumbnail: 'https://picsum.photos/id/1043/400/225', badge: 'NEW', rtp: 95.2, volatility: 'Medium' },
  { id: 'crystal-grid',       title: 'Crystal Grid',       thumbnail: 'https://picsum.photos/id/1018/400/225', badge: 'NEW', rtp: 95.0, volatility: 'Low'    },
  { id: 'solar-flare',        title: 'Solar Flare',        thumbnail: 'https://picsum.photos/id/1053/400/225', badge: 'HOT', rtp: 96.0, volatility: 'Medium' },
  { id: 'midnight-heist',     title: 'Midnight Heist',     thumbnail: 'https://picsum.photos/id/1040/400/225', badge: 'NEW', rtp: 94.5, volatility: 'High'   },
  { id: 'ocean-depths',       title: 'Ocean Depths',       thumbnail: 'https://picsum.photos/id/1025/400/225', badge: 'HOT', rtp: 95.8, volatility: 'Medium' },
  { id: 'dragon-forge',       title: 'Dragon Forge',       thumbnail: 'https://picsum.photos/id/1060/400/225', badge: 'NEW', rtp: 96.2, volatility: 'High'   },
];

// Pure slots shown in New Arrivals — no jackpot, not already featured in Popular Choices
export const NEW_ARRIVAL_GAMES: GameListing[] = (() => {
  const seen = new Set<string>();
  return GAME_LISTINGS.filter((g) => {
    if (g.isJackpotGame) return false;
    if (JACKPOT_GAME_IDS.has(g.id)) return false;
    if (POPULAR_GAME_IDS.has(g.id)) return false;  // already shown in Popular Choices
    if (seen.has(g.id)) return false;
    seen.add(g.id);
    return true;
  });
})();

export const JACKPOT_DATA: JackpotData[] = [
  { id: 'mega-moolah-noir', name: 'Mega Moolah Noir', baseAmount: 3429102.55, tags: ['Daily', 'Progressive'] },
  { id: 'electric-pulse',   name: 'Electric Pulse',   baseAmount: 1250000.0,  tags: ['Hourly', 'Progressive'] },
  { id: 'crystal-vault',    name: 'Crystal Vault',    baseAmount: 875500.75,  tags: ['Daily'] },
  { id: 'shadow-fortune',   name: 'Shadow Fortune',   baseAmount: 512000.0,   tags: ['Weekly', 'Progressive'] },
  { id: 'neon-nexus',       name: 'Neon Nexus',       baseAmount: 250000.5,   tags: ['Hourly'] },
];

export const POPULAR_GAMES: PopularGame[] = [
  { id: 'cyber-strike-777',   title: 'Cyber Strike 777',   icon: '⚡',  rtp: 96.5, volatility: 'High'   },
  { id: 'neon-samurai',       title: 'Neon Samurai',       icon: '⚔️', rtp: 96.1, volatility: 'Medium' },
  { id: 'dark-matter-reels',  title: 'Dark Matter Reels',  icon: '🌌', rtp: 97.0, volatility: 'High'   },
  { id: 'quantum-vault',      title: 'Quantum Vault',      icon: '💎', rtp: 94.8, volatility: 'Low'    },
  { id: 'electric-storm',     title: 'Electric Storm',     icon: '🌩️', rtp: 95.7, volatility: 'High'  },
];
