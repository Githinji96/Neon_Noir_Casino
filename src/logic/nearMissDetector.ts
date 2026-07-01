/**
 * Near-Miss Detector
 *
 * Detects GENUINE near-miss jackpot outcomes based on actual reel results.
 * Never fabricates or manipulates outcomes — purely reads what landed.
 *
 * A near-miss is detected when:
 * - 2 out of 3 required jackpot symbol positions are filled on any payline
 * - The missing position has any other symbol
 *
 * Compliant with responsible gaming: no fake near-misses, no RNG manipulation.
 */

import type { SpinGrid } from './rng';
import type { SymbolId } from '../config/symbols';
import { PAYLINES } from './paylines';

export interface NearMissResult {
  isNearMiss: boolean;
  jackpotSymbol: SymbolId | null;
  matchedPositions: number;   // how many jackpot symbols landed (e.g. 2 out of 3 for 5-reel)
  requiredPositions: number;  // how many were needed (e.g. 3)
  message: string;
}

// Premium symbols that qualify as "jackpot symbols" for near-miss detection
// These are the highest-value symbols per game theme
const JACKPOT_SYMBOLS: SymbolId[] = ['seven', 'wild', 'vault', 'shogun', 'storm_eye', 'dark_crystal'];

/**
 * Check if a spin result constitutes a genuine near-miss for jackpot symbols.
 * Reads the actual grid — no manipulation.
 */
export function detectNearMiss(grid: SpinGrid): NearMissResult {
  const noResult: NearMissResult = {
    isNearMiss: false,
    jackpotSymbol: null,
    matchedPositions: 0,
    requiredPositions: 5,
    message: '',
  };

  for (const payline of PAYLINES) {
    const symbols: SymbolId[] = payline.map((row, col) => grid[col][row]);

    for (const jackpotSym of JACKPOT_SYMBOLS) {
      // Count how many positions on this payline have the jackpot symbol (or wild)
      const matches = symbols.filter((s) => s === jackpotSym || s === 'wild').length;

      // Near-miss: 3 or 4 out of 5 jackpot symbols, but not all 5 (that would be a win)
      if (matches === 4) {
        return {
          isNearMiss: true,
          jackpotSymbol: jackpotSym,
          matchedPositions: 4,
          requiredPositions: 5,
          message: buildMessage(jackpotSym, 4, 5),
        };
      }

      if (matches === 3) {
        return {
          isNearMiss: true,
          jackpotSymbol: jackpotSym,
          matchedPositions: 3,
          requiredPositions: 5,
          message: buildMessage(jackpotSym, 3, 5),
        };
      }
    }
  }

  return noResult;
}

function buildMessage(_symbol: SymbolId, matched: number, required: number): string {
  const missing = required - matched;

  const messages = [
    `${matched} jackpot symbols landed — ${missing} away from the big win.`,
    `That was close! ${matched}/${required} jackpot symbols on the reels.`,
    `${matched} out of ${required} needed. Almost triggered the jackpot.`,
  ];

  return messages[Math.floor(Math.random() * messages.length)];
}
