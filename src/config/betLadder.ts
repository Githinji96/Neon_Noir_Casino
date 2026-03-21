export const BET_LADDER: readonly number[] = [0.20, 0.50, 1.00, 2.00, 5.00, 10.00, 20.00, 50.00, 100.00];

export const MIN_BET = BET_LADDER[0];
export const MAX_BET = BET_LADDER[BET_LADDER.length - 1];
export const DEFAULT_BET = 1.00;
