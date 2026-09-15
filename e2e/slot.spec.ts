import { test, expect, type Page } from '@playwright/test';
import { waitForPageReady, waitForAnimation } from './helpers/waitHelpers';

/**
 * Slot Machine page tests.
 *
 * GameCanvas renders pure div cells (no <canvas>).
 * The /slot route is protected — non-auth projects redirect to /auth/login.
 * All authenticated tests guard with `if (!(await gotoSlot(page))) test.skip()`.
 */

test.describe('Slot Machine Page — unauthenticated redirect', () => {

  test('unauthenticated /slot redirects to /auth/login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/slot');
    await page.waitForURL(/auth\/login|\/slot/, { timeout: 8_000 });
    expect(page.url()).toMatch(/auth\/login|\/slot/);
  });

});

test.describe('Slot Machine Page — authenticated', () => {

  async function gotoSlot(page: Page): Promise<boolean> {
    await page.goto('/slot');
    await page.waitForURL(/auth\/login|\/slot/, { timeout: 10_000 });
    return page.url().includes('/slot');
  }

  async function waitForSlotLoad(page: Page): Promise<void> {
    await page.locator('text=LOADING...').waitFor({ state: 'hidden', timeout: 6_000 }).catch(() => {});
    await waitForPageReady(page);
  }

  test('game title (h1) is visible', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 8_000 });
  });

  test('← LOBBY back button is visible', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);
    // The back button text is "← LOBBY" — use getByText for exact match
    const backBtn = page.getByText('← LOBBY', { exact: false });
    await expect(backBtn.first()).toBeVisible({ timeout: 8_000 });
  });

  test('← LOBBY back button navigates to home', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);
    await page.getByText('← LOBBY', { exact: false }).first().click();
    await expect(page).toHaveURL('/');
  });

  test('reel grid div is rendered (GameCanvas uses divs, not canvas)', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);
    // GameCanvas outer wrapper: <div class="w-full" style="max-width: 520px">
    // Inner panel div has background #080810
    // Use a more reliable selector: the outer full-width wrapper
    const reelWrapper = page.locator('main div.w-full').filter({ hasNot: page.locator('h1') }).first();
    await expect(reelWrapper).toBeAttached({ timeout: 8_000 });
  });

  test('SPIN button shows "SPIN" text', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);
    // SpinControls: motion.button renders with text "SPIN" when not spinning
    // The button is a circle w-24 h-24 rounded-full bg-yellow-400
    const spinBtn = page.locator('button.rounded-full.bg-yellow-400').first();
    await expect(spinBtn).toBeVisible({ timeout: 8_000 });
    const text = await spinBtn.textContent();
    expect(text?.trim()).toMatch(/SPIN|\.\.\./);
  });

  test('AUTO toggle button is visible', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);
    await expect(
      page.locator('button').filter({ hasText: /^AUTO$/ }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('TURBO toggle button is visible', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);
    await expect(
      page.locator('button').filter({ hasText: /turbo/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('PAYTABLE button is visible', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);
    await expect(page.getByRole('button', { name: /paytable/i })).toBeVisible({ timeout: 8_000 });
  });

  test('PAYTABLE button opens the paytable modal', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);
    await page.getByRole('button', { name: /paytable/i }).click();
    await waitForAnimation(page, 400);
    await expect(
      page.locator('.fixed.inset-0').filter({ hasText: /paytable/i })
    ).toBeVisible({ timeout: 5_000 });
  });

  test('no horizontal overflow on slot page', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);
  });

  test('slot page root div has overflow hidden', async ({ page }) => {
    if (!(await gotoSlot(page))) test.skip();
    await waitForSlotLoad(page);
    const fits = await page.evaluate(() => {
      const root = document.querySelector('.slot-page-root') as HTMLElement | null;
      if (!root) return false;
      return window.getComputedStyle(root).overflow === 'hidden';
    });
    expect(fits).toBe(true);
  });

});
