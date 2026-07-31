/**
 * Game Resolvers — Blackjack, Roulette, Baccarat, Poker
 *
 * Each resolver:
 * - Takes effective win probability (already RTP-adjusted)
 * - Uses cryptographically secure RNG
 * - Returns a structured RoundResult
 * - Does NOT force outcomes — all results are probability-driven
 *
 * Realistic casino math:
 * - Blackjack: natural ~4.8% of hands, push ~8%, dealer wins ~49.5%
 * - Roulette: 1/37 zero, even-money bets pay 1:1
 * - Baccarat: banker commission 5%, tie pays 8:1
 * - Poker: hand rankings with realistic frequency weights
 */

import { secureRandom, weightedPick } from './weightedRNG';
import { GAME_PAYOUTS, VOLATILITY_MODIFIERS, type VolatilityLevel } from './outcomeConfig';

export interface RoundResult {
  outcome: string;
  detail: string;
  payout: number;      // total returned to player (0 = full loss)
  won: boolean;        // true if payout > bet
  isPush: boolean;     // true if bet was returned with no net win/loss
  isBigWin: boolean;
  rtpContribution: number;
}

// ─── Roulette ─────────────────────────────────────────────────────────────────
// European roulette: 37 pockets (0–36), even-money bets win on 18/37 = 48.65%
// House edge: 1/37 = 2.70%

export function resolveRoulette(
  bet: number,
  effectiveWinProb: number,
  volatility: VolatilityLevel
): RoundResult {
  const num = Math.floor(secureRandom() * 37); // 0–36
  const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(num);
  const color = num === 0 ? 'Green' : isRed ? 'Red' : 'Black';

  // Zero — straight-up win (rare, 36:1)
  if (num === 0) {
    const payout = Math.round(bet * GAME_PAYOUTS.roulette.zero);
    return { outcome: `🟢 Zero (0)`, detail: 'Straight up — 36:1!', payout, won: true, isPush: false, isBigWin: true, rtpContribution: payout / bet };
  }

  // Volatility-driven big win (e.g. player bet on exact number) — capped at 10× for roulette
  const volMod = VOLATILITY_MODIFIERS[volatility];
  if (secureRandom() < volMod.bigWinChance) {
    const payout = Math.round(bet * Math.min(volMod.bigWinMultiplier, 10));
    return { outcome: `${color === 'Red' ? '🔴' : '⚫'} ${num}`, detail: `Lucky number — big win!`, payout, won: true, isPush: false, isBigWin: true, rtpContribution: payout / bet };
  }

  // Standard even-money outcome using effective probability
  const won = secureRandom() < effectiveWinProb;
  const payout = won ? bet * GAME_PAYOUTS.roulette.win : 0;
  return {
    outcome: `${color === 'Red' ? '🔴' : '⚫'} ${num}`,
    detail: won ? `${color} wins` : `${color} — House wins`,
    payout, won, isPush: false, isBigWin: false, rtpContribution: payout / bet,
  };
}

// ─── Blackjack ────────────────────────────────────────────────────────────────
// Realistic distribution:
//   Natural blackjack: ~4.8% of hands
//   Push: ~8% of hands
//   Player win: ~42.5% (after removing naturals and pushes)
//   Dealer win: ~49.5%

export function resolveBlackjack(
  bet: number,
  effectiveWinProb: number,
  volatility: VolatilityLevel
): RoundResult {
  const r = secureRandom();
  const volMod = VOLATILITY_MODIFIERS[volatility];

  // Natural blackjack (4.8% — pays 3:2)
  if (r < 0.048) {
    const payout = Math.round(bet * GAME_PAYOUTS.blackjack.blackjack); // 2.5× = 3:2 + stake
    return { outcome: '🃏 Blackjack!', detail: 'Natural 21 — pays 3:2', payout, won: true, isPush: false, isBigWin: true, rtpContribution: payout / bet };
  }

  // Push (8% — bet returned)
  if (r < 0.128) {
    return { outcome: 'Push', detail: 'Tie — bet returned', payout: bet, won: false, isPush: true, isBigWin: false, rtpContribution: 1 };
  }

  // Dealer blackjack (4.8% — player loses unless also has blackjack)
  if (r < 0.176) {
    return { outcome: 'Dealer Blackjack', detail: 'Dealer has natural 21', payout: 0, won: false, isPush: false, isBigWin: false, rtpContribution: 0 };
  }

  // Volatility big win (double down / split scenario) — capped at 2.5× for blackjack realism
  if (secureRandom() < volMod.bigWinChance * 0.5) {
    const payout = Math.round(bet * Math.min(volMod.bigWinMultiplier, 2.5));
    return { outcome: '🎉 Double Down Win!', detail: 'Perfect double down — 2.5:1', payout, won: true, isPush: false, isBigWin: true, rtpContribution: payout / bet };
  }

  // Standard win/loss using effective probability
  const won = secureRandom() < effectiveWinProb;
  const payout = won ? bet * GAME_PAYOUTS.blackjack.win : 0;
  return {
    outcome: won ? '✅ You Win' : '❌ Dealer Wins',
    detail: won ? 'Player beats dealer' : 'Dealer has higher hand',
    payout, won, isPush: false, isBigWin: false, rtpContribution: payout / bet,
  };
}

