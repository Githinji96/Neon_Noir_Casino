/**
 * Payout Calculator — uses PAYOUT_TABLE for realistic casino-grade payouts.
 * Wild matches get a bonus multiplier.
 * Free spins apply a configurable multiplier.
 */

import { type WinResult } from './paylines';
import { PAYOUT_TABLE, GAME_CONFIG } from '../config/gameConfig';

export function calculatePayout(
  winResults: WinResult[],
  bet: number,
  isFreeSpins = false,
): number {
  let total = 0;
  const freeSpinsMult = isFreeSpins ? GAME_CONFIG.freeSpinsMultiplier : 1;

  for (const win of winResults) {
    const table = PAYOUT_TABLE[win.matchedSymbol];
    if (!table) continue;

    // Index: 3match=0, 4match=1, 5match=2
    const idx = Math.min(win.matchCount - 3, 2);
    let multiplier = table[idx];

    // Wild-only line gets extra 2× bonus
    if (win.isWild) multiplier *= 2;

    const payout = bet * multiplier * freeSpinsMult;
    win.payout = Math.round(payout * 100) / 100;
    total += win.payout;
  }

  return Math.round(total * 100) / 100;
}

/** Scatter payout: 3=5×bet, 4=20×bet, 5=100×bet */
export function calculateScatterPayout(scatterCount: number, bet: number): number {
  if (scatterCount < 3) return 0;
  const multipliers: Record<number, number> = { 3: 5, 4: 20, 5: 100 };
  return Math.round(bet * (multipliers[scatterCount] ?? 100) * 100) / 100;
}
