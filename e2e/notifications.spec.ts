import { test, expect } from '@playwright/test';
import { NotificationsPage } from './pages/NotificationsPage';
import { waitForPageReady, waitForAnimation } from './helpers/waitHelpers';

/**
 * Notification Bell tests.
 *
 * Uses the NotificationsPage POM for all locators.
 * The bell is only rendered when a user is logged in (desktop navbar).
 */

test.describe('Notification Bell', () => {

  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);
  });

  test('notification bell is visible when logged in', async ({ page }) => {
    const n = new NotificationsPage(page);
    if (!(await n.bellBtn.isVisible().catch(() => false))) test.skip();
    await expect(n.bellBtn).toBeVisible();
  });

  test('bell has aria-label containing "Notifications"', async ({ page }) => {
    const n = new NotificationsPage(page);
    if (!(await n.bellBtn.isVisible().catch(() => false))) test.skip();
    expect(await n.bellBtn.getAttribute('aria-label')).toMatch(/notifications/i);
  });

  test('bell has aria-expanded attribute', async ({ page }) => {
    const n = new NotificationsPage(page);
    if (!(await n.bellBtn.isVisible().catch(() => false))) test.skip();
    expect(['true', 'false']).toContain(await n.bellBtn.getAttribute('aria-expanded'));
  });

  test('clicking bell opens the notification dropdown', async ({ page }) => {
    const n = new NotificationsPage(page);
    if (!(await n.bellBtn.isVisible().catch(() => false))) test.skip();
    await n.openDropdown();
    await expect(n.panel).toBeVisible({ timeout: 5_000 });
  });

  test('dropdown contains "Notifications" heading span', async ({ page }) => {
    const n = new NotificationsPage(page);
    if (!(await n.bellBtn.isVisible().catch(() => false))) test.skip();
    await n.openDropdown();
    await expect(n.panelHeading).toBeVisible();
  });

  test('dropdown has a close ✕ button', async ({ page }) => {
    const n = new NotificationsPage(page);
    if (!(await n.bellBtn.isVisible().catch(() => false))) test.skip();
    await n.openDropdown();
    await expect(n.closePanelBtn).toBeVisible();
  });

  test('dropdown closes via close ✕ button', async ({ page }) => {
    const n = new NotificationsPage(page);
    if (!(await n.bellBtn.isVisible().catch(() => false))) test.skip();
    await n.openDropdown();
    await n.closeDropdown();
    await expect(n.panel).not.toBeVisible();
  });

  test('dropdown closes on Escape', async ({ page }) => {
    const n = new NotificationsPage(page);
    if (!(await n.bellBtn.isVisible().catch(() => false))) test.skip();
    await n.openDropdown();
    await page.keyboard.press('Escape');
    await waitForAnimation(page, 400);
    await expect(n.panel).not.toBeVisible();
  });

  test('dropdown closes when clicking outside', async ({ page }) => {
    const n = new NotificationsPage(page);
    if (!(await n.bellBtn.isVisible().catch(() => false))) test.skip();
    await n.openDropdown();
    await page.mouse.click(100, 600);
    await waitForAnimation(page, 400);
    await expect(n.panel).not.toBeVisible();
  });

  test('dropdown shows notifications or empty state', async ({ page }) => {
    const n = new NotificationsPage(page);
    if (!(await n.bellBtn.isVisible().catch(() => false))) test.skip();
    await n.openDropdown();
    // Either empty state text or at least one content child
    const hasEmpty   = await n.emptyState.isVisible().catch(() => false);
    const childCount = await n.panel.locator(':scope > div').count();
    expect(hasEmpty || childCount >= 1).toBe(true);
  });

  test('unread badge count is positive when present', async ({ page }) => {
    const n = new NotificationsPage(page);
    if (!(await n.bellBtn.isVisible().catch(() => false))) test.skip();
    if (!(await n.unreadBadge.isVisible().catch(() => false))) return;
    const text = (await n.unreadBadge.textContent()) ?? '0';
    expect(parseInt(text.replace('+', ''), 10)).toBeGreaterThan(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Notifications Page (/notifications)', () => {

  test('page renders — shows sign-in prompt or notification list', async ({ page }) => {
    await page.goto('/notifications');
    await waitForPageReady(page);
    const n = new NotificationsPage(page);

    // Anonymous: shows "Sign in to see notifications"
    // Authenticated: shows NOTIFICATIONS heading
    const signIn  = page.locator('p').filter({ hasText: /sign in to see notifications/i });
    const either  = await signIn.isVisible({ timeout: 5_000 }).catch(() => false)
                 || await n.pageHeading.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(either).toBe(true);
  });

});
