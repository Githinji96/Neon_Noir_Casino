import { test, expect } from '@playwright/test';
import { waitForPageReady, waitForAnimation } from './helpers/waitHelpers';

test.describe('Live Tables Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/live-tables');
    await waitForPageReady(page);
  });

  test('page heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /live.*casino.*tables/i })).toBeVisible();
  });

  test('live indicator is displayed', async ({ page }) => {
    await expect(
      page.locator('span').filter({ hasText: /tables live now/i })
    ).toBeVisible();
  });

  // ── Category filter tabs ──────────────────────────────────────────
  // Actual labels from GAME_CATEGORIES: "All Tables", "Blackjack", "Roulette", "Baccarat", "Poker"

  test('"All Tables" filter button is visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /all tables/i }).first()
    ).toBeVisible();
  });

  test('Blackjack filter button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /blackjack/i })).toBeVisible();
  });

  test('Roulette filter button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /roulette/i })).toBeVisible();
  });

  test('Baccarat filter button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /baccarat/i })).toBeVisible();
  });

  test('Poker filter button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /poker/i })).toBeVisible();
  });

  test('clicking Blackjack filter updates its active state', async ({ page }) => {
    const btn = page.getByRole('button', { name: /blackjack/i });
    await btn.click();
    await waitForAnimation(page, 300);
    // Active button gets gradient background style
    const style = await btn.getAttribute('style') ?? '';
    const cls   = await btn.getAttribute('class') ?? '';
    expect(style + cls).toMatch(/gradient|text-black/i);
  });

  test('at least one Join button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /join/i }).first()).toBeVisible({ timeout: 8_000 });
  });

  test('clicking Join while logged out shows sign-in alert', async ({ page }) => {
    const firstJoin = page.getByRole('button', { name: /join/i }).first();
    await expect(firstJoin).toBeVisible({ timeout: 8_000 });
    await firstJoin.click();
    await expect(
      page.locator('div').filter({ hasText: /⚠️/ }).first()
    ).toBeVisible({ timeout: 3_000 });
    await expect(
      page.locator('div').filter({ hasText: /sign in/i }).first()
    ).toContainText(/sign in/i);
  });

  test('page has no horizontal overflow', async ({ page }) => {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);
  });

});
