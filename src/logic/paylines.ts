/**
 * Payline definitions and evaluation engine.
 * 10 paylines: 3 horizontal, 2 diagonal, 2 zig-zag, 3 extra patterns.
 */

import { type SymbolId } from '../config/symbols';
import { type SpinGrid } from './rng';

export type Payline = [number, number, number, number, number]; // row per col

export const PAYLINES: Payline[] = [
  [0, 0, 0, 0, 0], // 0: top row
  [1, 1, 1, 1, 1], // 1: middle row
  [2, 2, 2, 2, 2], // 2: bottom row
  [0, 1, 2, 1, 0], // 3: V-shape
  [2, 1, 0, 1, 2], // 4: inverted V
  [0, 0, 1, 2, 2], // 5: diagonal down
  [2, 2, 1, 0, 0], // 6: diagonal up
  [1, 0, 1, 2, 1], // 7: zig-zag up
  [1, 2, 1, 0, 1], // 8: zig-zag down
  [0, 1, 1, 1, 2], // 9: shallow diagonal
];

export interface WinResult {
  paylineIndex: number;
  matchedSymbol: SymbolId;
  matchCount: number;       // 3, 4, or 5
  cells: [number, number][]; // [col, row] pairs
  payout: number;
  isWild: boolean;
}

export interface EvaluateResult {
  wins: WinResult[];
  scatterCount: number;
  triggerFreeSpins: boolean;
}

export function evaluatePaylines(grid: SpinGrid): EvaluateResult {
  const wins: WinResult[] = [];

  // Count scatter symbols anywhere on grid
  let scatterCount = 0;
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 3; row++) {
      if (grid[col][row] === 'scatter') scatterCount++;
    }
  }

  // Track which cells are already part of a win to avoid double-counting
  const usedCells = new Set<string>();

  for (let paylineIndex = 0; paylineIndex < PAYLINES.length; paylineIndex++) {
    const payline = PAYLINES[paylineIndex];
    const symbols: SymbolId[] = payline.map((row, col) => grid[col][row]);

    // Find first non-wild symbol as target
    let targetSymbol: SymbolId | null = null;
    for (const sym of symbols) {
      if (sym !== 'wild') {
        targetSymbol = sym;
        break;
      }
    }

    // All wilds → treat as 'seven' (highest non-special)
    if (targetSymbol === null) targetSymbol = 'seven';

    // Scatters don't form payline wins
    if (targetSymbol === 'scatter') continue;

    // Count consecutive matches from left
    let matchCount = 0;
    let wildCount = 0;
    const cells: [number, number][] = [];

    for (let col = 0; col < 5; col++) {
      const sym = symbols[col];
      if (sym === 'wild') {
        matchCount++;
        wildCount++;
        cells.push([col, payline[col]]);
      } else if (sym === targetSymbol) {
        matchCount++;
        cells.push([col, payline[col]]);
      } else {
        break;
      }
    }

    if (matchCount >= 3) {
      // Check for duplicate payline wins on same cells
      const cellKey = cells.map(([c, r]) => `${c},${r}`).join('|');
      if (!usedCells.has(cellKey)) {
        usedCells.add(cellKey);
        wins.push({
          paylineIndex,
          matchedSymbol: targetSymbol,
          matchCount,
          cells,
          payout: 0,
          isWild: wildCount === matchCount,
        });
      }
    }
  }

  return {
    wins,
    scatterCount,
    triggerFreeSpins: scatterCount >= 3,
  };
}
