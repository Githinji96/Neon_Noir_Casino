/**
 * Jackpot Engine — Central Configuration
 * All tunable values live here. No magic numbers in logic files.
 */

export type JackpotType = 'mega' | 'daily' | 'hourly' | 'weekly';

export interface JackpotConfig {
  id: string;
  name: string;
  type: JackpotType;
  gameId: string;
  gameTitle: string;
  tags: string[];

  // Amounts
  baseAmount: number;
  seedAmount: number;       // starting value after reset
  maxAmount: number;        // hard cap — prevents runaway growth
  partialResetPct: number;  // mega only: retains this % of prev value on reset (0 = full reset)

  // Contribution
  contributionRate: number; // fraction of bet added per spin
  maxContributionPerSpin: number; // cap to prevent abuse on huge bets

  // Trigger probability
  baseProbability: number;
  minProbability: number;   // floor — never goes below this
  maxProbability: number;   // ceiling — never goes above this

  // Cooldown after win (ms) — no trigger during this window
  cooldownMs: number;

  // Reset interval (ms) — Infinity = never auto-reset
  resetIntervalMs: number;
}

export const RTP_TARGET = 0.965;          // 96.5% overall RTP target
export const JACKPOT_RTP_SHARE = 0.03;   // 3% of total RTP budget allocated to jackpots
export const MAX_CONTRIBUTION_MULTIPLIER = 5; // cap contribution at 5× base bet

export const JACKPOT_CONFIGS: JackpotConfig[] = [
  {
    id: 'mega-moolah-noir',
    name: 'Mega Moolah Noir',
    type: 'mega',
    gameId: 'cyber-strike-777',
    gameTitle: 'Cyber Strike 777',
    tags: ['Daily', 'Progressive'],
    baseAmount: 3_000_000,
    seedAmount: 3_000_000,
    maxAmount: 50_000_000,
    partialResetPct: 0.10, // retains 10% of won amount after reset
    contributionRate: 0.02,
    maxContributionPerSpin: 500,
    baseProbability: 0.0001,
    minProbability: 0.00005,
    maxProbability: 0.0005,
    cooldownMs: 60 * 60 * 1000, // 1 hour cooldown after win
    resetIntervalMs: Infinity,
  },
  {
    id: 'electric-pulse',
    name: 'Electric Pulse',
    type: 'hourly',
    gameId: 'electric-storm',
    gameTitle: 'Electric Storm',
    tags: ['Hourly', 'Progressive'],
    baseAmount: 100_000,
    seedAmount: 100_000,
    maxAmount: 2_000_000,
    partialResetPct: 0,
    contributionRate: 0.01,
    maxContributionPerSpin: 100,
    baseProbability: 0.005,
    minProbability: 0.002,
    maxProbability: 0.02,
    cooldownMs: 5 * 60 * 1000,
    resetIntervalMs: 60 * 60 * 1000,
  },
  {
    id: 'crystal-vault',
    name: 'Crystal Vault',
    type: 'daily',
    gameId: 'quantum-vault',
    gameTitle: 'Quantum Vault',
    tags: ['Daily'],
    baseAmount: 500_000,
    seedAmount: 500_000,
    maxAmount: 10_000_000,
    partialResetPct: 0,
    contributionRate: 0.015,
    maxContributionPerSpin: 200,
    baseProbability: 0.001,
    minProbability: 0.0005,
    maxProbability: 0.005,
    cooldownMs: 15 * 60 * 1000,
    resetIntervalMs: 24 * 60 * 60 * 1000,
  },
  {
    id: 'shadow-fortune',
    name: 'Shadow Fortune',
    type: 'weekly',
    gameId: 'dark-matter-reels',
    gameTitle: 'Dark Matter Reels',
    tags: ['Weekly', 'Progressive'],
    baseAmount: 200_000,
    seedAmount: 200_000,
    maxAmount: 5_000_000,
    partialResetPct: 0,
    contributionRate: 0.005,
    maxContributionPerSpin: 150,
    baseProbability: 0.0005,
    minProbability: 0.0002,
    maxProbability: 0.003,
    cooldownMs: 30 * 60 * 1000,
    resetIntervalMs: 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'neon-nexus',
    name: 'Neon Nexus',
    type: 'hourly',
    gameId: 'neon-samurai',
    gameTitle: 'Neon Samurai',
    tags: ['Hourly'],
    baseAmount: 50_000,
    seedAmount: 50_000,
    maxAmount: 1_000_000,
    partialResetPct: 0,
    contributionRate: 0.005,
    maxContributionPerSpin: 50,
    baseProbability: 0.008,
    minProbability: 0.003,
    maxProbability: 0.03,
    cooldownMs: 3 * 60 * 1000,
    resetIntervalMs: 60 * 60 * 1000,
  },
];
