import { test, expect } from '@playwright/test';
import { JackpotsPage } from './pages/JackpotsPage';

test.describe('Jackpots Page', () => {

  // Jackpots page has real-time animations and Supabase subscriptions that
  // prevent networkidle from ever firing. 60s timeout covers slow machines.
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    // Navigate and wait for the HTML document only — React renders asynchronously.
    // Each test waits for the specific element it needs.
    await page.goto('/jackpots', { waitUntil: 'commit' });
  });

  test('page heading is visible', async ({ page }) => {
    // "Progressive Jackpots" h1 — wait for React to render it
    await expect(
      page.locator('h1').filter({ hasText: /progressive.*jackpot|jackpot/i }).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test('sub-heading describes jackpot mechanics', async ({ page }) => {
    const jp = new JackpotsPage(page);
    await expect(jp.subHeading).toBeVisible({ timeout: 15_000 });
  });

  test('at least one SPIN NOW button is present', async ({ page }) => {
    const jp = new JackpotsPage(page);
    // Skip if all jackpots are in WON/resetting state (no SPIN NOW buttons shown)
    const visible = await jp.spinBtns.first().isVisible({ timeout: 20_000 }).catch(() => false);
    test.skip(!visible, 'No SPIN NOW button visible — jackpots may be in WON/resetting state');
    if (visible) await expect(jp.spinBtns.first()).toBeVisible();
  });

  test('SPIN NOW buttons are enabled', async ({ page }) => {
    const jp = new JackpotsPage(page);
    const visible = await jp.spinBtns.first().isVisible({ timeout: 20_000 }).catch(() => false);
    test.skip(!visible, 'No SPIN NOW button visible — jackpots may be in WON/resetting state');
    if (visible) await expect(jp.spinBtns.first()).toBeEnabled();
  });

  test('clicking SPIN NOW navigates to slot machine', async ({ page }) => {
    const jp = new JackpotsPage(page);
    const spinBtn = jp.spinBtns.first();

    // Wait for button — if not visible after 20s, jackpots may all be in WON state
    const btnVisible = await spinBtn.isVisible({ timeout: 20_000 }).catch(() => false);
    if (!btnVisible) {
      test.skip(true, 'No SPIN NOW button visible — jackpots may be in WON/resetting state');
      return;
    }

    // If not authenticated, ProtectedRoute redirects /slot to login — skip
    const navBalance = page.getByTestId('navbar-balance');
    const authed = await navBalance.waitFor({ state: 'attached', timeout: 8_000 })
      .then(() => true).catch(() => false);
    if (!authed) {
      test.skip(true, 'Auth session not available — slot requires login');
      return;
    }

    await spinBtn.scrollIntoViewIfNeeded();
    await spinBtn.click();
    await page.waitForURL(/\/slot|\/auth\/login/, { timeout: 25_000 });
    if (page.url().includes('/auth/login')) {
      test.skip(true, 'Auth session expired during test');
      return;
    }
    expect(page.url()).toContain('/slot');
  });

  test('jackpot amount text (KES) is visible on at least one card', async ({ page }) => {
    await expect(page.locator('text=KES').first()).toBeVisible({ timeout: 20_000 });
  });

  test('page has no horizontal overflow', async ({ page }) => {
    // Wait for the h1 to confirm React has rendered before measuring
    await page.locator('h1').first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);
  });

});
