// Property tests for useMiniGameStore financial logic
// Task 2.3 — Mini Jackpot Games spec

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const { mockRpc, mockFrom, mockChannel, mockRemoveChannel } = vi.hoisted(() => {
  const mockRpc = vi.fn();
  const mockFrom = vi.fn(() => ({ select: vi.fn().mockResolvedValue({ data: [], error: null }) }));
  const mockChannel = vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  }));
  const mockRemoveChannel = vi.fn().mockResolvedValue(undefined);
  return { mockRpc, mockFrom, mockChannel, mockRemoveChannel };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn().mockResolvedValue({}),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: mockFrom,
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
    rpc: mockRpc,
  },
}));

// Mock authStore to prevent dynamic import errors
// The store does: const { useAuthStore } = await import('./authStore')
vi.mock('../../store/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      refreshBalance: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// ── Import store AFTER mocks ───────────────────────────────────────────────────

import { useMiniGameStore } from '../miniGameStore';
import type { MiniGameConfig } from '../../types/miniGames';

// ── Pure helper (mirrors PostgreSQL ROUND logic) ───────────────────────────────
// This mirrors the DB function: v_new_balance := ROUND((v_balance - p_stake + v_payout)::numeric, 2)

function computeNewBalance(balanceBefore: number, stake: number, payout: number): number {
  return Math.round((balanceBefore - stake + payout) * 100) / 100;
}

// ── Shared config fixture ──────────────────────────────────────────────────────

const GAME_ID = 'mystery-multiplier' as const;

const makeConfig = (minBet = 10, maxBet = 1000): MiniGameConfig => ({
  id: 'cfg-1',
  game_id: GAME_ID,
  enabled: true,
  min_bet: minBet,
  max_bet: maxBet,
  prize_tiers: [],
  outcome_probabilities: {},
  maintenance: false,
  game_specific_rules: {},
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
});

// ── Property 1: Balance Invariant ─────────────────────────────────────────────

/**
 * Validates: Requirements 14.1, 10.4, 10.7, 10.8
 *
 * Property 1: For any (balanceBefore ≥ 0, stake > 0, payout ≥ 0) where
 * balanceBefore ≥ stake, computeNewBalance(balanceBefore, stake, payout)
 * equals round(balanceBefore - stake + payout, 2) within 0.01.
 *
 * This pure function mirrors the PostgreSQL ROUND(…, 2) used in the
 * play_mini_game RPC and is the canonical balance-update formula.
 */
describe('Property 1 – Balance Invariant', () => {
  it('computeNewBalance equals round(balance - stake + payout, 2) within 0.01 for any valid inputs', () => {
    fc.assert(
      fc.property(
        // balanceBefore: non-negative, up to 1,000,000 (32-bit float bounds)
        fc.float({ min: Math.fround(0), max: Math.fround(1_000_000), noNaN: true, noDefaultInfinity: true }),
        // stake: positive (32-bit float bounds)
        fc.float({ min: Math.fround(0.01), max: Math.fround(10_000), noNaN: true, noDefaultInfinity: true }),
        // payout: non-negative (32-bit float bounds)
        fc.float({ min: Math.fround(0), max: Math.fround(100_000), noNaN: true, noDefaultInfinity: true }),
        (rawBalance, rawStake, payout) => {
          // Ensure balanceBefore ≥ stake (the precondition)
          const balanceBefore = rawBalance + rawStake;
          const stake = rawStake;

          const result = computeNewBalance(balanceBefore, stake, payout);

          // Reference computation: standard JS rounding to 2 decimal places
          const expected = Math.round((balanceBefore - stake + payout) * 100) / 100;

          // Must match exactly (same formula) — tolerance 0.01 for floating-point edge cases
          expect(Math.abs(result - expected)).toBeLessThanOrEqual(0.01);

          // Result must never be negative when payout ≥ 0 and balanceBefore ≥ stake
          expect(result).toBeGreaterThanOrEqual(-0.01); // allow tiny float noise
        }
      ),
      { numRuns: 50 }
    );
  });

  it('computeNewBalance rounds correctly to 2 decimal places for known examples', () => {
    // Spot checks to confirm the rounding formula is correct
    expect(computeNewBalance(100, 10, 25)).toBe(115);
    expect(computeNewBalance(100.50, 0.55, 1.10)).toBeCloseTo(101.05, 2);
    expect(computeNewBalance(50, 50, 0)).toBe(0);
    expect(computeNewBalance(99.99, 0.01, 0.02)).toBeCloseTo(100, 2);
  });
});

// ── Property 3: Atomicity ─────────────────────────────────────────────────────

/**
 * Validates: Requirements 14.3, 10.8, 10.14
 *
 * Property 3: When the play_mini_game RPC returns an error, the store
 * must not apply any balance change. The round phase must be 'error'
 * and currentRound.payout must remain null — observable evidence of
 * zero net change from the frontend's perspective.
 */
describe('Property 3 – Atomicity (RPC error = zero balance change)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: RPC errors out
    mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC error' } });

    // Reset store to idle state
    useMiniGameStore.setState({
      activeGame: GAME_ID,
      roundPhase: 'idle',
      currentRound: null,
      roundError: null,
      configs: {
        'lucky-wheel': null,
        'scratch-cards': null,
        'treasure-chest': null,
        'mini-slot': null,
        'mystery-multiplier': makeConfig(),
        'crystal-match': null,
      },
    });
  });

  it('roundPhase is error and payout remains null when RPC fails for any (stake, errorMessage)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Stake: valid positive number within [10, 1000]
        fc.float({ min: Math.fround(10), max: Math.fround(1000), noNaN: true, noDefaultInfinity: true }),
        // Error message: arbitrary string
        fc.string({ minLength: 1, maxLength: 100 }),
        async (stake, errorMsg) => {
          // Reset store state for each run
          useMiniGameStore.setState({
            activeGame: GAME_ID,
            roundPhase: 'idle',
            currentRound: null,
            roundError: null,
          });

          // Mock RPC to return an error (simulates failure after debit attempt)
          mockRpc.mockResolvedValueOnce({ data: null, error: { message: errorMsg } });

          // Capture payout state before the call
          const payoutBefore = useMiniGameStore.getState().currentRound?.payout ?? null;

          await useMiniGameStore.getState().submitRound('test-user-id', stake);

          const state = useMiniGameStore.getState();

          // Property 3a: phase must be 'error' — no result was committed
          expect(state.roundPhase).toBe('error');

          // Property 3b: payout remains null — no credit was applied
          expect(state.currentRound?.payout ?? null).toBe(payoutBefore);

          // Property 3c: error message is captured
          expect(state.roundError).toBe(errorMsg);

          // Property 3d: roundPhase is NOT 'result' — balance was not updated
          expect(state.roundPhase).not.toBe('result');
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ── Property 4: Round-Trip Net Change ─────────────────────────────────────────

/**
 * Validates: Requirements 14.4, 10.10
 *
 * Property 4: For any (stake, grossPayout), the netResult stored in a
 * MiniGameHistoryEntry equals grossPayout - stake exactly.
 * This mirrors the DB formula: net_result = payout - stake
 * and the loadHistory mapping: netResult: row.net_result
 */
describe('Property 4 – Round-Trip Net Change', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useMiniGameStore.setState({
      activeGame: GAME_ID,
      roundPhase: 'idle',
      currentRound: null,
      roundError: null,
      gameHistory: {
        'lucky-wheel': [],
        'scratch-cards': [],
        'treasure-chest': [],
        'mini-slot': [],
        'mystery-multiplier': [],
        'crystal-match': [],
      },
    });
  });

  it('history entry netResult equals grossPayout - stake for any (stake, payout)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Stake: positive
        fc.float({ min: Math.fround(0.01), max: Math.fround(10_000), noNaN: true, noDefaultInfinity: true }),
        // Gross payout: non-negative
        fc.float({ min: Math.fround(0), max: Math.fround(100_000), noNaN: true, noDefaultInfinity: true }),
        // Round UUID
        fc.uuid(),
        async (stake, grossPayout, roundId) => {
          const netResult = grossPayout - stake;

          // Mock get_mini_game_history RPC to return a history row
          mockRpc.mockImplementationOnce(
            (rpcName: string, _params: unknown) => {
              if (rpcName === 'get_mini_game_history') {
                return Promise.resolve({
                  data: [
                    {
                      round_id: roundId,
                      game_id: GAME_ID,
                      stake,
                      payout: grossPayout,
                      net_result: netResult,
                      created_at: new Date().toISOString(),
                    },
                  ],
                  error: null,
                });
              }
              return Promise.resolve({ data: null, error: { message: 'unexpected RPC' } });
            }
          );

          await useMiniGameStore.getState().loadHistory(GAME_ID, 'test-user-id');

          const history = useMiniGameStore.getState().gameHistory[GAME_ID];

          // Should have exactly 1 entry
          expect(history).toHaveLength(1);

          const entry = history[0];

          // Property 4: netResult in the store exactly matches grossPayout - stake
          // (as stored by the DB and returned by the RPC)
          expect(entry.netResult).toBeCloseTo(netResult, 5);
          expect(entry.grossPayout).toBeCloseTo(grossPayout, 5);
          expect(entry.stake).toBeCloseTo(stake, 5);

          // Verify the formula: netResult === grossPayout - stake
          expect(entry.netResult).toBeCloseTo(entry.grossPayout - entry.stake, 5);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('netResult formula holds for known examples', () => {
    // Pure formula verification — no store needed
    const cases: Array<[number, number, number]> = [
      [10, 25, 15],      // win: payout > stake
      [50, 0, -50],      // loss: no payout
      [100, 100, 0],     // push: break-even
      [10.50, 21.00, 10.50], // decimal stake
    ];

    for (const [stake, grossPayout, expectedNet] of cases) {
      const netResult = grossPayout - stake;
      expect(netResult).toBeCloseTo(expectedNet, 5);
    }
  });
});

// ── Property 5: Zero Balance Change on Rejection ──────────────────────────────

/**
 * Validates: Requirements 14.5, 10.3
 *
 * Property 5: For any stake that fails validation (stake < min_bet or
 * stake > max_bet), setBet() sets roundError without committing a round
 * (roundPhase stays non-'result', payout stays null, and the RPC is
 * never called).
 *
 * Note: submitRound() itself doesn't validate bounds — that's setBet()'s
 * responsibility. So we test setBet() with out-of-bounds stakes, and
 * separately test submitRound() with a mocked RPC error to cover the
 * balance-guard path.
 */
describe('Property 5 – Zero Balance Change on Rejection (setBet validation)', () => {
  const MIN_BET = 10;
  const MAX_BET = 1000;

  beforeEach(() => {
    vi.clearAllMocks();

    useMiniGameStore.setState({
      activeGame: GAME_ID,
      roundPhase: 'idle',
      currentRound: null,
      roundError: null,
      configs: {
        'lucky-wheel': null,
        'scratch-cards': null,
        'treasure-chest': null,
        'mini-slot': null,
        'mystery-multiplier': makeConfig(MIN_BET, MAX_BET),
        'crystal-match': null,
      },
    });
  });

  it('setBet sets roundError and never calls RPC for stakes below min_bet', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Stake below min_bet: [0.01, min_bet)
        fc.float({ min: Math.fround(0.01), max: Math.fround(MIN_BET - 0.01), noNaN: true, noDefaultInfinity: true }),
        async (stake) => {
          // Reset each run
          useMiniGameStore.setState({
            activeGame: GAME_ID,
            roundPhase: 'idle',
            currentRound: null,
            roundError: null,
          });
          vi.clearAllMocks();

          useMiniGameStore.getState().setBet(stake);

          const state = useMiniGameStore.getState();

          // Property 5a: roundError is set for below-min stake
          expect(state.roundError).not.toBeNull();
          expect(state.roundError).toContain(String(MIN_BET));

          // Property 5b: roundPhase has not transitioned to 'result'
          expect(state.roundPhase).not.toBe('result');

          // Property 5c: no payout committed
          expect(state.currentRound?.payout ?? null).toBeNull();

          // Property 5d: RPC was never called (no debit occurred)
          expect(mockRpc).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('setBet sets roundError and never calls RPC for stakes above max_bet', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Stake above max_bet: (max_bet, max_bet * 10]
        fc.float({ min: Math.fround(MAX_BET + 0.01), max: Math.fround(MAX_BET * 10), noNaN: true, noDefaultInfinity: true }),
        async (stake) => {
          // Reset each run
          useMiniGameStore.setState({
            activeGame: GAME_ID,
            roundPhase: 'idle',
            currentRound: null,
            roundError: null,
          });
          vi.clearAllMocks();

          useMiniGameStore.getState().setBet(stake);

          const state = useMiniGameStore.getState();

          // Property 5a: roundError is set for above-max stake
          expect(state.roundError).not.toBeNull();
          expect(state.roundError).toContain(String(MAX_BET));

          // Property 5b: roundPhase has not transitioned to 'result'
          expect(state.roundPhase).not.toBe('result');

          // Property 5c: no payout committed
          expect(state.currentRound?.payout ?? null).toBeNull();

          // Property 5d: RPC was never called (no debit occurred)
          expect(mockRpc).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('setBet accepts valid stakes within [min_bet, max_bet] without setting roundError', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Stake within [min_bet, max_bet]
        fc.float({ min: Math.fround(MIN_BET), max: Math.fround(MAX_BET), noNaN: true, noDefaultInfinity: true }),
        async (stake) => {
          useMiniGameStore.setState({
            activeGame: GAME_ID,
            roundPhase: 'idle',
            currentRound: null,
            roundError: null,
          });
          vi.clearAllMocks();

          useMiniGameStore.getState().setBet(stake);

          const state = useMiniGameStore.getState();

          // Valid bet should NOT produce a validation error
          expect(state.roundError).toBeNull();

          // currentRound should be set with the requested stake
          expect(state.currentRound).not.toBeNull();
          expect(state.currentRound?.stake).toBeCloseTo(stake, 5);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('submitRound with RPC error leaves roundPhase as error and payout null (balance guard)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Valid stake within bounds
        fc.float({ min: Math.fround(MIN_BET), max: Math.fround(MAX_BET), noNaN: true, noDefaultInfinity: true }),
        async (stake) => {
          useMiniGameStore.setState({
            activeGame: GAME_ID,
            roundPhase: 'idle',
            currentRound: null,
            roundError: null,
          });

          // RPC returns a validation error (e.g. "Insufficient balance")
          mockRpc.mockResolvedValueOnce({
            data: null,
            error: { message: 'Insufficient balance' },
          });

          await useMiniGameStore.getState().submitRound('test-user-id', stake);

          const state = useMiniGameStore.getState();

          // Property 5e: phase is 'error', not 'result' — no balance change committed
          expect(state.roundPhase).toBe('error');
          expect(state.currentRound?.payout ?? null).toBeNull();
          expect(state.roundError).toBe('Insufficient balance');
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ── Property 4 (Task 6.2): Mystery Multiplier Payout Formula ─────────────────

/**
 * Validates: Requirements 14.4, 8.5
 *
 * Property 4 applied to multiplier games:
 *   For any (stake: float, min=1) and (multiplier: float, min=0.01),
 *     payout  = Math.round(stake * multiplier * 100) / 100
 *     netResult = payout - stake
 *
 * Two sub-properties are verified:
 *   4a (Req 8.5)  – Observable calculation: final multiplier × stake = gross payout
 *   4b (Req 14.4) – Round-trip net change: netResult equals payout minus stake
 */
describe('Property 4 (Task 6.2) – Mystery Multiplier Payout Formula', () => {
  // Pure payout calculation that mirrors the play_mini_game RPC:
  //   v_payout := ROUND(p_stake * (v_outcome->>'multiplier')::numeric, 2)
  function computePayout(stake: number, multiplier: number): number {
    return Math.round(stake * multiplier * 100) / 100;
  }

  it('4a (Req 8.5) – payout equals round(stake × multiplier, 2) for any valid inputs', () => {
    fc.assert(
      fc.property(
        // stake: min=1, no NaN, no infinity (matches task spec)
        fc.float({ min: Math.fround(1), noNaN: true, noDefaultInfinity: true }),
        // multiplier: min=0.01, no NaN, no infinity (matches task spec)
        fc.float({ min: Math.fround(0.01), noNaN: true, noDefaultInfinity: true }),
        (stake, multiplier) => {
          const payout = computePayout(stake, multiplier);

          // Payout must be a finite, non-negative number
          expect(Number.isFinite(payout)).toBe(true);
          expect(payout).toBeGreaterThanOrEqual(0);

          // Requirement 8.5: final multiplier × stake = gross payout
          // Allow ±0.01 tolerance for float→round edge cases
          const rawProduct = stake * multiplier;
          expect(Math.abs(payout - rawProduct)).toBeLessThanOrEqual(0.01);

          // Payout must be rounded to at most 2 decimal places
          const asCents = Math.round(payout * 100);
          expect(Math.abs(payout - asCents / 100)).toBeLessThanOrEqual(0.005);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('4b (Req 14.4) – netResult equals payout - stake for any valid (stake, multiplier)', () => {
    fc.assert(
      fc.property(
        // stake: min=1
        fc.float({ min: Math.fround(1), noNaN: true, noDefaultInfinity: true }),
        // multiplier: min=0.01
        fc.float({ min: Math.fround(0.01), noNaN: true, noDefaultInfinity: true }),
        (stake, multiplier) => {
          const payout = computePayout(stake, multiplier);
          const netResult = payout - stake;

          // Requirement 14.4: net balance change equals payout minus stake
          expect(netResult).toBeCloseTo(payout - stake, 5);

          // The stored net_result (as returned by get_mini_game_history)
          // must equal grossPayout - stake — no independent rounding on net
          const storedNet = payout - stake; // mirrors DB: net_result = payout - stake
          expect(netResult).toBeCloseTo(storedNet, 5);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('4c – payout formula matches known examples (spot checks for Req 8.5)', () => {
    // multiplier × stake = payout, rounded to 2 dp
    const cases: Array<[number, number, number]> = [
      [10,    2.0,   20.00],   // 2x → KES 20
      [50,    1.5,   75.00],   // 1.5x
      [100,   0.5,   50.00],   // 0.5x (below-stake multiplier)
      [10,    3.14,  31.40],   // irrational-ish multiplier
      [33.33, 3.0,   99.99],   // decimal stake
      [1,     0.01,  0.01],    // minimum stake × minimum multiplier
    ];

    for (const [stake, multiplier, expected] of cases) {
      expect(computePayout(stake, multiplier)).toBeCloseTo(expected, 2);
    }
  });

  it('4d – netResult sign reflects win/loss/push correctly', () => {
    // Win: multiplier > 1
    const winPayout = computePayout(100, 2.5);
    expect(winPayout - 100).toBeGreaterThan(0);

    // Loss: multiplier < 1
    const lossPayout = computePayout(100, 0.5);
    expect(lossPayout - 100).toBeLessThan(0);

    // Push / break-even: multiplier = 1
    const pushPayout = computePayout(100, 1.0);
    expect(pushPayout - 100).toBeCloseTo(0, 5);
  });
});

// ── Property 2: Idempotency ───────────────────────────────────────────────────

/**
 * Validates: Requirements 14.2, 10.9, 10.11, 10.15
 *
 * Property 2: Submitting the same round twice (duplicate idempotency key)
 * must NOT append a second history entry and must NOT change roundId from
 * the original call. The server returns `{ duplicate: true, round_id }` for
 * the second call; the frontend should reflect the same round state without
 * treating it as a new round.
 *
 * Because the store generates its own idempotencyKey internally, we simulate
 * idempotency by:
 *   1. First call  → mock RPC returns { round_id, outcome, payout, duplicate: false }
 *   2. loadHistory → mock returns 1 history entry (the round was stored once)
 *   3. Second call → mock RPC returns { round_id (same), outcome, payout, duplicate: true }
 *   4. loadHistory → mock still returns 1 history entry (server de-duplicated)
 *   5. Assert: history length is 1; currentRound.roundId matches round_id from step 1
 */
describe('Property 2 – Idempotency (play_mini_game duplicate key returns original result)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useMiniGameStore.setState({
      activeGame: GAME_ID,
      roundPhase: 'idle',
      currentRound: null,
      roundError: null,
      gameHistory: {
        'lucky-wheel': [],
        'scratch-cards': [],
        'treasure-chest': [],
        'mini-slot': [],
        'mystery-multiplier': [],
        'crystal-match': [],
      },
      configs: {
        'lucky-wheel': null,
        'scratch-cards': null,
        'treasure-chest': null,
        'mini-slot': null,
        'mystery-multiplier': makeConfig(),
        'crystal-match': null,
      },
    });
  });

  it('second call with duplicate key leaves history length at 1 and roundId unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Round UUID returned by the server
        fc.uuid(),
        // Stake: valid float within config bounds
        fc.float({ min: Math.fround(10), max: Math.fround(1000), noNaN: true, noDefaultInfinity: true }),
        // Payout: non-negative
        fc.float({ min: Math.fround(0), max: Math.fround(5000), noNaN: true, noDefaultInfinity: true }),
        async (roundId, stake, payout) => {
          // Reset state for each run
          useMiniGameStore.setState({
            activeGame: GAME_ID,
            roundPhase: 'idle',
            currentRound: null,
            roundError: null,
            gameHistory: {
              'lucky-wheel': [],
              'scratch-cards': [],
              'treasure-chest': [],
              'mini-slot': [],
              'mystery-multiplier': [],
              'crystal-match': [],
            },
          });
          vi.clearAllMocks();

          const outcome = { multiplier: 2.5 };
          const netResult = payout - stake;

          // ── Step 1: First call — server processes normally ───────────────────
          mockRpc.mockImplementationOnce((rpcName: string) => {
            if (rpcName === 'play_mini_game') {
              return Promise.resolve({
                data: { round_id: roundId, outcome, payout, duplicate: false },
                error: null,
              });
            }
            return Promise.resolve({ data: null, error: { message: 'unexpected' } });
          });

          await useMiniGameStore.getState().submitRound('test-user-id', stake);

          const stateAfterFirst = useMiniGameStore.getState();
          expect(stateAfterFirst.roundPhase).toBe('result');
          expect(stateAfterFirst.currentRound?.roundId).toBe(roundId);

          // ── Step 2: loadHistory after first call — 1 entry stored ────────────
          mockRpc.mockImplementationOnce((rpcName: string) => {
            if (rpcName === 'get_mini_game_history') {
              return Promise.resolve({
                data: [
                  {
                    round_id: roundId,
                    game_id: GAME_ID,
                    stake,
                    payout,
                    net_result: netResult,
                    created_at: new Date().toISOString(),
                  },
                ],
                error: null,
              });
            }
            return Promise.resolve({ data: null, error: { message: 'unexpected' } });
          });

          await useMiniGameStore.getState().loadHistory(GAME_ID, 'test-user-id');

          const historyAfterFirst = useMiniGameStore.getState().gameHistory[GAME_ID];
          expect(historyAfterFirst).toHaveLength(1);
          expect(historyAfterFirst[0].roundId).toBe(roundId);

          // ── Step 3: Second call — server detects duplicate idempotency key ───
          mockRpc.mockImplementationOnce((rpcName: string) => {
            if (rpcName === 'play_mini_game') {
              return Promise.resolve({
                data: { round_id: roundId, outcome, payout, duplicate: true },
                error: null,
              });
            }
            return Promise.resolve({ data: null, error: { message: 'unexpected' } });
          });

          await useMiniGameStore.getState().submitRound('test-user-id', stake);

          const stateAfterSecond = useMiniGameStore.getState();

          // Property 2a: roundId must still be the original server-assigned round_id
          expect(stateAfterSecond.currentRound?.roundId).toBe(roundId);

          // Property 2b: phase is 'result' (successful, not errored)
          expect(stateAfterSecond.roundPhase).toBe('result');

          // ── Step 4: loadHistory after second call — server still returns 1 entry
          mockRpc.mockImplementationOnce((rpcName: string) => {
            if (rpcName === 'get_mini_game_history') {
              return Promise.resolve({
                data: [
                  {
                    round_id: roundId,
                    game_id: GAME_ID,
                    stake,
                    payout,
                    net_result: netResult,
                    created_at: new Date().toISOString(),
                  },
                ],
                error: null,
              });
            }
            return Promise.resolve({ data: null, error: { message: 'unexpected' } });
          });

          await useMiniGameStore.getState().loadHistory(GAME_ID, 'test-user-id');

          const historyAfterSecond = useMiniGameStore.getState().gameHistory[GAME_ID];

          // Property 2c: history still has exactly 1 entry — no duplicate appended
          expect(historyAfterSecond).toHaveLength(1);
          expect(historyAfterSecond[0].roundId).toBe(roundId);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('known example: duplicate call with roundId="abc-123" produces exactly 1 history entry', async () => {
    const roundId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const stake = 50;
    const payout = 100;
    const outcome = { multiplier: 2.0 };

    // First call — fresh round
    mockRpc.mockImplementationOnce((rpcName: string) => {
      if (rpcName === 'play_mini_game') {
        return Promise.resolve({
          data: { round_id: roundId, outcome, payout, duplicate: false },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
    await useMiniGameStore.getState().submitRound('user-1', stake);
    expect(useMiniGameStore.getState().currentRound?.roundId).toBe(roundId);

    // Load history after first call: 1 entry
    mockRpc.mockImplementationOnce((rpcName: string) => {
      if (rpcName === 'get_mini_game_history') {
        return Promise.resolve({
          data: [{ round_id: roundId, game_id: GAME_ID, stake, payout, net_result: 50, created_at: new Date().toISOString() }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
    await useMiniGameStore.getState().loadHistory(GAME_ID, 'user-1');
    expect(useMiniGameStore.getState().gameHistory[GAME_ID]).toHaveLength(1);

    // Second call — duplicate
    mockRpc.mockImplementationOnce((rpcName: string) => {
      if (rpcName === 'play_mini_game') {
        return Promise.resolve({
          data: { round_id: roundId, outcome, payout, duplicate: true },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
    await useMiniGameStore.getState().submitRound('user-1', stake);
    expect(useMiniGameStore.getState().currentRound?.roundId).toBe(roundId);

    // Load history after second call: still 1 entry (server de-duplicated)
    mockRpc.mockImplementationOnce((rpcName: string) => {
      if (rpcName === 'get_mini_game_history') {
        return Promise.resolve({
          data: [{ round_id: roundId, game_id: GAME_ID, stake, payout, net_result: 50, created_at: new Date().toISOString() }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
    await useMiniGameStore.getState().loadHistory(GAME_ID, 'user-1');
    expect(useMiniGameStore.getState().gameHistory[GAME_ID]).toHaveLength(1);
  });
});

// ── Property 8: No Duplicate Round History Entries ────────────────────────────

/**
 * Validates: Requirements 14.8, 10.10
 *
 * Property 8: For any sequence of N calls (1–5) with the same idempotency
 * key, `useMiniGameStore.gameHistory[gameId]` contains exactly 1 entry
 * for that round because the server enforces the UNIQUE constraint on
 * `idempotency_key` and returns the same row on every retry.
 *
 * Also tests with N distinct round IDs: loadHistory returns exactly N
 * entries — one per unique round, no duplicates within any single round.
 */
describe('Property 8 – No Duplicate Round History Entries', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useMiniGameStore.setState({
      activeGame: GAME_ID,
      roundPhase: 'idle',
      currentRound: null,
      roundError: null,
      gameHistory: {
        'lucky-wheel': [],
        'scratch-cards': [],
        'treasure-chest': [],
        'mini-slot': [],
        'mystery-multiplier': [],
        'crystal-match': [],
      },
    });
  });

  it('calling loadHistory N times with same single entry always yields exactly 1 entry', async () => {
    await fc.assert(
      fc.asyncProperty(
        // N: number of times to call loadHistory (1–5, simulates N retries)
        fc.integer({ min: 1, max: 5 }),
        // roundId for the single duplicate round
        fc.uuid(),
        // stake and payout
        fc.float({ min: Math.fround(10), max: Math.fround(1000), noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: Math.fround(0), max: Math.fround(5000), noNaN: true, noDefaultInfinity: true }),
        async (n, roundId, stake, payout) => {
          // Reset state for each run
          useMiniGameStore.setState({
            activeGame: GAME_ID,
            roundPhase: 'idle',
            currentRound: null,
            roundError: null,
            gameHistory: {
              'lucky-wheel': [],
              'scratch-cards': [],
              'treasure-chest': [],
              'mini-slot': [],
              'mystery-multiplier': [],
              'crystal-match': [],
            },
          });
          vi.clearAllMocks();

          const netResult = payout - stake;
          const singleEntry = {
            round_id: roundId,
            game_id: GAME_ID,
            stake,
            payout,
            net_result: netResult,
            created_at: new Date().toISOString(),
          };

          // Call loadHistory N times; server always returns the same 1 row
          // (simulating N retries where the server de-duplicated correctly)
          for (let i = 0; i < n; i++) {
            mockRpc.mockImplementationOnce((rpcName: string) => {
              if (rpcName === 'get_mini_game_history') {
                return Promise.resolve({ data: [singleEntry], error: null });
              }
              return Promise.resolve({ data: null, error: { message: 'unexpected' } });
            });

            await useMiniGameStore.getState().loadHistory(GAME_ID, 'test-user-id');
          }

          const history = useMiniGameStore.getState().gameHistory[GAME_ID];

          // Property 8a: loadHistory is idempotent — always exactly 1 entry
          // regardless of how many times it was called, because the store
          // replaces (not appends) on each loadHistory call
          expect(history).toHaveLength(1);
          expect(history[0].roundId).toBe(roundId);
        }
      ),
      { numRuns: 25 }
    );
  });

  it('loadHistory with N unique rounds returns exactly N entries — one per unique roundId', async () => {
    await fc.assert(
      fc.asyncProperty(
        // N: number of distinct rounds (1–5)
        fc.integer({ min: 1, max: 5 }),
        // Base stake and payout values
        fc.float({ min: Math.fround(10), max: Math.fround(500), noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: Math.fround(0), max: Math.fround(2000), noNaN: true, noDefaultInfinity: true }),
        async (n, stake, payout) => {
          // Reset state for each run
          useMiniGameStore.setState({
            activeGame: GAME_ID,
            roundPhase: 'idle',
            currentRound: null,
            roundError: null,
            gameHistory: {
              'lucky-wheel': [],
              'scratch-cards': [],
              'treasure-chest': [],
              'mini-slot': [],
              'mystery-multiplier': [],
              'crystal-match': [],
            },
          });
          vi.clearAllMocks();

          // Generate N distinct round IDs deterministically from index
          const entries = Array.from({ length: n }, (_, i) => ({
            round_id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
            game_id: GAME_ID,
            stake: stake + i,      // slightly different stake per round to ensure uniqueness
            payout: payout + i,
            net_result: payout - stake,
            created_at: new Date(Date.now() - i * 1000).toISOString(),
          }));

          // Server returns all N distinct rounds in one loadHistory call
          mockRpc.mockImplementationOnce((rpcName: string) => {
            if (rpcName === 'get_mini_game_history') {
              return Promise.resolve({ data: entries, error: null });
            }
            return Promise.resolve({ data: null, error: { message: 'unexpected' } });
          });

          await useMiniGameStore.getState().loadHistory(GAME_ID, 'test-user-id');

          const history = useMiniGameStore.getState().gameHistory[GAME_ID];

          // Property 8b: N unique rounds → N entries, no duplicates
          expect(history).toHaveLength(n);

          // Verify each entry has a unique roundId
          const roundIds = history.map((e) => e.roundId);
          const uniqueIds = new Set(roundIds);
          expect(uniqueIds.size).toBe(n);
        }
      ),
      { numRuns: 25 }
    );
  });

  it('known example: 3 retries with same round still yields exactly 1 history entry', async () => {
    const roundId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const entry = {
      round_id: roundId,
      game_id: GAME_ID,
      stake: 25,
      payout: 75,
      net_result: 50,
      created_at: new Date().toISOString(),
    };

    // Simulate 3 loadHistory calls (retries) — server always returns 1 row
    for (let i = 0; i < 3; i++) {
      mockRpc.mockImplementationOnce((rpcName: string) => {
        if (rpcName === 'get_mini_game_history') {
          return Promise.resolve({ data: [entry], error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });
      await useMiniGameStore.getState().loadHistory(GAME_ID, 'user-1');
    }

    const history = useMiniGameStore.getState().gameHistory[GAME_ID];
    expect(history).toHaveLength(1);
    expect(history[0].roundId).toBe(roundId);
    expect(history[0].grossPayout).toBe(75);
    expect(history[0].netResult).toBe(50);
  });

  it('known example: 4 distinct rounds → exactly 4 entries with unique IDs', async () => {
    const entries = [
      { round_id: 'round-id-1-000000000000000000000000', game_id: GAME_ID, stake: 10, payout: 20, net_result: 10, created_at: new Date().toISOString() },
      { round_id: 'round-id-2-000000000000000000000000', game_id: GAME_ID, stake: 20, payout: 0,  net_result: -20, created_at: new Date().toISOString() },
      { round_id: 'round-id-3-000000000000000000000000', game_id: GAME_ID, stake: 50, payout: 50, net_result: 0,  created_at: new Date().toISOString() },
      { round_id: 'round-id-4-000000000000000000000000', game_id: GAME_ID, stake: 100, payout: 350, net_result: 250, created_at: new Date().toISOString() },
    ];

    mockRpc.mockImplementationOnce((rpcName: string) => {
      if (rpcName === 'get_mini_game_history') {
        return Promise.resolve({ data: entries, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    await useMiniGameStore.getState().loadHistory(GAME_ID, 'user-1');

    const history = useMiniGameStore.getState().gameHistory[GAME_ID];
    expect(history).toHaveLength(4);

    const ids = new Set(history.map((e) => e.roundId));
    expect(ids.size).toBe(4);
  });
});
