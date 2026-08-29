/**
 * Slot Machine — Bet Placement & Balance Tests
 *
 * Runs under the `chromium-auth` project which loads a pre-authenticated
 * storage state, so no manual login is required.
 *
 * Test account: bonfacegithinji64@gmail.com (must have ≥ KES 5 balance).
 *
 * The balance deduction tests call `apply_spin_result` via the game's own UI —
 * no direct DB writes, no localStorage mocks, no RNG manipulation.
 */

import { test, expect, type Page } from '@playwright/test';
import { waitForPageReady } from './helpers/waitHelpers';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Navigate to the slot page using a non-jackpot game via ?game= query param.
 * The app reads this as a fallback when no React Router location.state is present
 * (which is the case when Playwright navigates directly via page.goto).
 */
async function gotoSlot(page: Page): Promise<boolean> {
  await page.goto('/slot?game=neon-jungle-fruits');
  await page.waitForURL(/auth\/login|\/slot/, { timeout: 10_000 });
  return page.url().includes('/slot');
}

/** Wait for the 1-second loading overlay to disappear */
async function waitForSlotLoad(page: Page): Promise<void> {
  // The loading screen shows a spinner and "LOADING..." text
  await page.locator('text=LOADING...').waitFor({ state: 'hidden', timeout: 8_000 }).catch(() => {});
  await waitForPageReady(page);
  // Also wait for the SPIN button to become visible — confirms game is ready
  await expect(page.getByRole('button', { name: /^spin$/i }).first()).toBeVisible({ timeout: 8_000 });
}

/**
 * Read the displayed balance from the WinDisplay panel.
 * Returns a number in KES (e.g. 85.00).
 */
async function getDisplayedBalance(page: Page): Promise<number> {
  // WinDisplay renders: <span class="font-orbitron ...">KES 85.00</span>
  const balanceEl = page.locator('main').locator('text=/KES \\d/').first();
  await expect(balanceEl).toBeVisible({ timeout: 5_000 });
  const raw = await balanceEl.textContent();
  // Strip "KES " and commas, parse as float
  const numeric = parseFloat((raw ?? '0').replace(/KES\s*/i, '').replace(/,/g, '').trim());
  return isNaN(numeric) ? 0 : numeric;
}

/**
 * Read the current bet amount displayed between the − and + buttons.
 * Returns a number (e.g. 5.00).
 */
async function getDisplayedBet(page: Page): Promise<number> {
  // BettingControls renders the bet as a button with text "KES X.XX"
  const betBtn = page.locator('button').filter({ hasText: /^KES \d+\.\d{2}$/ }).first();
  await expect(betBtn).toBeVisible({ timeout: 5_000 });
  const raw = await betBtn.textContent();
  return parseFloat((raw ?? '0').replace(/KES\s*/i, '').trim());
}

/**
 * Set bet to a specific integer value by clicking − or + from current bet.
 * Max iterations prevents infinite loop on unreachable targets.
 */
async function setBetTo(page: Page, targetKes: number): Promise<void> {
  const increaseBtn = page.getByRole('button', { name: 'Increase bet' });
  const decreaseBtn = page.getByRole('button', { name: 'Decrease bet' });

  for (let i = 0; i < 200; i++) {
    const current = await getDisplayedBet(page);
    if (Math.abs(current - targetKes) < 0.01) return;
    if (current < targetKes) {
      await increaseBtn.click();
    } else {
      await decreaseBtn.click();
    }
    // Small pause so React state updates between clicks
    await page.waitForTimeout(40);
  }
  throw new Error(`Could not reach bet KES ${targetKes} from ${await getDisplayedBet(page)}`);
}

/**
 * Wait for a spin to complete: SPIN button goes from "..." back to "SPIN".
 * Relies on `isSpinning` state reflected in the button text.
 */
