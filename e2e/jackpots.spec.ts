import { test, expect } from '@playwright/test';
import { waitForPageReady } from './helpers/waitHelpers';

test.describe('Jackpots Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/jackpots');
    await waitForPageReady(page);
  });

  test('page heading is visible', async ({ page }) => {
    // h1 contains "Progressive" and "Jackpots" (the word is split across a span)
    const heading = page.locator('h1').filter({ hasText: /jackpot/i }).first();
    await expect(heading).toBeVisible({ timeout: 8_000 });
  });

  test('sub-heading describes jackpot mechanics', async ({ page }) => {
    await expect(
      page.locator('p').filter({ hasText: /every bet contributes/i }).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('at least one SPIN NOW button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /spin now/i }).first()).toBeVisible({ timeout: 8_000 });
  });

  test('SPIN NOW buttons are enabled', async ({ page }) => {
    await expect(page.getByRole('button', { name: /spin now/i }).first()).toBeEnabled({ timeout: 8_000 });
  });

  test('clicking SPIN NOW redirects to login or slot', async ({ page }) => {
    const first = page.getByRole('button', { name: /spin now/i }).first();
    await expect(first).toBeVisible({ timeout: 8_000 });
    await first.click();
    await page.waitForURL(/auth\/login|\/slot/, { timeout: 8_000 });
    expect(page.url()).toMatch(/auth\/login|\/slot/);
  });

  test('jackpot amount text (KES) is visible on at least one card', async ({ page }) => {
    const amount = page.locator('text=KES').first();
    await expect(amount).toBeVisible({ timeout: 8_000 });
  });

  test('page has no horizontal overflow', async ({ page }) => {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);
  });

});
