// ─── Live Tables Test Data ────────────────────────────────────────────────────
// TEST_BET_AMOUNT = KES 25 is used as the standard test bet across all games.
// Keep this separate from page objects so data changes don't require POM edits.

export const TEST_BET_AMOUNT = 100;

export const blackjackTestData = {
  tables: [
    {
      id:         'bj-1',
      name:       'Neon Blackjack VIP',
      dealer:     'Sophia',
      minBet:     50,
      maxBet:     5000,
      testBet:    TEST_BET_AMOUNT,
      gameType:   'blackjack',
      featured:   true,
    },
    {
      id:         'bj-2',
      name:       'Classic Blackjack',
      dealer:     'Marcus',
      minBet:     5,
      maxBet:     500,
      testBet:    TEST_BET_AMOUNT,
      gameType:   'blackjack',
      featured:   false,
    },
    {
      id:         'bj-3',
      name:       'Speed Blackjack',
      dealer:     'Elena',
      minBet:     10,
      maxBet:     1000,
      testBet:    TEST_BET_AMOUNT,
      gameType:   'blackjack',
      featured:   false,
    },
  ],
  /** The primary table used in most tests */
  primaryTable: 'Classic Blackjack',
  primaryTableId: 'bj-2',
  primaryMinBet: 5,
  primaryMaxBet: 500,
  testBet: TEST_BET_AMOUNT,
};

export const rouletteTestData = {
  tables: [
    {
      id:       'rl-1',
      name:     'Lightning Roulette',
      dealer:   'Viktor',
      minBet:   1,
      maxBet:   2000,
      testBet:  TEST_BET_AMOUNT,
      gameType: 'roulette',
      featured: true,
    },
    {
      id:       'rl-2',
      name:     'European Roulette',
      dealer:   'Aria',
      minBet:   5,
      maxBet:   500,
      testBet:  TEST_BET_AMOUNT,
      gameType: 'roulette',
      featured: false,
    },
    {
      id:       'rl-3',
      name:     'Neon Roulette',
      dealer:   'Zara',
      minBet:   5,
      maxBet:   1000,
      testBet:  TEST_BET_AMOUNT,
      gameType: 'roulette',
      featured: false,
    },
  ],
  primaryTable:   'European Roulette',
  primaryTableId: 'rl-2',
  primaryMinBet:  5,
  primaryMaxBet:  500,
  testBet:        TEST_BET_AMOUNT,
};

export const baccaratTestData = {
  tables: [
    {
      id:       'bc-1',
      name:     'Baccarat Noir',
      dealer:   'James',
      minBet:   10,
      maxBet:   3000,
      testBet:  TEST_BET_AMOUNT,
      gameType: 'baccarat',
      featured: true,
    },
    {
      id:       'bc-2',
      name:     'Speed Baccarat',
      dealer:   'Luna',
      minBet:   5,
      maxBet:   1000,
      testBet:  TEST_BET_AMOUNT,
      gameType: 'baccarat',
    },
    {
      id:       'bc-3',
      name:     'Mini Baccarat',
      dealer:   'Chen',
      minBet:   5,
      maxBet:   200,
      testBet:  TEST_BET_AMOUNT,
      gameType: 'baccarat',
    },
  ],
  primaryTable:   'Baccarat Noir',
  primaryTableId: 'bc-1',
  primaryMinBet:  10,
  primaryMaxBet:  3000,
  testBet:        TEST_BET_AMOUNT,
};

export const pokerTestData = {
  tables: [
    {
      id:       'pk-1',
      name:     "Texas Hold'em VIP",
      dealer:   'Dante',
      minBet:   25,
      maxBet:   10000,
      testBet:  TEST_BET_AMOUNT,
      gameType: 'poker',
      featured: true,
    },
    {
      id:       'pk-2',
      name:     "Casino Hold'em",
      dealer:   'Mia',
      minBet:   5,
      maxBet:   500,
      testBet:  TEST_BET_AMOUNT,
      gameType: 'poker',
    },
    {
      id:       'pk-3',
      name:     'Three Card Poker',
      dealer:   'Rex',
      minBet:   5,
      maxBet:   300,
      testBet:  TEST_BET_AMOUNT,
      gameType: 'poker',
    },
  ],
  primaryTable:   "Casino Hold'em",
  primaryTableId: 'pk-2',
  primaryMinBet:  5,
  primaryMaxBet:  500,
  testBet:        TEST_BET_AMOUNT,
};