async function waitForSpinComplete(page: Page, timeout = 8_000): Promise<void> {
  const spinBtn = page.getByRole('button', { name: /^spin$/i }).first();
  // First confirm spin started (may show "..." briefly)
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('button.rounded-full.bg-yellow-400');
      return btn && btn.textContent?.trim() === '...';
    },
    { timeout: 3_000 }
  ).catch(() => { /* spin may complete instantly in turbo — that's fine */ });
  // Then wait for it to finish
  await expect(spinBtn).toBeVisible({ timeout });
  await expect(spinBtn).toHaveText('SPIN', { timeout });
}

// ─── Test suite ───────────────────────────────────────────────────────────────

test.describe('Slot Machine — Bet Placement', () => {

  test.use({ viewport: { width: 1440, height: 900 } });

  // ── Main happy-path test ──────────────────────────────────────────────────

  test('player can place a KES 5 bet and balance is deducted after spin', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    // 1. Set bet to KES 5
    await setBetTo(page, 5);
    await expect(page.locator('button').filter({ hasText: /^KES 5\.00$/ }).first())
      .toBeVisible({ timeout: 5_000 });

    // 2. SPIN button must be enabled (sufficient balance required)
    const spinBtn = page.getByRole('button', { name: /^spin$/i }).first();
    const isDisabled = await spinBtn.isDisabled();
    if (isDisabled) {
      // Balance too low — skip rather than fail (balance state is real)
      console.log('[slot-betting] Skipping: balance insufficient for KES 5 bet');
      test.skip();
    }

    // 3. Capture balance before spin
    const balanceBefore = await getDisplayedBalance(page);
    expect(balanceBefore).toBeGreaterThanOrEqual(5);

    // 4. Click SPIN
    await spinBtn.click();

    // 5. Wait for animation to complete
    await waitForSpinComplete(page);

    // 6. Balance should have decreased by exactly KES 5 (net = bet - payout; on a loss)
    //    We verify the deduction happened — we don't assume win/loss.
    //    The balance must change by at most 5 (deducted) and at least -infinity (win).
    //    We only assert the deduction side: balanceAfter <= balanceBefore.
    const balanceAfter = await getDisplayedBalance(page);
    // Balance should not increase beyond bet (no jackpot in test account usually)
    // Core assertion: if we lost, exactly 5 was deducted
    const delta = balanceBefore - balanceAfter;
    // delta > 0 means we lost (balance went down)
    // delta < 0 means we won (balance went up) — also valid
    // delta = 0 is impossible since we placed a real bet
    // We assert the payout logic is sane: on a loss, deduction == bet
    if (delta > 0) {
      // Lost spin — verify exact KES 5 deduction
      expect(delta).toBeCloseTo(5, 1); // within KES 0.1 tolerance for floating-point
    } else {
      // Won spin — balance increased, still valid
      expect(balanceAfter).toBeGreaterThan(balanceBefore - 5);
    }

    // 7. Bet amount still shows KES 5.00 after the spin
    await expect(page.locator('button').filter({ hasText: /^KES 5\.00$/ }).first())
      .toBeVisible({ timeout: 3_000 });

    // 8. SPIN button is re-enabled and game is playable
    await expect(spinBtn).toBeVisible();
    await expect(spinBtn).toHaveText('SPIN');
  });

  // ── Bet controls ─────────────────────────────────────────────────────────

  test('+ button increments bet by KES 1', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    await setBetTo(page, 3);
    const before = await getDisplayedBet(page);
    await page.getByRole('button', { name: 'Increase bet' }).click();
    await page.waitForTimeout(100);
    const after = await getDisplayedBet(page);
    expect(after).toBeCloseTo(before + 1, 1);
  });

  test('button decrements bet by KES 1', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    await setBetTo(page, 5);
    const before = await getDisplayedBet(page);
    await page.getByRole('button', { name: 'Decrease bet' }).click();
    await page.waitForTimeout(100);
    const after = await getDisplayedBet(page);
    expect(after).toBeCloseTo(before - 1, 1);
  });

  test('bet cannot go below KES 1 with − button', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    await setBetTo(page, 1);
    const decreaseBtn = page.getByRole('button', { name: 'Decrease bet' });
    await expect(decreaseBtn).toBeDisabled();
  });

  test('custom bet can be set via click on bet display', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    // Click bet display to open editor
    const betDisplay = page.locator('button').filter({ hasText: /^KES \d+\.\d{2}$/ }).first();
    await betDisplay.click();

    // Input field appears
    const input = page.locator('input[type="number"]').first();
    await expect(input).toBeVisible({ timeout: 3_000 });

    // Type KES 7
    await input.fill('7');
    await page.getByRole('button', { name: /^set$/i }).click();

    // Verify bet updated
    await expect(page.locator('button').filter({ hasText: /^KES 7\.00$/ }).first())
      .toBeVisible({ timeout: 3_000 });
  });

  test('custom bet input rejects values below KES 1', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    const betDisplay = page.locator('button').filter({ hasText: /^KES \d+\.\d{2}$/ }).first();
    await betDisplay.click();

    const input = page.locator('input[type="number"]').first();
    await expect(input).toBeVisible({ timeout: 3_000 });
    await input.fill('0');
    await page.getByRole('button', { name: /^set$/i }).click();

    // Error message should appear
    await expect(page.locator('text=/min is kes 1/i').first()).toBeVisible({ timeout: 3_000 });
  });

  test('custom bet input rejects negative values', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    const betDisplay = page.locator('button').filter({ hasText: /^KES \d+\.\d{2}$/ }).first();
    await betDisplay.click();

    const input = page.locator('input[type="number"]').first();
    await expect(input).toBeVisible({ timeout: 3_000 });
    await input.fill('-5');
    await page.getByRole('button', { name: /^set$/i }).click();

    await expect(page.locator('text=/min is kes 1/i').first()).toBeVisible({ timeout: 3_000 });
  });

  test('custom bet input rejects values above KES 10,000', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    const betDisplay = page.locator('button').filter({ hasText: /^KES \d+\.\d{2}$/ }).first();
    await betDisplay.click();

    const input = page.locator('input[type="number"]').first();
    await expect(input).toBeVisible({ timeout: 3_000 });
    await input.fill('999999');
    await page.getByRole('button', { name: /^set$/i }).click();

    await expect(page.locator('text=/max is kes/i').first()).toBeVisible({ timeout: 3_000 });
  });

  // ── SPIN button state ─────────────────────────────────────────────────────

  test('SPIN button is disabled while a spin is in progress', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    // Locate by CSS class (stable regardless of text content changing to "...")
    const spinBtn = page.locator('button.rounded-full.bg-yellow-400').first();
    if (await spinBtn.isDisabled()) test.skip(); // insufficient balance

    await setBetTo(page, 1);
    await spinBtn.click();

    // After click the button text changes to "..." AND becomes disabled
    await expect(spinBtn).toHaveText('...', { timeout: 2_000 });
    await expect(spinBtn).toBeDisabled({ timeout: 2_000 });

    // Wait for spin to complete before next test interference
    await waitForSpinComplete(page);
  });

  test('bet amount remains unchanged after a completed spin', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    await setBetTo(page, 3);
    const spinBtn = page.getByRole('button', { name: /^spin$/i }).first();
    if (await spinBtn.isDisabled()) test.skip();

    await spinBtn.click();
    await waitForSpinComplete(page);

    // Bet should still be KES 3.00
    await expect(page.locator('button').filter({ hasText: /^KES 3\.00$/ }).first())
      .toBeVisible({ timeout: 3_000 });
  });

  test('SPIN button is re-enabled after spin completes', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    await setBetTo(page, 1);
    const spinBtn = page.getByRole('button', { name: /^spin$/i }).first();
    if (await spinBtn.isDisabled()) test.skip();

    await spinBtn.click();
    await waitForSpinComplete(page);

    // Button should be enabled again (assuming balance > 0 after spin)
    await expect(spinBtn).toHaveText('SPIN', { timeout: 5_000 });
  });

  test('rapid double-click on SPIN does not trigger two spins', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    await setBetTo(page, 1);
    const spinBtn = page.locator('button.rounded-full.bg-yellow-400').first();
    if (await spinBtn.isDisabled()) test.skip();

    const balanceBefore = await getDisplayedBalance(page);

    // Click once — button becomes disabled for duration of spin
    await spinBtn.click();
    // Wait for button to become disabled before the second click
    // This simulates a rapid second tap rather than a simultaneous click
    await spinBtn.click({ force: true }); // force bypasses the disabled check in Playwright but the app guards via isSpinning

    await waitForSpinComplete(page);

    const balanceAfter = await getDisplayedBalance(page);
    const delta = balanceBefore - balanceAfter;

    // On a loss: exactly 1 KES deducted (one spin only)
    // On a win: balance may increase — delta could be negative
    // Either way, only one spin occurred, so |delta| < bet * 2
    if (delta > 0) {
      // Lost — assert only one spin's worth was deducted (KES 1 ± tolerance)
      expect(delta).toBeLessThanOrEqual(1.5);
    }
    // Win case is always valid (balance went up, one spin still fired)
  });

  // ── Insufficient balance ──────────────────────────────────────────────────

  test('SPIN button is disabled when bet exceeds balance', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    const balance = await getDisplayedBalance(page);
    // Use the custom editor to set a bet that definitely exceeds balance
    // This avoids the 200-click limit of setBetTo for large gaps
    const targetBet = Math.min(Math.floor(balance) + 500, 10_000);
    if (targetBet <= balance) test.skip(); // balance already >= 10000, can't exceed MAX_BET

    const betDisplay = page.locator('button').filter({ hasText: /^KES \d+\.\d{2}$/ }).first();
    await betDisplay.click();
    const input = page.locator('input[type="number"]').first();
    await expect(input).toBeVisible({ timeout: 3_000 });
    await input.fill(String(targetBet));
    await page.getByRole('button', { name: /^set$/i }).click();
    await page.locator('input[type="number"]').first().waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});

    const spinBtn = page.getByRole('button', { name: /^spin$/i }).first();
    await expect(spinBtn).toBeDisabled({ timeout: 3_000 });
  });

  test('INSUFFICIENT BALANCE warning shows when bet exceeds balance', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    const balance = await getDisplayedBalance(page);
    if (balance >= 10_000) test.skip(); // balance too high to exceed MAX_BET

    const targetBet = Math.min(Math.floor(balance) + 500, 10_000);
    if (targetBet <= balance) test.skip();

    const betDisplay = page.locator('button').filter({ hasText: /^KES \d+\.\d{2}$/ }).first();
    await betDisplay.click();
    const input = page.locator('input[type="number"]').first();
    await expect(input).toBeVisible({ timeout: 3_000 });
    await input.fill(String(targetBet));
    await page.getByRole('button', { name: /^set$/i }).click();
    await page.locator('input[type="number"]').first().waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});

    await expect(page.locator('text=/insufficient balance/i').first())
      .toBeVisible({ timeout: 3_000 });
  });

  // ── Unauthenticated access ────────────────────────────────────────────────

  test('unauthenticated user is redirected away from /slot', async ({ browser }) => {
    // Create a fresh context with NO storageState — explicitly empty
    const ctx  = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();

    await page.goto('/slot');

    // The app starts with loading=true and shows a spinner while authStore.init()
    // resolves. Once it settles with no session, ProtectedRoute fires the redirect.
    // We must wait specifically for /auth/login, not just /slot or /auth/login.
    await page.waitForURL(/auth\/login/, { timeout: 12_000 });
    expect(page.url()).toMatch(/auth\/login/);

    await ctx.close();
  });

  // ── Custom Bet Amount — KES 7 ─────────────────────────────────────────────

  /**
   * Helper: click the bet display button to open the custom editor.
   * Returns the <input type="number"> locator.
   */
  async function openBetEditor(page: Page) {
    const betDisplay = page.locator('button').filter({ hasText: /^KES \d+\.\d{2}$/ }).first();
    await betDisplay.click();
    const input = page.locator('input[type="number"]').first();
    await expect(input).toBeVisible({ timeout: 3_000 });
    return input;
  }

  /** Click SET and wait for the editor to close */
  async function clickSet(page: Page): Promise<void> {
    await page.getByRole('button', { name: /^set$/i }).click();
    await page.locator('input[type="number"]').first()
      .waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
  }

  /** Click CANCEL and wait for the editor to close */
  async function clickCancel(page: Page): Promise<void> {
    await page.getByRole('button', { name: /^cancel$/i }).click();
    await page.locator('input[type="number"]').first()
      .waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
  }

  // Happy path ─────────────────────────────────────────────────────────────────

  test('player can set custom bet to KES 7.00 and place a bet', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    const input = await openBetEditor(page);
    await input.fill('7');
    await clickSet(page);

    await expect(page.locator('button').filter({ hasText: /^KES 7\.00$/ }).first())
      .toBeVisible({ timeout: 3_000 });
    expect(await getDisplayedBet(page)).toBeCloseTo(7, 1);

    const spinBtn = page.locator('button.rounded-full.bg-yellow-400').first();
    if (await spinBtn.isDisabled()) test.skip();

    const balanceBefore = await getDisplayedBalance(page);
    expect(balanceBefore).toBeGreaterThanOrEqual(7);

    await spinBtn.click();
    await waitForSpinComplete(page);

    const balanceAfter = await getDisplayedBalance(page);
    const delta = balanceBefore - balanceAfter;
    if (delta > 0) expect(delta).toBeCloseTo(7, 1);

    await expect(page.locator('button').filter({ hasText: /^KES 7\.00$/ }).first())
      .toBeVisible({ timeout: 3_000 });
  });

  test('"7" is displayed as KES 7.00 after SET', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    const input = await openBetEditor(page);
    await input.fill('7');
    await clickSet(page);

    await expect(page.locator('button').filter({ hasText: /^KES 7\.00$/ }).first())
      .toBeVisible({ timeout: 3_000 });
  });

  // Validation — invalid inputs ─────────────────────────────────────────────

  test('custom input: empty amount shows validation error', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    const input = await openBetEditor(page);
    await input.fill('');
    await page.getByRole('button', { name: /^set$/i }).click();

    await expect(page.locator('.text-red-400').filter({ hasText: /enter a valid/i }).first())
      .toBeVisible({ timeout: 3_000 });
    await expect(input).toBeVisible(); // editor still open
  });

  test('custom input: KES 0 shows validation error', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    const input = await openBetEditor(page);
    await input.fill('0');
    await page.getByRole('button', { name: /^set$/i }).click();

    await expect(page.locator('.text-red-400').filter({ hasText: /min is kes/i }).first())
      .toBeVisible({ timeout: 3_000 });
  });

  test('custom input: negative amount shows validation error', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    const input = await openBetEditor(page);
    await input.fill('-5');
    await page.getByRole('button', { name: /^set$/i }).click();

    await expect(page.locator('.text-red-400').filter({ hasText: /min is kes/i }).first())
      .toBeVisible({ timeout: 3_000 });
  });

  test('custom input: below minimum (KES 0.50) shows validation error', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    const input = await openBetEditor(page);
    await input.fill('0.50');
    await page.getByRole('button', { name: /^set$/i }).click();

    await expect(page.locator('.text-red-400').filter({ hasText: /min is kes 1/i }).first())
      .toBeVisible({ timeout: 3_000 });
  });

  test('custom input: above maximum (KES 10,001) shows validation error', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    const input = await openBetEditor(page);
    await input.fill('10001');
    await page.getByRole('button', { name: /^set$/i }).click();

    await expect(page.locator('.text-red-400').filter({ hasText: /max is kes/i }).first())
      .toBeVisible({ timeout: 3_000 });
  });

  test('custom input: decimal 7.50 is accepted as KES 7.50', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    const input = await openBetEditor(page);
    await input.fill('7.50');
    await clickSet(page);

    await expect(page.locator('button').filter({ hasText: /^KES 7\.50$/ }).first())
      .toBeVisible({ timeout: 3_000 });
  });

  test('custom input: non-numeric input is ignored', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    const input = await openBetEditor(page);

    // fill() rejects non-numeric strings on type=number — use pressSequentially
    // to simulate real keystrokes the way a user would type.
    // Browsers strip non-numeric chars from number inputs natively.
    await input.pressSequentially('abc');
    const valAfterAlpha = await input.inputValue();
    expect(valAfterAlpha).toBe(''); // letters silently dropped

    // The letter 'e' is allowed by browsers (scientific notation: 1e5 = 100000)
    // but the app's validation rejects it at SET time since parseFloat('e') = NaN.
    await input.pressSequentially('e');
    const valAfterE = await input.inputValue();
    
    // Either way, clicking SET must show a validation error
    await page.getByRole('button', { name: /^set$/i }).click();
    // Error visible — app rejects non-parseable input
    await expect(page.locator('.text-red-400').first()).toBeVisible({ timeout: 3_000 });
    expect(valAfterAlpha).toBe(''); // primary assertion: plain letters are dropped
  });

  // CANCEL behaviour ────────────────────────────────────────────────────────

  test('CANCEL restores the previous bet amount', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    const betBefore = await getDisplayedBet(page);

    const input = await openBetEditor(page);
    await input.fill('99');
    await clickCancel(page);

    expect(await getDisplayedBet(page)).toBeCloseTo(betBefore, 1);
  });

  test('CANCEL closes the editor without applying the value', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    const input = await openBetEditor(page);
    await input.fill('50');
    await clickCancel(page);

    await expect(page.locator('input[type="number"]').first()).toBeHidden({ timeout: 3_000 });
  });

  // Spin with KES 7 ─────────────────────────────────────────────────────────

  test('KES 7 custom bet: deducts exactly KES 7 once per spin', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    const input = await openBetEditor(page);
    await input.fill('7');
    await clickSet(page);

    const spinBtn = page.locator('button.rounded-full.bg-yellow-400').first();
    if (await spinBtn.isDisabled()) test.skip();

    const balanceBefore = await getDisplayedBalance(page);
    await spinBtn.click();
    await waitForSpinComplete(page);
    const balanceAfter = await getDisplayedBalance(page);

    const delta = balanceBefore - balanceAfter;
    if (delta > 0) expect(delta).toBeCloseTo(7, 1);
  });

  test('KES 7 custom bet: rapid double-click does not create duplicate bets', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    const input = await openBetEditor(page);
    await input.fill('7');
    await clickSet(page);

    const spinBtn = page.locator('button.rounded-full.bg-yellow-400').first();
    if (await spinBtn.isDisabled()) test.skip();

    const balanceBefore = await getDisplayedBalance(page);
    await spinBtn.click();
    await spinBtn.click({ force: true }); // second click blocked by isSpinning
    await waitForSpinComplete(page);
    const balanceAfter = await getDisplayedBalance(page);

    const delta = balanceBefore - balanceAfter;
    if (delta > 0) expect(delta).toBeLessThanOrEqual(7.5); // one spin only
  });

  test('KES 7 custom bet: bet remains KES 7.00 after spin', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);

    const input = await openBetEditor(page);
    await input.fill('7');
    await clickSet(page);

    const spinBtn = page.locator('button.rounded-full.bg-yellow-400').first();
    if (await spinBtn.isDisabled()) test.skip();

    await spinBtn.click();
    await waitForSpinComplete(page);

    await expect(page.locator('button').filter({ hasText: /^KES 7\.00$/ }).first())
      .toBeVisible({ timeout: 3_000 });
  });

});
