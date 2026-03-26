/**
 * Jackpot Engine — Main Orchestrator
 *
 * Wires together:
 *   contributionManager → triggerEngine → payoutManager → resetScheduler → rtpBalancer
 *
 * Usage (called once per spin from gameStore):
 *   const result = jackpotEngine.processSpin({ betAmount, consecutiveLosses, sessionRTP, totalSessionBet, userId });
 */

import { JACKPOT_CONFIGS, type JackpotConfig } from './jackpotConfig';
import { calculateContributions } from './contributionManager';
import { computeTriggerProbability, rollTrigger } from './triggerEngine';
import { attemptPayout, isLocked } from './payoutManager';
import { checkScheduledReset } from './resetScheduler';
import { recordJackpotSpin, getJackpotRTP } from './rtpBalancer';

// ─── Runtime State ────────────────────────────────────────────────────────────

export interface JackpotRuntimeState {
  id: string;
  currentAmount: number;
  lastWinTimestamp: number;
  lastResetTimestamp: number;
}

// Initialise runtime state from configs
const _runtimeState = new Map<string, JackpotRuntimeState>(
  JACKPOT_CONFIGS.map((cfg) => [
    cfg.id,
    {
      id: cfg.id,
      currentAmount: cfg.seedAmount,
      lastWinTimestamp: 0,
      lastResetTimestamp: Date.now(),
    },
  ])
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpinInput {
  betAmount: number;
  consecutiveLosses: number;
  sessionRTP: number;       // fraction e.g. 0.94
  totalSessionBet: number;
  userId: string | null;
}

export interface JackpotWinEvent {
  jackpotId: string;
  jackpotName: string;
  gameId: string;
  gameTitle: string;
  amount: number;
  resetTo: number;
  timestamp: number;
  userId: string | null;
}

export interface SpinResult {
  contributions: Record<string, number>; // jackpotId → amount added
  win: JackpotWinEvent | null;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export const jackpotEngine = {

  /** Process a single spin — contributions + trigger check */
  processSpin(input: SpinInput): SpinResult {
    const { betAmount, consecutiveLosses, sessionRTP, totalSessionBet, userId } = input;

    // 1. Apply scheduled resets (time-based)
    this._applyScheduledResets();

    // 2. Calculate and apply contributions
    const contributionResults = calculateContributions(betAmount, JACKPOT_CONFIGS);
    const contributions: Record<string, number> = {};

    for (const { jackpotId, contribution } of contributionResults) {
      const state = _runtimeState.get(jackpotId);
      if (!state) continue;
      const cfg = this._getConfig(jackpotId);
      if (!cfg) continue;

      const newAmount = Math.min(
        Math.round((state.currentAmount + contribution) * 100) / 100,
        cfg.maxAmount
      );
      state.currentAmount = newAmount;
      contributions[jackpotId] = contribution;
    }

    // 3. Record bet for RTP tracking
    recordJackpotSpin(betAmount);

    // 4. Trigger check — evaluate each jackpot, stop at first win
    let win: JackpotWinEvent | null = null;

    for (const cfg of JACKPOT_CONFIGS) {
      if (isLocked(cfg.id)) continue;

      const state = _runtimeState.get(cfg.id)!;

      const probability = computeTriggerProbability(cfg, {
        currentAmount: state.currentAmount,
        lastWinTimestamp: state.lastWinTimestamp,
        consecutiveLosses,
        sessionRTP: getJackpotRTP(),
        totalSessionBet,
      });

      if (!rollTrigger(probability)) continue;

      // Attempt payout (mutex guard)
      const payout = attemptPayout(cfg, state.currentAmount);
      if (!payout) continue; // locked — skip

      // Apply win
      state.currentAmount = payout.resetTo;
      state.lastWinTimestamp = Date.now();
      state.lastResetTimestamp = Date.now();

      // Record jackpot payout for RTP
      recordJackpotSpin(0, payout.amount);

      win = {
        jackpotId: cfg.id,
        jackpotName: cfg.name,
        gameId: cfg.gameId,
        gameTitle: cfg.gameTitle,
        amount: payout.amount,
        resetTo: payout.resetTo,
        timestamp: Date.now(),
        userId,
      };

      if (import.meta.env.DEV) {
        console.log('[JackpotEngine] WIN', win);
      }

      break; // only one jackpot win per spin
    }

    return { contributions, win };
  },

  /** Apply time-based resets to all jackpots */
  _applyScheduledResets(): void {
    for (const cfg of JACKPOT_CONFIGS) {
      const state = _runtimeState.get(cfg.id);
      if (!state) continue;
      const { shouldReset, resetTo } = checkScheduledReset(cfg, state.lastResetTimestamp);
      if (shouldReset) {
        state.currentAmount = resetTo;
        state.lastResetTimestamp = Date.now();
        if (import.meta.env.DEV) {
          console.log(`[JackpotEngine] Scheduled reset: ${cfg.id} → ${resetTo}`);
        }
      }
    }
  },

  /** Get current amount for a jackpot */
  getAmount(jackpotId: string): number {
    return _runtimeState.get(jackpotId)?.currentAmount ?? 0;
  },

  /** Get all runtime states (for store sync) */
  getAllStates(): JackpotRuntimeState[] {
    return Array.from(_runtimeState.values());
  },

  /** Seed amounts from external source (e.g. Supabase sync) */
  seedAmounts(amounts: Record<string, number>): void {
    for (const [id, amount] of Object.entries(amounts)) {
      const state = _runtimeState.get(id);
      if (state) state.currentAmount = amount;
    }
  },

  /** Simulate real-time ambient growth (UI animation tick) */
  applyGrowthTick(): void {
    for (const cfg of JACKPOT_CONFIGS) {
      const state = _runtimeState.get(cfg.id);
      if (!state || isLocked(cfg.id)) continue;
      // Ambient growth: 0.01–2.00 per tick (120ms interval)
      const growth = Math.random() * 1.99 + 0.01;
      state.currentAmount = Math.min(
        Math.round((state.currentAmount + growth) * 100) / 100,
        cfg.maxAmount
      );
    }
  },

  _getConfig(id: string): JackpotConfig | undefined {
    return JACKPOT_CONFIGS.find((c) => c.id === id);
  },
};
