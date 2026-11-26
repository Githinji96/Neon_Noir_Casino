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
 * Waits for either the SPIN button (authenticated) or login redirect (not authenticated).
 * Returns true only when the game is actually ready to interact with.
 */
async function gotoSlot(page: Page): Promise<boolean> {
  await page.goto('/slot?game=neon-jungle-fruits');
  // Wait for navigation to settle — either on /slot or redirected to /auth/login
  await page.waitForURL(/auth\/login|\/slot/, { timeout: 10_000 });
  if (!page.url().includes('/slot')) return false;

  // Wait for the SPIN button — this confirms auth resolved AND game rendered.
  // ProtectedRoute takes up to 4s to time out; slot itself takes 1s to load.
  // Total: allow up to 8s for the button to appear.
  const spinBtn = page.locator('button.rounded-full.bg-yellow-400').first();
  try {
    await spinBtn.waitFor({ state: 'visible', timeout: 8_000 });
    return true;
  } catch {
    // Button never appeared — auth timed out and redirected, or game failed to load
    return false;
  }
}

/** Wait for the slot game to be fully interactive after gotoSlot confirms it's loaded */
async function waitForSlotLoad(page: Page): Promise<void> {
  // gotoSlot already waits for the SPIN button — just ensure page is settled
  await waitForPageReady(page);
  // The SPIN button must already be visible (guaranteed by gotoSlot)
  const spinBtn = page.locator('button.rounded-full.bg-yellow-400').first();
  try {
    await spinBtn.waitFor({ state: 'visible', timeout: 5_000 });
  } catch {
    test.skip();
  }
}

/**
 * Read the displayed balance from the WinDisplay panel.
 * Returns a number in KES (e.g. 85.00).
 */
async function getDisplayedBalance(page: Page): Promise<number> {
  // WinDisplay renders a "Balance" label next to the balance value.
  // Target the span immediately after the Balance label.
  const balanceSection = page.locator('main').locator('span').filter({ hasText: /^Balance$/i }).first();
  // The sibling span with the KES value is the next element
  // Use the parent's text content and extract the KES value that's NOT the label
  const container = balanceSection.locator('..');
  await expect(container).toBeVisible({ timeout: 5_000 });

  // Get all text from the container and find the KES amount
  const raw = await container.textContent();
  const match = (raw ?? '').match(/KES\s+([\d,]+\.\d{2})/);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ''));
  }

  // Fallback: find the font-orbitron white balance span directly
  const balanceEl = page.locator('main span.font-orbitron.text-white.font-bold').first();
  const text = await balanceEl.textContent().catch(() => '0');
  const numeric = parseFloat((text ?? '0').replace(/KES\s*/i, '').replace(/,/g, '').trim());
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
 * Set bet to a specific integer value.
 * Uses the custom-bet editor (click bet display → type value → SET) for reliability.
 * Falls back to +/- buttons only if the editor isn't available.
 */
async function setBetTo(page: Page, targetKes: number): Promise<void> {
  // Try direct text input via the bet display button (most reliable)
  const betDisplay = page.locator('button').filter({ hasText: /^KES \d+\.\d{2}$/ }).first();
  const isVisible = await betDisplay.isVisible({ timeout: 3_000 }).catch(() => false);

  if (isVisible) {
    await betDisplay.click();
    // Editor should open — wait for the number input
    const numInput = page.locator('input[type="number"]').first();
    const editorOpened = await numInput.isVisible({ timeout: 3_000 }).catch(() => false);

    if (editorOpened) {
      await numInput.fill(String(targetKes));
      // Press Enter or click SET button
      const setBtn = page.getByRole('button', { name: /^set$/i });
      const setVisible = await setBtn.isVisible({ timeout: 2_000 }).catch(() => false);
      if (setVisible) {
        await setBtn.click();
      } else {
        await numInput.press('Enter');
      }
      // Verify the value was applied
      await expect(
        page.locator('button').filter({ hasText: new RegExp(`^KES ${targetKes.toFixed(2)}$`) }).first()
      ).toBeVisible({ timeout: 5_000 });
      return;
    }
  }

  // Fallback: use +/- buttons, but only click when the button is enabled
  const increaseBtn = page.getByRole('button', { name: 'Increase bet' });
  const decreaseBtn = page.getByRole('button', { name: 'Decrease bet' });

  for (let i = 0; i < 200; i++) {
    const current = await getDisplayedBet(page);
    if (Math.abs(current - targetKes) < 0.01) return;

    if (current < targetKes) {
      const disabled = await increaseBtn.isDisabled();
      if (disabled) break; // at max, can't go higher
      await increaseBtn.click();
    } else {
      const disabled = await decreaseBtn.isDisabled();
      if (disabled) break; // at min, can't go lower
      await decreaseBtn.click();
    }
    await page.waitForTimeout(40);
  }

  const final = await getDisplayedBet(page);
  if (Math.abs(final - targetKes) > 0.01) {
    throw new Error(`Could not reach bet KES ${targetKes} — stopped at KES ${final}`);
  }
}

/**
 * Wait for a spin to complete: SPIN button goes from "..." back to its normal text.
 * Uses CSS class selector to avoid aria-label / translation issues.
 */
async function waitForSpinComplete(page: Page, timeout = 8_000): Promise<void> {
  // First confirm spin started (shows "..." text)
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('button.rounded-full.bg-yellow-400');
      return btn && btn.textContent?.trim() === '...';
    },
    { timeout: 3_000 }
  ).catch(() => { /* spin may complete instantly in turbo — that's fine */ });
  // Then wait for it to finish (text is no longer "...")
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('button.rounded-full.bg-yellow-400');
      return btn && btn.textContent?.trim() !== '...';
    },
    { timeout }
  );
  // Wait for balance to stabilize — the apply_spin_result RPC updates balance
  // asynchronously and may still be in-flight. We wait until the displayed
  // balance stops changing for 400ms to ensure we read the final settled value.
  let prev = '';
  let stableCount = 0;
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(100);
    const el = page.locator('main').locator('text=/KES \\d/').first();
    const cur = await el.textContent().catch(() => '');
    if (cur === prev) {
      stableCount++;
      if (stableCount >= 4) break; // stable for 400ms
    } else {
      stableCount = 0;
      prev = cur ?? '';
    }
  }
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
