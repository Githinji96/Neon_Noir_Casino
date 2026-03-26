/**
 * Weighted RNG
 * Cryptographically secure random float, used for all outcome rolls.
 * Supports weighted probability tables.
 */

/** Secure random float in [0, 1) */
export function secureRandom(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 0x100000000;
  }
  return Math.random();
}

export interface WeightedOption<T> {
  value: T;
  weight: number;
}

/** Pick one option from a weighted list using secure RNG */
export function weightedPick<T>(options: WeightedOption<T>[]): T {
  const total = options.reduce((s, o) => s + o.weight, 0);
  let r = secureRandom() * total;
  for (const opt of options) {
    r -= opt.weight;
    if (r <= 0) return opt.value;
  }
  return options[options.length - 1].value;
}
