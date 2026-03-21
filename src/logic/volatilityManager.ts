/**
 * Volatility Manager — adjusts symbol weights based on volatility setting
 * and the current win bias from the RTP controller.
 */

import { SYMBOLS, type SymbolId } from '../config/symbols';
import { GAME_CONFIG, VOLATILITY_WEIGHT_MODIFIERS } from '../config/gameConfig';

export interface WeightedSymbol {
  id: SymbolId;
  weight: number;
}

/**
 * Returns adjusted symbol weights for the current volatility + bias.
 * bias > 1 → boost premium symbols (more wins)
 * bias < 1 → suppress premium symbols (more dead spins)
 */
export function getAdjustedWeights(winBias: number): WeightedSymbol[] {
  const modifiers = VOLATILITY_WEIGHT_MODIFIERS[GAME_CONFIG.volatility];

  return SYMBOLS.map((sym) => {
    const volMod = modifiers[sym.id] ?? 1.0;
    let weight = sym.weight * volMod;

    // Premium symbols (high multiplier) are boosted/suppressed by bias
    if (sym.multiplier >= 4 || sym.id === 'wild' || sym.id === 'scatter') {
      weight *= winBias;
    } else if (sym.multiplier >= 2) {
      // Medium symbols get a softer nudge
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
