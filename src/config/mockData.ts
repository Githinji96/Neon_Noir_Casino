export interface GameListing {
  id: string;
  title: string;
  thumbnail: string;
  thumbnails: string[];   // slideshow pool — card cycles through these
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
  {
    id: 'mega-moolah-noir', title: 'Mega Moolah Noir', badge: 'HOT', rtp: 96.5, volatility: 'High', isJackpotGame: true,
    thumbnail: 'https://images.unsplash.com/photo-1518893883800-45cd0954574b?w=400&h=225&fit=crop&auto=format',
    thumbnails: [
      'https://images.unsplash.com/photo-1518893883800-45cd0954574b?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1519751138087-5bf79df62d5b?w=400&h=225&fit=crop&auto=format',
    ],
  },
  {
    id: 'cyber-strike-777', title: 'Cyber Strike 777', badge: 'HOT', rtp: 96.5, volatility: 'High',
    thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=225&fit=crop&auto=format',
    thumbnails: [
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400&h=225&fit=crop&auto=format',
    ],
  },
  {
    id: 'neon-jungle-fruits', title: 'Neon Jungle Fruits', badge: 'NEW', rtp: 95.2, volatility: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=225&fit=crop&auto=format',
    thumbnails: [
      'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=400&h=225&fit=crop&auto=format',
    ],
  },
  {
    id: 'dark-matter-reels', title: 'Dark Matter Reels', badge: 'HOT', rtp: 97.0, volatility: 'High', isJackpotGame: true,
    thumbnail: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=400&h=225&fit=crop&auto=format',
    thumbnails: [
      'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=225&fit=crop&auto=format',
    ],
  },
  {
    id: 'quantum-vault', title: 'Quantum Vault', badge: 'NEW', rtp: 94.8, volatility: 'Low', isJackpotGame: true,
    thumbnail: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=225&fit=crop&auto=format',
    thumbnails: [
      'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1518544801976-3e159e50e5bb?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1518893883800-45cd0954574b?w=400&h=225&fit=crop&auto=format',
    ],
  },
  {
    id: 'neon-samurai', title: 'Neon Samurai', badge: 'HOT', rtp: 96.1, volatility: 'Medium', isJackpotGame: true,
    thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=225&fit=crop&auto=format',
    thumbnails: [
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=400&h=225&fit=crop&auto=format',
    ],
  },
  {
    id: 'electric-storm', title: 'Electric Storm', badge: 'NEW', rtp: 95.7, volatility: 'High', isJackpotGame: true,
    thumbnail: 'https://images.unsplash.com/photo-1519751138087-5bf79df62d5b?w=400&h=225&fit=crop&auto=format',
    thumbnails: [
      'https://images.unsplash.com/photo-1519751138087-5bf79df62d5b?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1614732414444-096e5f1122d5?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=225&fit=crop&auto=format',
    ],
  },
  // Pure slot games — New Arrivals only
  {
    id: 'crystal-grid', title: 'Crystal Grid', badge: 'NEW', rtp: 95.0, volatility: 'Low',
    thumbnail: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400&h=225&fit=crop&auto=format',
    thumbnails: [
      'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1518893883800-45cd0954574b?w=400&h=225&fit=crop&auto=format',
    ],
  },
  {
    id: 'solar-flare', title: 'Solar Flare', badge: 'HOT', rtp: 96.0, volatility: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400&h=225&fit=crop&auto=format',
    thumbnails: [
      'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1614732414444-096e5f1122d5?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1543722530-d2c3201371e7?w=400&h=225&fit=crop&auto=format',
    ],
  },
  {
    id: 'midnight-heist', title: 'Midnight Heist', badge: 'NEW', rtp: 94.5, volatility: 'High',
    thumbnail: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=400&h=225&fit=crop&auto=format',
    thumbnails: [
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400&h=225&fit=crop&auto=format',
    ],
  },
  {
    id: 'ocean-depths', title: 'Ocean Depths', badge: 'HOT', rtp: 95.8, volatility: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=400&h=225&fit=crop&auto=format',
    thumbnails: [
      'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=400&h=225&fit=crop&auto=format',
    ],
  },
  {
    id: 'dragon-forge', title: 'Dragon Forge', badge: 'NEW', rtp: 96.2, volatility: 'High',
    thumbnail: 'https://images.unsplash.com/photo-1518544801976-3e159e50e5bb?w=400&h=225&fit=crop&auto=format',
    thumbnails: [
      'https://images.unsplash.com/photo-1518544801976-3e159e50e5bb?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=225&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1519751138087-5bf79df62d5b?w=400&h=225&fit=crop&auto=format',
    ],
  },
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
