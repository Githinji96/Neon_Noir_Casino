/**
 * Game Resolvers
 * Each resolver takes an effective win probability and bet amount,
 * returns a structured RoundResult.
 * No game logic is forced — all outcomes are RNG-driven with weighted probabilities.
 */

import { secureRandom, weightedPick } from './weightedRNG';
import { GAME_PAYOUTS, VOLATILITY_MODIFIERS, type GameMode, type VolatilityLevel } from './outcomeConfig';

export interface RoundResult {
  outcome: string;
  detail: string;
  payout: number;
  won: boolean;
  isBigWin: boolean;
  rtpContribution: number; // payout / bet ratio for logging
}

// ─── Roulette ─────────────────────────────────────────────────────────────────

export function resolveRoulette(
  bet: number,
  effectiveWinProb: number,
  volatility: VolatilityLevel
): RoundResult {
  const num = Math.floor(secureRandom() * 37); // 0–36
  const color = num === 0 ? 'Green' : num % 2 === 0 ? 'Black' : 'Red';
  const volMod = VOLATILITY_MODIFIERS[volatility];

  // Zero → rare big win
  if (num === 0) {
    const payout = Math.round(bet * GAME_PAYOUTS.roulette.zero);
    return { outcome: `Green 0`, detail: 'Zero — Straight Up!', payout, won: true, isBigWin: true, rtpContribution: payout / bet };
  }

  // Big win roll (volatility-driven)
  if (secureRandom() < volMod.bigWinChance) {
    const payout = Math.round(bet * volMod.bigWinMultiplier);
    return { outcome: `${color} ${num}`, detail: `Lucky ${color}!`, payout, won: true, isBigWin: true, rtpContribution: payout / bet };
  }

  // Standard red/black outcome using effective probability
  const won = secureRandom() < effectiveWinProb;
  const payout = won ? bet * GAME_PAYOUTS.roulette.win : 0;
  return { outcome: `${color} ${num}`, detail: won ? `${color} wins` : `${color} — House wins`, payout, won, isBigWin: false, rtpContribution: payout / bet };
}

// ─── Blackjack ────────────────────────────────────────────────────────────────

export function resolveBlackjack(
  bet: number,
  effectiveWinProb: number,
  volatility: VolatilityLevel
): RoundResult {
  const r = secureRandom();
  const volMod = VOLATILITY_MODIFIERS[volatility];

  // Natural blackjack (rare)
  if (r < 0.045) {
    const payout = Math.round(bet * GAME_PAYOUTS.blackjack.blackjack);
    return { outcome: 'Blackjack! 🃏', detail: 'Natural 21', payout, won: true, isBigWin: true, rtpContribution: payout / bet };
  }

  // Push
  if (r < 0.09) {
    return { outcome: 'Push', detail: 'Tie — bet returned', payout: bet, won: false, isBigWin: false, rtpContribution: 1 };
  }

  // Big win (volatility)
  if (secureRandom() < volMod.bigWinChance) {
    const payout = Math.round(bet * volMod.bigWinMultiplier);
    return { outcome: 'Big Win! 🎉', detail: 'Perfect hand', payout, won: true, isBigWin: true, rtpContribution: payout / bet };
  }

  const won = secureRandom() < effectiveWinProb;
  const payout = won ? bet * GAME_PAYOUTS.blackjack.win : 0;
  return { outcome: won ? 'You Win!' : 'Dealer Wins', detail: won ? 'Player beats dealer' : 'Dealer has higher hand', payout, won, isBigWin: false, rtpContribution: payout / bet };
}

// ─── Baccarat ─────────────────────────────────────────────────────────────────

export function resolveBaccarat(
  bet: number,
  effectiveWinProb: number,
  _volatility: VolatilityLevel
): RoundResult {
  const r = secureRandom();

  // Tie (rare, high payout)
  if (r < 0.095) {
    const payout = Math.round(bet * GAME_PAYOUTS.baccarat.tie);
    return { outcome: 'Tie 🤝', detail: 'Player and Banker tie', payout, won: true, isBigWin: true, rtpContribution: payout / bet };
  }

  // Banker wins slightly more often (natural baccarat edge)
  const playerWins = secureRandom() < effectiveWinProb;
  if (playerWins) {
    const payout = Math.round(bet * GAME_PAYOUTS.baccarat.player);
    return { outcome: 'Player Wins', detail: 'Player hand wins', payout, won: true, isBigWin: false, rtpContribution: payout / bet };
  }

  const payout = Math.round(bet * GAME_PAYOUTS.baccarat.banker);
  return { outcome: 'Banker Wins', detail: 'Banker hand wins', payout: 0, won: false, isBigWin: false, rtpContribution: 0 };
}

// ─── Poker ────────────────────────────────────────────────────────────────────

type PokerHand = 'high_card' | 'pair' | 'two_pair' | 'flush' | 'straight' | 'full_house';

export function resolvePoker(
  bet: number,
  effectiveWinProb: number,
  volatility: VolatilityLevel
): RoundResult {
  const volMod = VOLATILITY_MODIFIERS[volatility];

  const hand = weightedPick<PokerHand>([
    { value: 'flush',      weight: volMod.bigWinChance * 100 },
    { value: 'full_house', weight: volMod.bigWinChance * 60 },
    { value: 'straight',   weight: volMod.bigWinChance * 80 },
    { value: 'two_pair',   weight: effectiveWinProb * 30 },
    { value: 'pair',       weight: effectiveWinProb * 100 * volMod.smallWinBoost },
    { value: 'high_card',  weight: (1 - effectiveWinProb) * 100 },
  ]);

  const HAND_PAYOUTS: Record<PokerHand, number> = {
    flush:      GAME_PAYOUTS.poker.flush,
    full_house: GAME_PAYOUTS.poker.flush * 1.5,
    straight:   GAME_PAYOUTS.poker.flush * 1.2,
    two_pair:   GAME_PAYOUTS.poker.pair,
    pair:       GAME_PAYOUTS.poker.win,
    high_card:  0,
  };

  const multiplier = HAND_PAYOUTS[hand];
  const won = multiplier > 0;
  const payout = won ? Math.round(bet * multiplier) : 0;
  const isBigWin = multiplier >= GAME_PAYOUTS.poker.flush;

  const HAND_LABELS: Record<PokerHand, string> = {
    flush: 'Flush! 🃏', full_house: 'Full House!', straight: 'Straight!',
    two_pair: 'Two Pair', pair: 'Pair — You Win!', high_card: 'High Card — Dealer Wins',
  };

  return { outcome: HAND_LABELS[hand], detail: hand.replace('_', ' '), payout, won, isBigWin, rtpContribution: payout / bet };
}
