import { test, expect } from '@playwright/test';
import { LiveTablesPage } from './pages/LiveTablesPage';
import { LiveGamePage } from './pages/LiveGamePage';
import { waitForPageReady, waitForAnimation } from './helpers/waitHelpers';
import {
  blackjackTestData,
  rouletteTestData,
  baccaratTestData,
  pokerTestData,
  TEST_BET_AMOUNT,
} from './fixtures/testData';
import {
  assertVisible,
  assertBettingOpen,
  assertBetPlaced,
  assertValidBetAmount,
  assertInvalidBetAmount,
  assertBalanceChanged,
} from './utils/assertions';

/**
 * Join a live table by ID.
 * If auth session has expired, calls test.skip() — must be called from a
 * test body or beforeEach hook where test.skip() is valid.
 */
async function joinTable(page: import('@playwright/test').Page, tableId: string): Promise<void> {
  const lt = new LiveTablesPage(page);
  try {
    await lt.joinTableById(tableId);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('AUTH_SESSION_NOT_AVAILABLE')) {
      test.skip(true, 'Auth session expired — skipping test suite');
    } else {
      throw err;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Live Tables Lobby (authenticated)
//
// All lobby tests run with the shared storageState auth (set in playwright.config.ts).
// The live-tables project uses storageState: AUTH_STATE, so every test here
// executes as the signed-in test user.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Live Tables — Lobby (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/live-tables');
    await waitForPageReady(page);
  });

  test('page heading is visible', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await expect(lt.heading).toBeVisible();
  });

  test('live indicator is displayed', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await expect(lt.liveIndicator).toBeVisible();
  });

  test('All Tables filter is visible', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await expect(lt.filterAll).toBeVisible();
  });

  test('Blackjack filter is visible', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await lt.filterBlackjack.waitFor({ state: 'attached' });
    await expect(lt.filterBlackjack).toBeVisible();
  });

  test('Roulette filter is visible', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await lt.filterRoulette.waitFor({ state: 'attached' });
    await expect(lt.filterRoulette).toBeVisible();
  });

  test('Baccarat filter is visible', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await lt.filterBaccarat.waitFor({ state: 'attached' });
    await expect(lt.filterBaccarat).toBeVisible();
  });

  test('Poker filter is visible', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await lt.filterPoker.waitFor({ state: 'attached' });
    await expect(lt.filterPoker).toBeVisible();
  });

  test('at least one JOIN TABLE button is present', async ({ page }) => {
    // Use the direct data-testid on the first table's join button
    const firstJoin = page.getByTestId('join-table-bj-1');
    await expect(firstJoin).toBeVisible({ timeout: 8_000 });
  });

  // ── Authenticated JOIN TABLE test ─────────────────────────────────────────
  // Replaces the previous anonymous "clicking Join while logged out shows
  // sign-in alert" test. With a valid session, clicking JOIN TABLE must
  // navigate to the game room, NOT show an authentication alert or modal.
  test('authenticated user clicking JOIN TABLE navigates to game room', async ({ page }) => {
    const lt = new LiveTablesPage(page);

    // Confirm auth session is loaded before interacting
    const navBalance = page.getByTestId('navbar-balance');
    const authed = await navBalance.waitFor({ state: 'attached', timeout: 15_000 })
      .then(() => true).catch(() => false);

    if (!authed) {
      test.skip(true, 'Auth session not loaded — skipping authenticated JOIN TABLE test');
      return;
    }

    // Join the first Classic Blackjack table (bj-2) using the helper that
    // also validates the balance is non-zero before clicking.
    await lt.joinTableById(blackjackTestData.primaryTableId);

    // Must land on the game room URL — no auth modal, no alert banner
    await expect(page).toHaveURL(/\/live-tables\/bj-2/, { timeout: 15_000 });

    // Confirm no sign-in modal appeared
    const authModal = page.locator('[role="dialog"]').filter({ hasText: /sign in/i });
    await expect(authModal).not.toBeVisible();
  });

  test('page has no horizontal overflow', async ({ page }) => {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);
  });

  // ── Table card content ───────────────────────────────────────────

  test('Classic Blackjack card is visible', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await lt.verifyTableVisible('Classic Blackjack');
  });

  test('Classic Blackjack shows correct dealer', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await lt.verifyDealer('Classic Blackjack', 'Marcus');
  });

  test('Classic Blackjack shows correct bet range', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await lt.verifyBetRange('Classic Blackjack', 5, 500);
  });

  test('European Roulette card is visible', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await lt.verifyTableVisible('European Roulette');
  });

  test('Baccarat Noir card is visible', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await lt.verifyTableVisible('Baccarat Noir');
  });

  // ── Filter behavior ──────────────────────────────────────────────
  // Each filter test navigates fresh to /live-tables in beforeEach,
  // so filter state from one test cannot bleed into another.

  test('Blackjack filter hides non-blackjack tables', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await lt.filterByGame('blackjack');
    await expect(page.locator('[data-game-type="roulette"]').first()).toBeHidden({ timeout: 5_000 });
    await expect(page.locator('[data-game-type="blackjack"]').first()).toBeVisible();
  });

  test('Roulette filter shows only roulette tables', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await lt.filterByGame('roulette');
    await expect(page.locator('[data-game-type="blackjack"]').first()).toBeHidden({ timeout: 5_000 });
    await expect(page.locator('[data-game-type="roulette"]').first()).toBeVisible();
  });

  test('All Tables filter restores full grid', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await lt.filterByGame('blackjack');
    await lt.filterByGame('all');
    await expect(page.locator('[data-game-type="roulette"]').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-game-type="blackjack"]').first()).toBeVisible();
  });

  test('clicking Blackjack filter updates its active state', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await lt.filterBlackjack.click();
    await waitForAnimation(page, 300);
    const style = await lt.filterBlackjack.getAttribute('style') ?? '';
    const cls   = await lt.filterBlackjack.getAttribute('class') ?? '';
    expect(style + cls).toMatch(/gradient|text-black/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Blackjack Game Room (authenticated, bet = KES 100)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Blackjack — Game Room (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    // storageState already provides auth — no need to login via UI
    await page.goto('/live-tables');
    await waitForPageReady(page);
    await joinTable(page, blackjackTestData.primaryTableId); // bj-2
    // Wait for the game room to fully render — betting panel must be present
    await page.getByTestId('betting-panel').waitFor({ state: 'visible', timeout: 20_000 });
  });

  test('game room loads with betting panel', async ({ page }) => {
    const game = new LiveGamePage(page);
    await assertVisible(game.bettingPanel, 'betting panel');
    await assertVisible(game.balanceDisplay, 'balance display');
    await assertVisible(game.chipSelector, 'chip selector');
    await assertVisible(game.placeBetButton, 'PLACE BET button');
  });

  test('back-to-tables button navigates to lobby', async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.backButton.click();
    await expect(page).toHaveURL(/\/live-tables$/, { timeout: 5_000 });
  });

  test('game starts in betting phase', async ({ page }) => {
    const game = new LiveGamePage(page);
    await assertBettingOpen(game.gameStatePanel);
  });

  test('balance is displayed as a positive number', async ({ page }) => {
    const game = new LiveGamePage(page);
    const balance = await game.getBalance();
    expect(balance, 'Player balance must be positive').toBeGreaterThan(0);
  });

  test('bet range label shows min and max', async ({ page }) => {
    const game = new LiveGamePage(page);
    await assertVisible(game.betRangeLabel, 'bet range label');
    await expect(game.betRangeLabel).toContainText(`Min KES ${blackjackTestData.primaryMinBet}`);
    await expect(game.betRangeLabel).toContainText(`KES ${blackjackTestData.primaryMaxBet.toLocaleString()}`);
  });

  test('PLACE BET is disabled when no chips selected', async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await assertInvalidBetAmount(game.placeBetButton);
  });

  test(`clicking KES ${TEST_BET_AMOUNT} chip updates bet input`, async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await game.clickChip(TEST_BET_AMOUNT);
    const bet = await game.getCurrentBet();
    expect(bet, `Bet should be ${TEST_BET_AMOUNT} after clicking chip`).toBe(TEST_BET_AMOUNT);
  });

  test(`PLACE BET is enabled after selecting KES ${TEST_BET_AMOUNT}`, async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await game.clickChip(TEST_BET_AMOUNT);
    await assertValidBetAmount(game.placeBetButton, game.minBetWarning);
  });

  test(`placing KES ${TEST_BET_AMOUNT} bet resolves and shows result`, async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await game.placeBet(TEST_BET_AMOUNT);
    await assertBetPlaced(game.resultBanner);
  });

  test(`balance changes after placing KES ${TEST_BET_AMOUNT} bet`, async ({ page }) => {
    const game = new LiveGamePage(page);
    const before = await game.placeBetAndWait(TEST_BET_AMOUNT);
    const after  = await game.getBalance();
    assertBalanceChanged(before, after, TEST_BET_AMOUNT);
  });

  test('CLEAR button resets bet to zero', async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await game.clickChip(TEST_BET_AMOUNT);
    await game.clearBetButton.click();
    const bet = await game.getCurrentBet();
    expect(bet).toBe(0);
  });

  test('PLACE BET disabled after CLEAR', async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await game.clickChip(TEST_BET_AMOUNT);
    await game.clearBetButton.click();
    await assertInvalidBetAmount(game.placeBetButton);
  });

  test('typing bet amount directly works', async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await game.typeBet(TEST_BET_AMOUNT);
    const bet = await game.getCurrentBet();
    expect(bet).toBe(TEST_BET_AMOUNT);
    await assertValidBetAmount(game.placeBetButton, game.minBetWarning);
  });

  test('min bet warning shows when bet is below minimum', async ({ page }) => {
    const game = new LiveGamePage(page);
    const { primaryMinBet } = blackjackTestData;
    // Only relevant if minBet > 1
    if (primaryMinBet <= 1) return;
    await game.waitForBettingPhase();
    // Type 1 KES which is below minBet of 5
    await game.typeBet(1);
    await expect(game.minBetWarning).toBeVisible({ timeout: 3_000 });
    await assertInvalidBetAmount(game.placeBetButton);
  });

  test('bet cannot exceed max bet', async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    const overMax = blackjackTestData.primaryMaxBet + 1000;
    await game.typeBet(overMax);
    const actual = await game.getCurrentBet();
    // App caps at maxBet
    expect(actual).toBeLessThanOrEqual(blackjackTestData.primaryMaxBet);
  });

  test('zero bet keeps PLACE BET disabled', async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await game.typeBet(0);
    await assertInvalidBetAmount(game.placeBetButton);
  });

  test('result banner shows outcome text', async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await game.placeBet(TEST_BET_AMOUNT);
    await game.waitForResult();
    const text = await game.resultBanner.textContent() ?? '';
    expect(text).toMatch(/win|lose|push/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Roulette Game Room (authenticated, bet = KES 100)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Roulette — Game Room (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/live-tables');
    await waitForPageReady(page);
    await joinTable(page, rouletteTestData.primaryTableId); // rl-2
    await page.getByTestId('betting-panel').waitFor({ state: 'visible', timeout: 20_000 });
  });

  test('roulette game room loads', async ({ page }) => {
    const game = new LiveGamePage(page);
    await assertVisible(game.bettingPanel, 'betting panel');
    await assertVisible(game.chipSelector, 'chip selector');
  });

  test('game starts in betting phase', async ({ page }) => {
    const game = new LiveGamePage(page);
    await assertBettingOpen(game.gameStatePanel);
  });

  test(`KES ${TEST_BET_AMOUNT} chip is available and clickable`, async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await game.clickChip(TEST_BET_AMOUNT);
    expect(await game.getCurrentBet()).toBe(TEST_BET_AMOUNT);
  });

  test(`placing KES ${TEST_BET_AMOUNT} bet resolves`, async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await game.placeBet(TEST_BET_AMOUNT);
    await assertBetPlaced(game.resultBanner);
  });

  test(`balance changes after KES ${TEST_BET_AMOUNT} bet`, async ({ page }) => {
    const game = new LiveGamePage(page);
    const before = await game.placeBetAndWait(TEST_BET_AMOUNT);
    const after  = await game.getBalance();
    assertBalanceChanged(before, after, TEST_BET_AMOUNT);
  });

  test('bet range label is correct', async ({ page }) => {
    const game = new LiveGamePage(page);
    await expect(game.betRangeLabel).toContainText(`Min KES ${rouletteTestData.primaryMinBet}`);
  });

  test('PLACE BET disabled with no chips', async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await assertInvalidBetAmount(game.placeBetButton);
  });

  test('multiple chip clicks accumulate the bet', async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await game.clickChip(TEST_BET_AMOUNT);
    await game.clickChip(TEST_BET_AMOUNT);
    const bet = await game.getCurrentBet();
    expect(bet).toBe(TEST_BET_AMOUNT * 2);
  });

  test('clear resets accumulated bet', async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await game.clickChip(TEST_BET_AMOUNT);
    await game.clickChip(TEST_BET_AMOUNT);
    await game.clearBetButton.click();
    expect(await game.getCurrentBet()).toBe(0);
  });

  test('result outcome is valid', async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await game.placeBet(TEST_BET_AMOUNT);
    await game.waitForResult();
    const outcome = await game.getResultOutcome();
    expect(['win', 'push', 'lose']).toContain(outcome);
  });

  test('typing invalid amount keeps PLACE BET disabled', async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await game.typeBet(0);
    await assertInvalidBetAmount(game.placeBetButton);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Baccarat Game Room (authenticated, bet = KES 100)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Baccarat — Game Room (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/live-tables');
    await waitForPageReady(page);
    await joinTable(page, baccaratTestData.primaryTableId); // bc-1
    await page.getByTestId('betting-panel').waitFor({ state: 'visible', timeout: 20_000 });
  });

  test('baccarat game room loads', async ({ page }) => {
    const game = new LiveGamePage(page);
    await assertVisible(game.bettingPanel, 'betting panel');
    await assertVisible(game.balanceDisplay, 'balance display');
  });

  test('game starts in betting phase', async ({ page }) => {
    const game = new LiveGamePage(page);
    await assertBettingOpen(game.gameStatePanel);
  });

  test(`selecting KES ${TEST_BET_AMOUNT} chip updates bet`, async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await game.clickChip(TEST_BET_AMOUNT);
    expect(await game.getCurrentBet()).toBe(TEST_BET_AMOUNT);
  });

  test(`PLACE BET enabled after KES ${TEST_BET_AMOUNT}`, async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await game.clickChip(TEST_BET_AMOUNT);
    await assertValidBetAmount(game.placeBetButton, game.minBetWarning);
  });

  test(`placing KES ${TEST_BET_AMOUNT} bet resolves with result`, async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await game.placeBet(TEST_BET_AMOUNT);
    await assertBetPlaced(game.resultBanner);
  });

  test(`balance changes after KES ${TEST_BET_AMOUNT} bet`, async ({ page }) => {
    const game = new LiveGamePage(page);
    const before = await game.placeBetAndWait(TEST_BET_AMOUNT);
    const after  = await game.getBalance();
    assertBalanceChanged(before, after, TEST_BET_AMOUNT);
  });

  test('min bet warning shows when below minimum', async ({ page }) => {
    const game = new LiveGamePage(page);
    const { primaryMinBet } = baccaratTestData;
    if (primaryMinBet <= 1) return;
    await game.waitForBettingPhase();
    await game.typeBet(1);
    await expect(game.minBetWarning).toBeVisible({ timeout: 3_000 });
    await assertInvalidBetAmount(game.placeBetButton);
  });

  test('CLEAR resets bet correctly', async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await game.clickChip(TEST_BET_AMOUNT);
    await game.clearBetButton.click();
    expect(await game.getCurrentBet()).toBe(0);
    await assertInvalidBetAmount(game.placeBetButton);
  });

  test('bet range shows correct min and max', async ({ page }) => {
    const game = new LiveGamePage(page);
    await expect(game.betRangeLabel).toContainText(`Min KES ${baccaratTestData.primaryMinBet}`);
    await expect(game.betRangeLabel).toContainText(baccaratTestData.primaryMaxBet.toLocaleString());
  });

  test('result banner shows valid outcome', async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await game.placeBet(TEST_BET_AMOUNT);
    await game.waitForResult();
    const outcome = await game.getResultOutcome();
    expect(['win', 'push', 'lose']).toContain(outcome);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — Poker Game Room (authenticated, bet = KES 100)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Poker — Game Room (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/live-tables');
    await waitForPageReady(page);
    // Use joinTableById to avoid CSS attribute selector issues with apostrophes
    await joinTable(page, pokerTestData.primaryTableId);
    await page.getByTestId('betting-panel').waitFor({ state: 'visible', timeout: 20_000 });
  });

  test('poker game room loads', async ({ page }) => {
    const game = new LiveGamePage(page);
    await assertVisible(game.bettingPanel, 'betting panel');
  });

  test('game starts in betting phase', async ({ page }) => {
    const game = new LiveGamePage(page);
    await assertBettingOpen(game.gameStatePanel);
  });

  test(`KES ${TEST_BET_AMOUNT} chip is available`, async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    const chip = page.getByTestId(`chip-${TEST_BET_AMOUNT}`);
    await expect(chip).toBeVisible();
  });

  test(`PLACE BET enabled after selecting KES ${TEST_BET_AMOUNT}`, async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await game.clickChip(TEST_BET_AMOUNT);
    await assertValidBetAmount(game.placeBetButton, game.minBetWarning);
  });

  test(`placing KES ${TEST_BET_AMOUNT} bet resolves`, async ({ page }) => {
    const game = new LiveGamePage(page);
    await game.waitForBettingPhase();
    await game.placeBet(TEST_BET_AMOUNT);
    await assertBetPlaced(game.resultBanner);
  });

  test(`balance changes after KES ${TEST_BET_AMOUNT} poker bet`, async ({ page }) => {
    const game = new LiveGamePage(page);
    const before = await game.placeBetAndWait(TEST_BET_AMOUNT);
    const after  = await game.getBalance();
    assertBalanceChanged(before, after, TEST_BET_AMOUNT);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — Navigation between tables (authenticated)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Live Tables — Navigation (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/live-tables');
    await waitForPageReady(page);
  });

  test('joining Classic Blackjack navigates to game room', async ({ page }) => {
    await joinTable(page, blackjackTestData.primaryTableId);
    await expect(page).toHaveURL(/\/live-tables\/bj-2/, { timeout: 8_000 });
  });

  test('game room back button returns to lobby', async ({ page }) => {
    await joinTable(page, blackjackTestData.primaryTableId);
    const game = new LiveGamePage(page);
    await waitForPageReady(page);
    await game.backButton.click();
    await expect(page).toHaveURL(/\/live-tables$/, { timeout: 5_000 });
  });

  test('joining European Roulette navigates to game room', async ({ page }) => {
    await joinTable(page, rouletteTestData.primaryTableId);
    await expect(page).toHaveURL(/\/live-tables\/rl-2/, { timeout: 8_000 });
  });

  test('joining Baccarat Noir navigates to game room', async ({ page }) => {
    await joinTable(page, baccaratTestData.primaryTableId);
    await expect(page).toHaveURL(/\/live-tables\/bc-1/, { timeout: 8_000 });
  });

  test('authenticated user is not shown sign-in alert on join', async ({ page }) => {
    await joinTable(page, blackjackTestData.primaryTableId);
    await expect(page).toHaveURL(/\/live-tables\/bj-2/, { timeout: 8_000 });
  });
});
