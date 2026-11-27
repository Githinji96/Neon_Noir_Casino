/**
 * Shared TypeScript types for Mini Jackpot Games feature.
 * Task 2.1 — Mini Jackpot Games spec
 */

/** Union of all six mini game identifiers */
export type MiniGameId =
  | 'lucky-wheel'
  | 'scratch-cards'
  | 'treasure-chest'
  | 'mini-slot'
  | 'mystery-multiplier'
  | 'crystal-match';

/** A single prize tier in a mini game's prize_tiers config array */
export interface PrizeTier {
  label: string;
  multiplier: number;
  probability: number;
  symbol?: string;
}

/**
 * Outcome payload returned by play_mini_game / claim_mini_game_result.
 * Extends PrizeTier with server-injected fields.
 */
export interface MiniGameOutcome extends PrizeTier {
  /** Zero-based index of the winning tier in prize_tiers — used to animate
   *  segment-based games (Lucky Wheel, etc.) to the correct position. */
  segment_index: number;
}

/** Full row from the mini_game_config table */
export interface MiniGameConfig {
  id: string;
  game_id: MiniGameId;
  enabled: boolean;
  min_bet: number;
  max_bet: number;
  prize_tiers: PrizeTier[];
  outcome_probabilities: Record<string, number>;
  maintenance: boolean;
  game_specific_rules: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** The phase a mini game round is in from the frontend perspective */
export type RoundPhase = 'idle' | 'betting' | 'processing' | 'result' | 'error';

/** Tracks the in-progress or most recent round */
export interface CurrentRound {
  /** UUID — set to idempotencyKey before the RPC call */
  roundId: string;
  gameId: MiniGameId;
  stake: number;
  /** Server-returned outcome payload; null until the RPC resolves */
  outcome: unknown | null;
  /** Server-returned payout; null until the RPC resolves */
  payout: number | null;
  /** crypto.randomUUID() generated before the RPC call for idempotency */
  idempotencyKey: string;
}

/** One completed round as returned by get_mini_game_history */
export interface MiniGameHistoryEntry {
  roundId: string;
  gameId: MiniGameId;
  stake: number;
  grossPayout: number;
  /** grossPayout - stake */
  netResult: number;
  timestamp: string;
}
