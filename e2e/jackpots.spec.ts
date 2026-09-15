import { test, expect } from '@playwright/test';
import { JackpotsPage } from './pages/JackpotsPage';
import { waitForPageReady } from './helpers/waitHelpers';

test.describe('Jackpots Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/jackpots');
    await waitForPageReady(page);
  });

  test('page heading is visible', async ({ page }) => {
    const jp = new JackpotsPage(page);
    // heading contains "Jackpot" — the component uses h1 with "Progressive Jackpots"
    await expect(page.locator('h1').filter({ hasText: /jackpot/i }).first())
      .toBeVisible({ timeout: 8_000 });
  });

  test('sub-heading describes jackpot mechanics', async ({ page }) => {
    const jp = new JackpotsPage(page);
    await expect(jp.subHeading).toBeVisible({ timeout: 5_000 });
  });

  test('at least one SPIN NOW button is present', async ({ page }) => {
    const jp = new JackpotsPage(page);
    await expect(jp.spinBtns.first()).toBeVisible({ timeout: 8_000 });
  });

  test('SPIN NOW buttons are enabled', async ({ page }) => {
    const jp = new JackpotsPage(page);
    await expect(jp.spinBtns.first()).toBeEnabled({ timeout: 8_000 });
  });

  test('clicking SPIN NOW redirects to login or slot', async ({ page }) => {
    const jp = new JackpotsPage(page);
    await expect(jp.spinBtns.first()).toBeVisible({ timeout: 8_000 });
    await jp.spinBtns.first().click();
    await page.waitForURL(/auth\/login|\/slot/, { timeout: 8_000 });
    expect(page.url()).toMatch(/auth\/login|\/slot/);
  });

  test('jackpot amount text (KES) is visible on at least one card', async ({ page }) => {
    await expect(page.locator('text=KES').first()).toBeVisible({ timeout: 8_000 });
  });

  test('page has no horizontal overflow', async ({ page }) => {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);
  });

});
