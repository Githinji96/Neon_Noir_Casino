import { test, expect } from '@playwright/test';
import { waitForPageReady } from './helpers/waitHelpers';

test.describe('VIP Club Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/vip');
    await waitForPageReady(page);
  });

  test('VIP CLUB heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /vip club/i })).toBeVisible();
  });

  test('page shows loyalty program subtitle', async ({ page }) => {
    await expect(
      page.locator('p').filter({ hasText: /loyalty program/i }).first()
    ).toBeVisible();
  });

  test('current level card is rendered', async ({ page }) => {
    // The level card is the first rounded-2xl container in main
    await expect(page.locator('main .rounded-2xl').first()).toBeVisible();
  });

  test('current level label shows a tier name', async ({ page }) => {
    const levelLabel = page.locator('p').filter({ hasText: /bronze|silver|gold|platinum|diamond/i }).first();
    await expect(levelLabel).toBeVisible({ timeout: 5_000 });
  });

  test('progress bar container is present', async ({ page }) => {
    // The progress bar track: h-3 rounded-full bg-white/10
    await expect(page.locator('.h-3').first()).toBeAttached();
  });

  test('"How to Earn Points" section is visible', async ({ page }) => {
    await expect(
      page.locator('h2').filter({ hasText: /how to earn points/i })
    ).toBeVisible({ timeout: 5_000 });
  });

  test('"All Tiers" section heading is visible', async ({ page }) => {
    await expect(
      page.locator('h2').filter({ hasText: /all tiers/i })
    ).toBeVisible();
  });

  test('5 tier cards are rendered (Bronze → Diamond)', async ({ page }) => {
    // Each tier card contains "Cashback:" text (from "Cashback: X%")
    const tierCards = page.locator('main .rounded-xl').filter({ hasText: /cashback:/i });
    await expect(tierCards.first()).toBeVisible({ timeout: 5_000 });
    const count = await tierCards.count();
    expect(count).toBe(5);
  });

  test('CURRENT badge appears on exactly one tier card', async ({ page }) => {
    const badge = page.locator('main span').filter({ hasText: /^CURRENT$/ });
    await expect(badge).toHaveCount(1);
  });

  test('unauthenticated users see SIGN IN prompt', async ({ page }) => {
    const signIn = page.getByRole('button', { name: /sign in/i });
    const prompt = page.locator('p').filter({ hasText: /sign in to track/i });
    const either = await signIn.isVisible().catch(() => false)
                || await prompt.isVisible().catch(() => false);
    expect(either).toBe(true);
  });

  test('page has no horizontal overflow', async ({ page }) => {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);
  });

});
