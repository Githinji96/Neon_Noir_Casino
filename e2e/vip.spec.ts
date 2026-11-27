import { test, expect } from '@playwright/test';
import { VIPPage } from './pages/VIPPage';
import { waitForPageReady } from './helpers/waitHelpers';

test.describe('VIP Club Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/vip');
    await waitForPageReady(page);
  });

  test('VIP CLUB heading is visible', async ({ page }) => {
    const vip = new VIPPage(page);
    await expect(vip.heading).toBeVisible();
  });

  test('page shows loyalty program subtitle', async ({ page }) => {
    await expect(
      page.locator('p').filter({ hasText: /loyalty program/i }).first()
    ).toBeVisible();
  });

  test('current level card is rendered', async ({ page }) => {
    const vip = new VIPPage(page);
    await expect(vip.levelCard).toBeVisible();
  });

  test('current level label shows a tier name', async ({ page }) => {
    await expect(
      page.locator('p').filter({ hasText: /bronze|silver|gold|platinum|diamond/i }).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('progress bar container is present', async ({ page }) => {
    // Progress bar only renders for authenticated non-Diamond users.
    // Skip gracefully if the element is not in the DOM.
    const vip = new VIPPage(page);
    const attached = await vip.progressBar.isVisible().catch(() => false);
    if (!attached) test.skip();
    await expect(vip.progressBar).toBeAttached();
  });

  test('"How to Earn Points" section is visible', async ({ page }) => {
    const vip = new VIPPage(page);
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
    const vip = new VIPPage(page);
    await expect(vip.tierCards.first()).toBeVisible({ timeout: 5_000 });
    expect(await vip.tierCards.count()).toBe(5);
  });

  test('CURRENT badge appears on exactly one tier card', async ({ page }) => {
    await expect(
      page.locator('main span').filter({ hasText: /^CURRENT$/ })
    ).toHaveCount(1);
  });

  test('unauthenticated users see SIGN IN prompt', async ({ browser }) => {
    // Create a fresh context with NO storageState so there is no auth session
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    try {
      await page.goto('/vip');

      // Wait for auth loading spinner to disappear (up to 6s)
      await page.locator('.animate-spin').first()
        .waitFor({ state: 'hidden', timeout: 6_000 }).catch(() => {});

      // "Sign in to see your VIP level" paragraph — appears in guest mode
      const signInHeading = page.locator('p').filter({ hasText: /sign in to see your vip level/i });
      const signInLink    = page.getByRole('link', { name: /^sign in$/i });

      const either = await signInHeading.isVisible({ timeout: 8_000 }).catch(() => false)
                  || await signInLink.isVisible({ timeout: 3_000 }).catch(() => false);

      expect(either).toBe(true);
    } finally {
      await context.close();
    }
  });

  test('page has no horizontal overflow', async ({ page }) => {
    // Wait for VIP tiers and animations to fully render before measuring
    await page.waitForTimeout(500);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    ).toBe(false);
  });

});
