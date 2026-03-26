/**
 * Payout Calculator — derives multipliers from the active symbol set.
 * Wild matches get a bonus multiplier.
 * Free spins apply a configurable multiplier.
 */

import { type WinResult } from './paylines';
import { GAME_CONFIG } from '../config/gameConfig';
import { getActiveSymbols } from './rng';

// Payout multipliers by symbol multiplier tier: [3match, 4match, 5match]
const TIER_PAYOUTS: Record<number, [number, number, number]> = {
  0: [0,   0,    0   ], // scatter/wild — handled separately
  1: [0.5, 1,    2   ],
  2: [1,   3,    8   ],
  3: [2,   6,    15  ],
  4: [4,   12,   30  ],
  5: [8,   25,   80  ],
};

// Special overrides for wild-only lines
const WILD_PAYOUT: [number, number, number] = [20, 100, 500];

function getPayoutTable(): Record<string, [number, number, number]> {
  const table: Record<string, [number, number, number]> = {};
  for (const sym of getActiveSymbols()) {
    if (sym.id === 'wild') {
      table[sym.id] = WILD_PAYOUT;
    } else {
      table[sym.id] = TIER_PAYOUTS[sym.multiplier] ?? [0.5, 1, 2];
    }
  }
  return table;
}

export function calculatePayout(
  winResults: WinResult[],
  bet: number,
  isFreeSpins = false,
): number {
  let total = 0;
  const freeSpinsMult = isFreeSpins ? GAME_CONFIG.freeSpinsMultiplier : 1;
  const table = getPayoutTable();

  for (const win of winResults) {
    const entry = table[win.matchedSymbol];
    if (!entry) continue;

    const idx = Math.min(win.matchCount - 3, 2);
    let multiplier = entry[idx];
    if (win.isWild) multiplier *= 2;

    const payout = bet * multiplier * freeSpinsMult;
    win.payout = Math.round(payout * 100) / 100;
    total += win.payout;
  }

  return Math.round(total * 100) / 100;
}

export function calculateScatterPayout(scatterCount: number, bet: number): number {
  if (scatterCount < 3) return 0;
  const multipliers: Record<number, number> = { 3: 5, 4: 20, 5: 100 };
  return Math.round(bet * (multipliers[scatterCount] ?? 100) * 100) / 100;
}
