import { test, expect, type Page } from '@playwright/test';
import { VIEWPORTS, ViewportName } from './helpers/viewports';
import { waitForPageReady, waitForAnimation } from './helpers/waitHelpers';

async function checkNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2,
  );
  expect(overflow, 'Page should not have horizontal overflow').toBe(false);
}

const OVERFLOW_PAGES = [
  { name: 'Home',    url: '/' },
  { name: 'VIP',     url: '/vip' },
  { name: 'Contact', url: '/contact' },
  { name: 'Login',   url: '/auth/login' },
];

for (const vp of Object.entries(VIEWPORTS) as [ViewportName, { width: number; height: number }][]) {
  const [vpName, vpSize] = vp;

  test.describe(`Responsiveness — ${vpName} (${vpSize.width}×${vpSize.height})`, () => {

    // Set the viewport before each test in this describe block.
    // setViewportSize BEFORE goto ensures Tailwind breakpoints are
    // evaluated correctly on first paint.
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(vpSize);
    });

    for (const { name, url } of OVERFLOW_PAGES) {
      test(`${name} page has no horizontal overflow at ${vpName}`, async ({ page }) => {
        await page.goto(url);
        await waitForPageReady(page);
        await checkNoHorizontalOverflow(page);
      });
    }

    test(`Jackpots page has no horizontal overflow at ${vpName}`, async ({ page }) => {
      await page.goto('/jackpots');
      await waitForPageReady(page);
      await page.waitForTimeout(800);
      await checkNoHorizontalOverflow(page);
    });

    test(`Navbar is visible at ${vpName}`, async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);
      await expect(page.locator('nav').first()).toBeVisible();
    });

    // ── Mobile/tablet (< 1024px) ──────────────────────────────────
    if (vpSize.width < 1024) {

      test(`Hamburger button is visible at ${vpName}`, async ({ page }) => {
        await page.goto('/');
        await waitForPageReady(page);
        await expect(page.getByRole('button', { name: /^menu$/i })).toBeVisible();
      });

      test(`Mobile quick-nav strip has /live-tables and /jackpots links at ${vpName}`, async ({ page }) => {
        await page.goto('/');
        await waitForPageReady(page);
        await page.waitForTimeout(300);
        // Quick-nav links have flex-col layout (distinguishes from desktop ul links)
        await expect(
          page.locator('a[href="/live-tables"].flex.flex-col').first()
        ).toBeVisible({ timeout: 5_000 });
        await expect(
          page.locator('a[href="/jackpots"].flex.flex-col').first()
        ).toBeVisible({ timeout: 5_000 });
      });

      test(`Hamburger opens mobile drawer at ${vpName}`, async ({ page }) => {
        await page.goto('/');
        await waitForPageReady(page);
        await page.getByRole('button', { name: /^menu$/i }).click();
        await waitForAnimation(page, 400);
        const drawer = page.locator('.fixed.top-0.right-0').filter({ hasText: 'Neon Noir Casino' });
        await expect(drawer).toBeVisible({ timeout: 3_000 });
      });
    }

    // ── Desktop (≥ 1024px) ────────────────────────────────────────
    if (vpSize.width >= 1024) {

      test(`Desktop nav links are visible at ${vpName}`, async ({ page }) => {
        await page.goto('/');
        await waitForPageReady(page);
        await expect(page.locator('nav ul a[href="/live-tables"]')).toBeVisible();
        await expect(page.locator('nav ul a[href="/jackpots"]')).toBeVisible();
      });

      test(`Hamburger is hidden at ${vpName}`, async ({ page }) => {
        await page.goto('/');
        await waitForPageReady(page);
        const hamburger = page.getByRole('button', { name: /^menu$/i });
        expect(await hamburger.isVisible().catch(() => false)).toBe(false);
      });
    }

  });
}

// ── Mobile-specific layout checks ─────────────────────────────────────────────

test.describe('Mobile layout specifics', () => {

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
  });

  test('Live Tables page has no horizontal overflow on mobile', async ({ page }) => {
    await page.goto('/live-tables');
    await waitForPageReady(page);
    await page.waitForTimeout(400);
    await checkNoHorizontalOverflow(page);
  });

  test('Jackpots page has no horizontal overflow on mobile', async ({ page }) => {
    await page.goto('/jackpots');
    await waitForPageReady(page);
    await page.waitForTimeout(800);
    await checkNoHorizontalOverflow(page);
  });

  test('VIP page has no horizontal overflow on mobile', async ({ page }) => {
    await page.goto('/vip');
    await waitForPageReady(page);
    await checkNoHorizontalOverflow(page);
  });

  test('Login page has no horizontal overflow on mobile', async ({ page }) => {
    await page.goto('/auth/login');
    await waitForPageReady(page);
    await checkNoHorizontalOverflow(page);
  });

});
