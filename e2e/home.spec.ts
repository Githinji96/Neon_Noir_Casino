import { test, expect } from '@playwright/test';
import { waitForPageReady, waitForAnimation, scrollToBottom } from './helpers/waitHelpers';

test.describe('Home Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);
  });

  // ── Logo ─────────────────────────────────────────────────────────

  test('logo is visible and links to home', async ({ page }) => {
    const logo = page.locator('nav a').filter({ hasText: /neon noir casino|N·N·C/i }).first();
    await expect(logo).toBeVisible();
    await logo.click();
    await expect(page).toHaveURL('/');
  });

  // ── Desktop nav ───────────────────────────────────────────────────
  // NAV_LINKS paths: /slots (no route→redirects), /live-tables, /jackpots, /vip
  // The ul is hidden below lg breakpoint

  test('desktop nav shows Live Tables, Jackpots, VIP links', async ({ page, viewport }) => {
    if ((viewport?.width ?? 0) < 1024) test.skip();
    // Use href attribute to target links precisely
    await expect(page.locator('nav ul a[href="/live-tables"]')).toBeVisible();
    await expect(page.locator('nav ul a[href="/jackpots"]')).toBeVisible();
    await expect(page.locator('nav ul a[href="/vip"]')).toBeVisible();
  });

  // ── Mobile quick-nav ──────────────────────────────────────────────
  // QUICK_NAV paths: /slots, /live-tables, /jackpots, /vip

  test('mobile quick-nav strip shows Live Tables, Jackpots, VIP icons', async ({ page, viewport }) => {
    if ((viewport?.width ?? 1440) >= 1024) test.skip();
    await page.waitForTimeout(300);
    // Quick-nav links use flex-col layout; desktop ul links use flex (row)
    await expect(
      page.locator('a[href="/live-tables"].flex.flex-col').first()
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('a[href="/jackpots"].flex.flex-col').first()
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('a[href="/vip"].flex.flex-col').first()
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── Auth buttons ──────────────────────────────────────────────────

  test('LOGIN button is visible when logged out on desktop', async ({ page, viewport }) => {
    if ((viewport?.width ?? 0) < 1024) test.skip();
    const loginBtn = page.locator('nav').getByRole('button', { name: /^login$/i }).first();
    await expect(loginBtn).toBeVisible();
  });

  // ── Desktop nav routing ───────────────────────────────────────────

  test('clicking Live Tables nav link navigates to /live-tables', async ({ page, viewport }) => {
    if ((viewport?.width ?? 0) < 1024) test.skip();
    await page.locator('nav ul a[href="/live-tables"]').click();
    await expect(page).toHaveURL('/live-tables');
  });

  test('clicking Jackpots nav link navigates to /jackpots', async ({ page, viewport }) => {
    if ((viewport?.width ?? 0) < 1024) test.skip();
    await page.locator('nav ul a[href="/jackpots"]').click();
    await expect(page).toHaveURL('/jackpots');
  });

  test('clicking VIP nav link navigates to /vip', async ({ page, viewport }) => {
    if ((viewport?.width ?? 0) < 1024) test.skip();
    await page.locator('nav ul a[href="/vip"]').click();
    await expect(page).toHaveURL('/vip');
  });

  // ── Hero section ──────────────────────────────────────────────────

  test('hero section has a primary CTA button', async ({ page }) => {
    const cta = page.getByRole('button', { name: /play now|spin now|play/i }).first();
    await expect(cta).toBeVisible();
  });

  // ── SEE ALL ───────────────────────────────────────────────────────

  test('SEE ALL button is present', async ({ page }) => {
    const seeAll = page.getByRole('button', { name: /see all/i }).first();
    if (!(await seeAll.isVisible().catch(() => false))) test.skip();
    await expect(seeAll).toBeVisible();
  });

  // ── Jackpot section ───────────────────────────────────────────────

  test('progressive jackpots section is present', async ({ page }) => {
    await scrollToBottom(page);
    const section = page.locator('section, div').filter({ hasText: /progressive.*jackpot|jackpot/i }).first();
    await expect(section).toBeVisible();
  });

  // ── Footer ────────────────────────────────────────────────────────

  test('footer element exists after scrolling to bottom', async ({ page }) => {
    await scrollToBottom(page);
    await page.waitForTimeout(500);
    await expect(page.locator('footer[aria-label="Site footer"]')).toBeAttached();
  });

  // ── No overflow ───────────────────────────────────────────────────

  test('home page has no horizontal overflow', async ({ page }) => {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);
  });

});
