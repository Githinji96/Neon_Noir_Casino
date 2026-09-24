/**
 * Jackpot Engine — Central Configuration
 *
 * JACKPOT_CONFIGS is the *fallback* configuration used on cold start
 * before the first DB sync completes. The authoritative source of truth
 * for name, base_amount, contribution_rate, trigger_probability, and
 * current_amount is the `jackpots` DB table, synced via jackpotStore.
 *
 * Fields that are NOT in the DB (gameplay constants) live here permanently:
 *   maxAmount, partialResetPct, minimumThreshold, maxContributionPerSpin,
 *   minProbability, maxProbability, cooldownMs, resetIntervalMs,
 *   tags, gameId, gameTitle
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
  seedAmount: number;
  maxAmount: number;
  partialResetPct: number;
  minimumThreshold: number;

  // Contribution
  contributionRate: number;
  maxContributionPerSpin: number;

  // Trigger probability
  baseProbability: number;
  minProbability: number;
  maxProbability: number;

  // Cooldown after win (ms)
  cooldownMs: number;

  // Reset interval (ms)
  resetIntervalMs: number;
}

export const RTP_TARGET = 0.965;
export const JACKPOT_RTP_SHARE = 0.03;
export const MAX_CONTRIBUTION_MULTIPLIER = 5;

// ── Gameplay constants keyed by jackpot ID ────────────────────────────────────
// These never appear in the admin UI — they are tuned by developers only.
// Any jackpot ID NOT in this map gets safe defaults.
const GAMEPLAY_DEFAULTS: Record<string, Partial<JackpotConfig>> = {
  'mega-moolah-noir': {
    type: 'mega',   gameId: 'mega-moolah-noir', gameTitle: 'Mega Moolah Noir',
    tags: ['Daily', 'Progressive'],
    maxAmount: 50_000_000, partialResetPct: 0.10, minimumThreshold: 5_000_000,
    maxContributionPerSpin: 500, minProbability: 0.00005, maxProbability: 0.0005,
    cooldownMs: 60 * 60_000, resetIntervalMs: Infinity,
  },
  'electric-pulse': {
    type: 'hourly', gameId: 'electric-storm',     gameTitle: 'Electric Storm',
    tags: ['Hourly', 'Progressive'],
    maxAmount: 2_000_000, partialResetPct: 0, minimumThreshold: 500_000,
    maxContributionPerSpin: 100, minProbability: 0.0001, maxProbability: 0.0008,
    cooldownMs: 30 * 60_000, resetIntervalMs: 60 * 60_000,
  },
  'crystal-vault': {
    type: 'daily',  gameId: 'quantum-vault',       gameTitle: 'Quantum Vault',
    tags: ['Daily'],
    maxAmount: 10_000_000, partialResetPct: 0, minimumThreshold: 2_000_000,
    maxContributionPerSpin: 200, minProbability: 0.00005, maxProbability: 0.0005,
    cooldownMs: 60 * 60_000, resetIntervalMs: 24 * 60 * 60_000,
  },
  'shadow-fortune': {
    type: 'weekly', gameId: 'dark-matter-reels',   gameTitle: 'Dark Matter Reels',
    tags: ['Weekly', 'Progressive'],
    maxAmount: 5_000_000, partialResetPct: 0, minimumThreshold: 1_000_000,
    maxContributionPerSpin: 150, minProbability: 0.00002, maxProbability: 0.0002,
    cooldownMs: 2 * 60 * 60_000, resetIntervalMs: 7 * 24 * 60 * 60_000,
  },
  'neon-nexus': {
    type: 'hourly', gameId: 'neon-samurai',        gameTitle: 'Neon Samurai',
    tags: ['Hourly'],
    maxAmount: 1_000_000, partialResetPct: 0, minimumThreshold: 200_000,
    maxContributionPerSpin: 50, minProbability: 0.0001, maxProbability: 0.001,
    cooldownMs: 20 * 60_000, resetIntervalMs: 60 * 60_000,
  },
};

/** Safe defaults for any jackpot whose ID is not in GAMEPLAY_DEFAULTS */
const SAFE_GAMEPLAY_DEFAULTS: Omit<JackpotConfig, 'id' | 'name' | 'baseAmount' | 'seedAmount' | 'contributionRate' | 'baseProbability'> = {
  type: 'daily',
  gameId: '',
  gameTitle: '',
  tags: ['Daily'],
  maxAmount: 10_000_000,
  partialResetPct: 0,
  minimumThreshold: 0,   // immediately ACTIVE — safest default
  maxContributionPerSpin: 200,
  minProbability: 0.00005,
  maxProbability: 0.001,
  cooldownMs: 60 * 60_000,
  resetIntervalMs: 24 * 60 * 60_000,
};

/**
 * Build a full JackpotConfig from a DB row + gameplay defaults.
 * Used both for the initial hardcoded list and for dynamic DB rows.
 */
export function buildConfigFromDB(row: {
  id: string;
  name: string;
  type?: string;
  base_amount: number;
  contribution_rate: number;
  trigger_probability: number;
}): JackpotConfig {
  const defaults = GAMEPLAY_DEFAULTS[row.id] ?? {};
  return {
    ...SAFE_GAMEPLAY_DEFAULTS,
    ...defaults,
    id:               row.id,
    name:             row.name,
    type:             (row.type as JackpotType) ?? defaults.type ?? SAFE_GAMEPLAY_DEFAULTS.type,
    baseAmount:       row.base_amount,
    seedAmount:       row.base_amount,
    contributionRate: row.contribution_rate,
    baseProbability:  row.trigger_probability,
  };
}

// ── Runtime config array — starts with hardcoded fallbacks, then overwritten by DB ──
export const JACKPOT_CONFIGS: JackpotConfig[] = [
  buildConfigFromDB({ id: 'mega-moolah-noir', name: 'Mega Moolah Noir', type: 'mega',   base_amount: 3_000_000, contribution_rate: 0.02,  trigger_probability: 0.0001  }),
  buildConfigFromDB({ id: 'electric-pulse',   name: 'Electric Pulse',   type: 'hourly', base_amount:   100_000, contribution_rate: 0.01,  trigger_probability: 0.0002  }),
  buildConfigFromDB({ id: 'crystal-vault',    name: 'Crystal Vault',    type: 'daily',  base_amount:   500_000, contribution_rate: 0.015, trigger_probability: 0.0001  }),
  buildConfigFromDB({ id: 'shadow-fortune',   name: 'Shadow Fortune',   type: 'weekly', base_amount:   200_000, contribution_rate: 0.005, trigger_probability: 0.00005 }),
  buildConfigFromDB({ id: 'neon-nexus',       name: 'Neon Nexus',       type: 'hourly', base_amount:    50_000, contribution_rate: 0.005, trigger_probability: 0.0003  }),
];