// ─── Baccarat ─────────────────────────────────────────────────────────────────
// Natural probabilities:
//   Banker wins: 45.86%
//   Player wins: 44.62%
//   Tie: 9.52%
// Banker bet pays 0.95:1 (5% commission), Player bet pays 1:1

export function resolveBaccarat(
  bet: number,
  effectiveWinProb: number,
  _volatility: VolatilityLevel
): RoundResult {
  const r = secureRandom();

  // Tie (9.52% — pays 8:1)
  if (r < 0.0952) {
    const payout = Math.round(bet * GAME_PAYOUTS.baccarat.tie);
    return { outcome: '🤝 Tie', detail: 'Player and Banker tie — 8:1', payout, won: true, isPush: false, isBigWin: true, rtpContribution: payout / bet };
  }

  // Player wins (using effective probability on remaining ~90.5% of outcomes)
  // Effective prob applies to the player vs banker split
  const playerWins = secureRandom() < effectiveWinProb;

  if (playerWins) {
    const payout = Math.round(bet * GAME_PAYOUTS.baccarat.player); // 2× (1:1 + stake)
    return { outcome: '🔵 Player Wins', detail: 'Player hand wins — 1:1', payout, won: true, isPush: false, isBigWin: false, rtpContribution: payout / bet };
  }

  // Banker wins — player loses their bet
  return { outcome: '🏦 Banker Wins', detail: 'Banker hand wins', payout: 0, won: false, isPush: false, isBigWin: false, rtpContribution: 0 };
}

// ─── Poker ────────────────────────────────────────────────────────────────────
// Simplified casino poker (e.g. Three Card Poker / Casino Hold'em style)
// Hand frequencies weighted to match realistic casino poker RTP ~95%

type PokerHand = 'high_card' | 'pair' | 'two_pair' | 'straight' | 'flush' | 'full_house';

const HAND_LABELS: Record<PokerHand, string> = {
  high_card:  '❌ High Card — Dealer Wins',
  pair:       '✅ Pair — You Win',
  two_pair:   '✅ Two Pair',
  straight:   '🎯 Straight!',
  flush:      '🃏 Flush!',
  full_house: '🔥 Full House!',
};

const HAND_PAYOUTS_MAP: Record<PokerHand, number> = {
  high_card:  0,
  pair:       GAME_PAYOUTS.poker.win,       // 2×
  two_pair:   GAME_PAYOUTS.poker.pair,      // 1.5×
  straight:   GAME_PAYOUTS.poker.straight,  // 2.5×
  flush:      GAME_PAYOUTS.poker.flush,     // 3×
  full_house: GAME_PAYOUTS.poker.full_house, // 4×
};

export function resolvePoker(
  bet: number,
  effectiveWinProb: number,
  volatility: VolatilityLevel
): RoundResult {
  const volMod = VOLATILITY_MODIFIERS[volatility];
  const loseWeight = (1 - effectiveWinProb) * 100;
  const winWeight = effectiveWinProb * 100;

  const hand = weightedPick<PokerHand>([
    { value: 'full_house', weight: volMod.bigWinChance * 40  },
    { value: 'flush',      weight: volMod.bigWinChance * 60  },
    { value: 'straight',   weight: volMod.bigWinChance * 80  },
    { value: 'two_pair',   weight: winWeight * 0.20 * volMod.smallWinBoost },
    { value: 'pair',       weight: winWeight * 0.60 * volMod.smallWinBoost },
    { value: 'high_card',  weight: loseWeight },
  ]);

  const multiplier = HAND_PAYOUTS_MAP[hand];
  const won = multiplier > 0;
  const payout = won ? Math.round(bet * multiplier) : 0;
  const isBigWin = multiplier >= GAME_PAYOUTS.poker.flush;

  return {
    outcome: HAND_LABELS[hand],
    detail: hand.replace('_', ' '),
    payout, won, isPush: false, isBigWin,
    rtpContribution: bet > 0 ? payout / bet : 0,
  };
}
