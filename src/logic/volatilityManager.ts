/**
 * Volatility Manager — adjusts symbol weights based on volatility setting
 * and the current win bias from the RTP controller.
 */

import { type Symbol, type SymbolId, SYMBOLS } from '../config/symbols';
import { GAME_CONFIG, VOLATILITY_WEIGHT_MODIFIERS } from '../config/gameConfig';

export interface WeightedSymbol {
  id: SymbolId;
  weight: number;
}

export function getAdjustedWeights(winBias: number, symbols: Symbol[] = SYMBOLS): WeightedSymbol[] {
  const modifiers = VOLATILITY_WEIGHT_MODIFIERS[GAME_CONFIG.volatility];

  return symbols.map((sym) => {
    // Use id-based modifier if available, else fall back to multiplier-based heuristic
    const volMod = modifiers[sym.id] ?? (sym.multiplier <= 1 ? 1.0 : sym.multiplier <= 2 ? 1.0 : sym.multiplier <= 3 ? 1.0 : 1.0);
    let weight = sym.weight * volMod;

    if (sym.multiplier >= 4 || sym.id === 'wild' || sym.id === 'scatter') {
      weight *= winBias;
    } else if (sym.multiplier >= 2) {
      weight *= 0.5 + winBias * 0.5;
    }

    return { id: sym.id, weight: Math.max(0.1, weight) };
  });
}

export function weightedPick(weights: WeightedSymbol[]): SymbolId {
  const total = weights.reduce((s, w) => s + w.weight, 0);
  let rand = Math.random() * total;
  for (const w of weights) {
    rand -= w.weight;
    if (rand <= 0) return w.id;
  }
  return weights[weights.length - 1].id;
}
