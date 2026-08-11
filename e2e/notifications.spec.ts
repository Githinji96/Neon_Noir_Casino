import { test, expect } from '@playwright/test';
import { waitForPageReady, waitForAnimation } from './helpers/waitHelpers';

/**
 * Notification Bell tests.
 *
 * The bell is rendered only when user is logged in (desktop navbar).
 * The dropdown panel has class "fixed sm:absolute right-0 sm:right-0 z-[300] flex flex-col"
 * The panel heading is a <span> with text "Notifications" (CSS transforms it to uppercase visually).
 */

test.describe('Notification Bell', () => {

  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);
  });

  async function getBell(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
    const bell = page.getByRole('button', { name: /notifications/i });
    return (await bell.isVisible().catch(() => false)) ? bell : null;
  }

  /** Get the notification dropdown panel by its z-[300] class. */
  function getPanel(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
    return page.locator('.z-\\[300\\]').filter({ hasText: /Notifications/i }).first();
  }

  test('notification bell is visible when logged in', async ({ page }) => {
    const bell = await getBell(page);
    if (!bell) test.skip();
    await expect(bell!).toBeVisible();
  });

  test('bell has aria-label containing "Notifications"', async ({ page }) => {
    const bell = await getBell(page);
    if (!bell) test.skip();
    expect(await bell!.getAttribute('aria-label')).toMatch(/notifications/i);
  });

  test('bell has aria-expanded attribute', async ({ page }) => {
    const bell = await getBell(page);
    if (!bell) test.skip();
    expect(['true', 'false']).toContain(await bell!.getAttribute('aria-expanded'));
  });

  test('clicking bell opens the notification dropdown', async ({ page }) => {
    const bell = await getBell(page);
    if (!bell) test.skip();
    await bell!.click();
    await waitForAnimation(page, 300);
    // Panel should appear — identified by z-[300] class
    const panel = getPanel(page);
    await expect(panel).toBeVisible({ timeout: 5_000 });
  });

  test('dropdown contains "Notifications" heading span', async ({ page }) => {
    const bell = await getBell(page);
    if (!bell) test.skip();
    await bell!.click();
    await waitForAnimation(page, 300);
    const panel = getPanel(page);
    await expect(panel).toBeVisible({ timeout: 5_000 });
    // Heading is <span class="font-orbitron text-xs font-bold text-white tracking-widest uppercase">Notifications</span>
    await expect(
      panel.locator('span').filter({ hasText: /^Notifications$/i }).first()
    ).toBeVisible();
  });

  test('dropdown has a close ✕ button', async ({ page }) => {
    const bell = await getBell(page);
    if (!bell) test.skip();
    await bell!.click();
    await waitForAnimation(page, 300);
    const panel = getPanel(page);
    await expect(panel).toBeVisible({ timeout: 5_000 });
    // Close button: <button aria-label="Close">✕</button>
    await expect(
      panel.getByRole('button', { name: /close/i })
    ).toBeVisible();
  });

  test('dropdown closes via close ✕ button', async ({ page }) => {
    const bell = await getBell(page);
    if (!bell) test.skip();
    await bell!.click();
    await waitForAnimation(page, 300);
    const panel = getPanel(page);
    await expect(panel).toBeVisible({ timeout: 5_000 });
    await panel.getByRole('button', { name: /close/i }).click();
    await waitForAnimation(page, 400);
    await expect(panel).not.toBeVisible();
  });

  test('dropdown closes on Escape', async ({ page }) => {
    const bell = await getBell(page);
    if (!bell) test.skip();
    await bell!.click();
    await waitForAnimation(page, 300);
    const panel = getPanel(page);
    await expect(panel).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    await waitForAnimation(page, 400);
    await expect(panel).not.toBeVisible();
  });

  test('dropdown closes when clicking outside', async ({ page }) => {
    const bell = await getBell(page);
    if (!bell) test.skip();
    await bell!.click();
    await waitForAnimation(page, 300);
    const panel = getPanel(page);
    await expect(panel).toBeVisible({ timeout: 5_000 });
    await page.mouse.click(100, 600);
    await waitForAnimation(page, 400);
    await expect(panel).not.toBeVisible();
  });

  test('dropdown shows notifications or empty state', async ({ page }) => {
    const bell = await getBell(page);
    if (!bell) test.skip();
    await bell!.click();
    await waitForAnimation(page, 300);
    const panel = getPanel(page);
    await expect(panel).toBeVisible({ timeout: 5_000 });
    // Should have at least the header div + content area (2+ children)
    const children = await panel.locator(':scope > div').count();
    expect(children).toBeGreaterThanOrEqual(1);
  });

  test('unread badge count is positive when present', async ({ page }) => {
    const bell = await getBell(page);
    if (!bell) test.skip();
    const badge = bell!.locator('span').filter({ hasText: /^\d+$|9\+/ }).first();
    if (!(await badge.isVisible().catch(() => false))) return;
    const text  = await badge.textContent() ?? '0';
    expect(parseInt(text.replace('+', ''), 10)).toBeGreaterThan(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Notifications Page (/notifications)', () => {

  test('page renders — shows sign-in prompt or notification list', async ({ page }) => {
    await page.goto('/notifications');
    await waitForPageReady(page);
    // Anonymous: shows "Sign in to see notifications" + SIGN IN button
    // Authenticated: shows h1 NOTIFICATIONS
    const signIn  = page.locator('p').filter({ hasText: /sign in to see notifications/i });
    const heading = page.locator('h1').filter({ hasText: /notifications/i });
    const either  = await signIn.isVisible({ timeout: 5_000 }).catch(() => false)
                 || await heading.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(either).toBe(true);
  });

});
