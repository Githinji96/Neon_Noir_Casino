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
import { getJackpotState } from './jackpotState';

// ─── Admin Overrides ──────────────────────────────────────────────────────────

export type JackpotTriggerMode = 'auto' | 'locked' | 'scheduled';

export interface JackpotAdminOverride {
  mode: JackpotTriggerMode;
  forceTriggerNext: boolean;      // fire on the very next spin
  scheduledTriggerAt: number;     // unix ms — trigger at or after this time (0 = unset)
  minAmountThreshold: number;     // only trigger when currentAmount >= this (0 = no threshold)
}

const _adminOverrides = new Map<string, JackpotAdminOverride>(
  JACKPOT_CONFIGS.map((cfg) => [
    cfg.id,
    { mode: 'auto', forceTriggerNext: false, scheduledTriggerAt: 0, minAmountThreshold: 0 },
  ])
);

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
  activeGameId?: string;    // only jackpots assigned to this game can trigger
  jackpotMode?: boolean;
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
    const { betAmount, consecutiveLosses, totalSessionBet, userId } = input;

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

      // Contributions always accumulate regardless of locked/threshold state
      const newAmount = Math.min(
        Math.round((state.currentAmount + contribution) * 100) / 100,
        cfg.maxAmount
      );
      state.currentAmount = newAmount;
      contributions[jackpotId] = contribution;
    }

    // 3. Record bet for RTP tracking
    recordJackpotSpin(betAmount);

    // 4. Trigger check — ONLY when launched from jackpot section (jackpotMode: true)
    // Games accessed via Popular Choices, New Arrivals, or direct URL cannot trigger jackpots
    let win: JackpotWinEvent | null = null;

    if (!input.jackpotMode) {
      // Contributions accumulate but no win can trigger
      return { contributions, win: null };
    }

    for (const cfg of JACKPOT_CONFIGS) {
      // Skip jackpots not belonging to the current game
      if (input.activeGameId && cfg.gameId !== input.activeGameId) continue;

      if (isLocked(cfg.id)) continue;

      const state = _runtimeState.get(cfg.id)!;
      const override = _adminOverrides.get(cfg.id)!;

      // ── Admin override: locked mode — HARD BLOCK, nothing can trigger ──────
      if (override.mode === 'locked') continue;

      // ── Config minimum threshold — pool must reach this before ANY trigger ─
      if (state.currentAmount < cfg.minimumThreshold) continue;

      // ── Admin override: min amount threshold — additional admin-set floor ──
      if (override.minAmountThreshold > 0 && state.currentAmount < override.minAmountThreshold) continue;

      // ── Jackpot state check — must be ACTIVE ─────────────────────────────
      const jackpotState = getJackpotState(cfg, state.currentAmount, state.lastWinTimestamp);
      if (jackpotState !== 'ACTIVE') continue;

      // ── Determine if this spin should trigger ────────────────────────────
      let shouldTrigger = false;

      if (override.forceTriggerNext) {
        // Force-next is already past the locked/threshold guards above
        shouldTrigger = true;
        override.forceTriggerNext = false;
      } else if (override.mode === 'scheduled' && override.scheduledTriggerAt > 0) {
        shouldTrigger = Date.now() >= override.scheduledTriggerAt;
        if (shouldTrigger) override.scheduledTriggerAt = 0; // consume
      } else if (override.mode === 'auto') {
        const probability = computeTriggerProbability(cfg, {
          currentAmount: state.currentAmount,
          lastWinTimestamp: state.lastWinTimestamp,
          consecutiveLosses,
          sessionRTP: getJackpotRTP(),
          totalSessionBet,
        });
        shouldTrigger = rollTrigger(probability);
      }

      if (!shouldTrigger) continue;

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

  // ─── Admin Override API ─────────────────────────────────────────────────────

  /** Get current admin override for a jackpot */
  getOverride(jackpotId: string): JackpotAdminOverride | undefined {
    return _adminOverrides.get(jackpotId);
  },

  /** Get all overrides (for admin panel display) */
  getAllOverrides(): Record<string, JackpotAdminOverride> {
    const result: Record<string, JackpotAdminOverride> = {};
    _adminOverrides.forEach((v, k) => { result[k] = { ...v }; });
    return result;
  },

  /** Set trigger mode for a jackpot */
  setMode(jackpotId: string, mode: JackpotTriggerMode): void {
    const o = _adminOverrides.get(jackpotId);
    if (o) o.mode = mode;
  },

  /** Force the jackpot to trigger on the very next spin */
  forceNextWin(jackpotId: string): void {
    const o = _adminOverrides.get(jackpotId);
    if (o) { o.forceTriggerNext = true; o.mode = 'auto'; }
  },

  /** Schedule the jackpot to trigger at a specific time */
  scheduleAt(jackpotId: string, timestampMs: number): void {
    const o = _adminOverrides.get(jackpotId);
    if (o) { o.scheduledTriggerAt = timestampMs; o.mode = 'scheduled'; }
  },

  /** Set a minimum pool amount before the jackpot can trigger */
  setMinThreshold(jackpotId: string, amount: number): void {
    const o = _adminOverrides.get(jackpotId);
    if (o) o.minAmountThreshold = amount;
  },

  /** Cancel any pending scheduled trigger or force-win */
  cancelOverride(jackpotId: string): void {
    const o = _adminOverrides.get(jackpotId);
    if (o) { o.forceTriggerNext = false; o.scheduledTriggerAt = 0; o.mode = 'auto'; }
  },
};
