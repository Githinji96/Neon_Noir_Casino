/**
 * Spin Engine — generates a 5×3 grid using volatility-adjusted weights.
 * Supports per-game symbol sets and near-win injection for dead spins.
 */

import { type SymbolId, type Symbol, getSymbolsForGame } from '../config/symbols';
import { GAME_CONFIG, DEAD_SPIN_RATES } from '../config/gameConfig';
import { getAdjustedWeights, weightedPick } from './volatilityManager';
import { getWinBias } from './rtpController';

export type SpinGrid = SymbolId[][]; // [col][row], 5 cols × 3 rows

let activeSymbols: Symbol[] = getSymbolsForGame('cyber-strike-777');

export function setActiveGame(gameId: string): void {
  activeSymbols = getSymbolsForGame(gameId);
}

export function getActiveSymbols(): Symbol[] {
  return activeSymbols;
}

function pickSymbol(winBias: number): SymbolId {
  const weights = getAdjustedWeights(winBias, activeSymbols);
  return weightedPick(weights);
}

function generateNearWin(): SpinGrid {
  const winBias = 1.0;
  const weights = getAdjustedWeights(winBias, activeSymbols);
  const commonSymbols = activeSymbols.filter(
    (s) => s.multiplier <= 2 && s.id !== 'scatter' && s.id !== 'wild'
  );
  const target = commonSymbols[Math.floor(Math.random() * commonSymbols.length)].id;

  const grid: SpinGrid = [];
  for (let col = 0; col < 5; col++) {
    const column: SymbolId[] = [];
    for (let row = 0; row < 3; row++) {
      if (row === 1) {
        if (col < 2) {
          column.push(target);
        } else if (col === 2) {
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

export function generateSpin(): SpinGrid {
  const winBias = getWinBias();
  const deadSpinRate = DEAD_SPIN_RATES[GAME_CONFIG.volatility];
  const forceDead = Math.random() < deadSpinRate / winBias;

  if (forceDead) {
    if (Math.random() < GAME_CONFIG.nearWinProbability) {
      return generateNearWin();
    }
    const grid: SpinGrid = [];
    const deadWeights = getAdjustedWeights(0.1, activeSymbols);
    for (let col = 0; col < 5; col++) {
      const column: SymbolId[] = [];
      for (let row = 0; row < 3; row++) {
        column.push(weightedPick(deadWeights));
      }
      grid.push(column);
    }
    return grid;
  }

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

export function checkJackpot(winBias: number): boolean {
  return Math.random() < GAME_CONFIG.jackpotProbability * winBias;
}
