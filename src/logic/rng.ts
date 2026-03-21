/**
 * Spin Engine — generates a 5×3 grid using volatility-adjusted weights.
 * Supports near-win injection for dead spins.
 */

import { type SymbolId, SYMBOLS } from '../config/symbols';
import { GAME_CONFIG, DEAD_SPIN_RATES } from '../config/gameConfig';
import { getAdjustedWeights, weightedPick } from './volatilityManager';
import { getWinBias } from './rtpController';

export type SpinGrid = SymbolId[][]; // [col][row], 5 cols × 3 rows

/** Generate a single symbol using current bias */
function pickSymbol(winBias: number): SymbolId {
  const weights = getAdjustedWeights(winBias);
  return weightedPick(weights);
}

/** Generate a near-win grid: 2 matching symbols on a payline, 3rd is different */
function generateNearWin(): SpinGrid {
  const grid: SpinGrid = [];
  const winBias = 1.0; // neutral for near-win
  const weights = getAdjustedWeights(winBias);

  // Pick a common symbol for the near-win
  const commonSymbols = SYMBOLS.filter((s) => s.multiplier <= 2 && s.id !== 'scatter' && s.id !== 'wild');
  const target = commonSymbols[Math.floor(Math.random() * commonSymbols.length)].id;

  for (let col = 0; col < 5; col++) {
    const column: SymbolId[] = [];
    for (let row = 0; row < 3; row++) {
      // Middle row (row 1) = main payline
      if (row === 1) {
        if (col < 2) {
          // First 2 cols match
          column.push(target);
        } else if (col === 2) {
          // 3rd col is almost — pick something different
          let sym: SymbolId;
          do { sym = weightedPick(weights); } while (sym === target);
          column.push(sym);
        } else {
          column.push(weightedPick(weights));
        }
      } else {
        column.push(weightedPick(weights));
      }
    }
    grid.push(column);
  }
  return grid;
}

/** Main spin generator */
export function generateSpin(): SpinGrid {
  const winBias = getWinBias();
  const deadSpinRate = DEAD_SPIN_RATES[GAME_CONFIG.volatility];

  // Decide if this should be a forced dead spin
  const forceDead = Math.random() < deadSpinRate / winBias;

  if (forceDead) {
    // Near-win injection for engagement
    if (Math.random() < GAME_CONFIG.nearWinProbability) {
      return generateNearWin();
    }
    // Pure dead spin — suppress premium symbols heavily
    const grid: SpinGrid = [];
    const deadWeights = getAdjustedWeights(0.1); // very low bias
    for (let col = 0; col < 5; col++) {
      const column: SymbolId[] = [];
      for (let row = 0; row < 3; row++) {
        column.push(weightedPick(deadWeights));
      }
      grid.push(column);
    }
    return grid;
  }

  // Normal spin with bias-adjusted weights
  const grid: SpinGrid = [];
  for (let col = 0; col < 5; col++) {
    const column: SymbolId[] = [];
    for (let row = 0; row < 3; row++) {
      column.push(pickSymbol(winBias));
    }
    grid.push(column);
  }
  return grid;
}

/** Jackpot check — 0.1% base probability, boosted by bias */
export function checkJackpot(winBias: number): boolean {
  return Math.random() < GAME_CONFIG.jackpotProbability * winBias;
}
