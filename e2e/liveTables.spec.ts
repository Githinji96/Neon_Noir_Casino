import { test, expect } from '@playwright/test';
import { LiveTablesPage } from './pages/LiveTablesPage';
import { waitForPageReady, waitForAnimation } from './helpers/waitHelpers';

test.describe('Live Tables Page', () => {

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

  // ── Category filter tabs ──────────────────────────────────────────

  test('"All Tables" filter button is visible', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await expect(lt.filterAll).toBeVisible();
  });

  test('Blackjack filter button is visible', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await expect(lt.filterBlackjack).toBeVisible();
  });

  test('Roulette filter button is visible', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await expect(lt.filterRoulette).toBeVisible();
  });

  test('Baccarat filter button is visible', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await expect(lt.filterBaccarat).toBeVisible();
  });

  test('Poker filter button is visible', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await expect(lt.filterPoker).toBeVisible();
  });

  test('clicking Blackjack filter updates its active state', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await lt.filterBlackjack.click();
    await waitForAnimation(page, 300);
    const style = await lt.filterBlackjack.getAttribute('style') ?? '';
    const cls   = await lt.filterBlackjack.getAttribute('class') ?? '';
    expect(style + cls).toMatch(/gradient|text-black/i);
  });

  test('at least one Join button is present', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await expect(lt.joinButtons().first()).toBeVisible({ timeout: 8_000 });
  });

  test('clicking Join while logged out shows sign-in alert', async ({ page }) => {
    const lt = new LiveTablesPage(page);
    await lt.joinButtons().first().click();
    await expect(lt.alertBanner).toBeVisible({ timeout: 3_000 });
    await expect(lt.alertBanner).toContainText(/sign in/i);
  });

  test('page has no horizontal overflow', async ({ page }) => {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);
  });

});
