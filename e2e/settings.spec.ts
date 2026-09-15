import { test, expect } from '@playwright/test';
import { SettingsModalPage } from './pages/SettingsModalPage';
import { ChangeMpesaModalPage } from './pages/ChangeMpesaModalPage';
import { waitForPageReady, waitForAnimation } from './helpers/waitHelpers';

/**
 * Settings modal tests.
 * Uses SettingsModalPage and ChangeMpesaModalPage POMs.
 * Tests skip gracefully when the ⚙️ button is absent (anonymous sessions).
 */

test.describe('Settings Modal', () => {

  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);
  });

  // ── Open / Close ───────────────────────────────────────────────────

  test('settings panel opens when ⚙️ is clicked', async ({ page }) => {
    const s = new SettingsModalPage(page);
    const visible = await page.locator('nav button').filter({ hasText: '⚙️' }).isVisible().catch(() => false);
    if (!visible) test.skip();
    await s.open();
    await expect(s.heading).toBeVisible({ timeout: 5_000 });
  });

  test('settings panel closes when ✕ is clicked', async ({ page }) => {
    const s = new SettingsModalPage(page);
    const visible = await page.locator('nav button').filter({ hasText: '⚙️' }).isVisible().catch(() => false);
    if (!visible) test.skip();
    await s.open();
    await s.close();
    await expect(s.heading).not.toBeVisible();
  });

  test('settings panel closes when Escape is pressed', async ({ page }) => {
    const s = new SettingsModalPage(page);
    const visible = await page.locator('nav button').filter({ hasText: '⚙️' }).isVisible().catch(() => false);
    if (!visible) test.skip();
    await s.open();
    await page.keyboard.press('Escape');
    await waitForAnimation(page, 400);
    await expect(s.heading).not.toBeVisible();
  });

  // ── Sidebar tabs ───────────────────────────────────────────────────

  test('all sidebar tabs are visible', async ({ page }) => {
    const s = new SettingsModalPage(page);
    const visible = await page.locator('nav button').filter({ hasText: '⚙️' }).isVisible().catch(() => false);
    if (!visible) test.skip();
    await s.open();
    for (const tab of [s.tabAccount, s.tabSecurity, s.tabGame, s.tabNotifications, s.tabPreferences]) {
      await expect(tab.first()).toBeVisible();
    }
  });

  test('Account tab is active by default', async ({ page }) => {
    const s = new SettingsModalPage(page);
    const visible = await page.locator('nav button').filter({ hasText: '⚙️' }).isVisible().catch(() => false);
    if (!visible) test.skip();
    await s.open();
    const cls = await s.tabAccount.first().getAttribute('class') ?? '';
    expect(cls).toMatch(/yellow/i);
  });

  test('Security tab shows Change Password fields', async ({ page }) => {
    const s = new SettingsModalPage(page);
    const visible = await page.locator('nav button').filter({ hasText: '⚙️' }).isVisible().catch(() => false);
    if (!visible) test.skip();
    await s.open();
    await s.goToTab('security');
    await expect(s.newPasswordInput).toBeVisible();
  });

  test('Game tab shows Sound Effects toggle', async ({ page }) => {
    const s = new SettingsModalPage(page);
    const visible = await page.locator('nav button').filter({ hasText: '⚙️' }).isVisible().catch(() => false);
    if (!visible) test.skip();
    await s.open();
    await s.goToTab('game');
    await expect(page.locator('span').filter({ hasText: /sound effects/i })).toBeVisible();
  });

  test('Notifications tab shows toggles', async ({ page }) => {
    const s = new SettingsModalPage(page);
    const visible = await page.locator('nav button').filter({ hasText: '⚙️' }).isVisible().catch(() => false);
    if (!visible) test.skip();
    await s.open();
    await s.goToTab('notifications');
    await expect(page.locator('span').filter({ hasText: /promotions/i })).toBeVisible();
  });

  // ── Account tab ────────────────────────────────────────────────────

  test('Account tab shows Email label', async ({ page }) => {
    const s = new SettingsModalPage(page);
    const visible = await page.locator('nav button').filter({ hasText: '⚙️' }).isVisible().catch(() => false);
    if (!visible) test.skip();
    await s.open();
    await expect(page.locator('span').filter({ hasText: /^Email$/ }).first()).toBeVisible();
  });

  test('Account tab shows M-Pesa Change/Add button', async ({ page }) => {
    const s = new SettingsModalPage(page);
    const visible = await page.locator('nav button').filter({ hasText: '⚙️' }).isVisible().catch(() => false);
    if (!visible) test.skip();
    await s.open();
    await expect(s.changeMpesaBtn.first()).toBeVisible();
  });

  // ── Security — password validation ─────────────────────────────────

  test('password mismatch shows "Passwords do not match" error', async ({ page }) => {
    const s = new SettingsModalPage(page);
    const visible = await page.locator('nav button').filter({ hasText: '⚙️' }).isVisible().catch(() => false);
    if (!visible) test.skip();
    await s.open();
    await s.goToTab('security');
    await s.newPasswordInput.fill('Password123!');
    await s.confirmPasswordInput.fill('DifferentPassword!');
    await s.updatePasswordBtn.click();
    await expect(page.locator('p').filter({ hasText: /passwords do not match/i })).toBeVisible({ timeout: 3_000 });
  });

  test('short password shows "Min 8 characters" error', async ({ page }) => {
    const s = new SettingsModalPage(page);
    const visible = await page.locator('nav button').filter({ hasText: '⚙️' }).isVisible().catch(() => false);
    if (!visible) test.skip();
    await s.open();
    await s.goToTab('security');
    await s.newPasswordInput.fill('short');
    await s.confirmPasswordInput.fill('short');
    await s.updatePasswordBtn.click();
    await expect(page.locator('p').filter({ hasText: /min 8 characters/i })).toBeVisible({ timeout: 3_000 });
  });

  // ── SAVE button ────────────────────────────────────────────────────

  test('SAVE button is visible', async ({ page }) => {
    const s = new SettingsModalPage(page);
    const visible = await page.locator('nav button').filter({ hasText: '⚙️' }).isVisible().catch(() => false);
    if (!visible) test.skip();
    await s.open();
    await expect(s.saveBtn.first()).toBeVisible();
  });

  // ── Change M-Pesa modal ────────────────────────────────────────────

  test('Change M-Pesa modal opens from Account tab', async ({ page }) => {
    const s = new SettingsModalPage(page);
    const visible = await page.locator('nav button').filter({ hasText: '⚙️' }).isVisible().catch(() => false);
    if (!visible) test.skip();
    await s.open();
    await s.changeMpesaBtn.first().click();
    const modal = new ChangeMpesaModalPage(page);
    await modal.waitForVisible();
    await expect(modal.heading).toBeVisible();
    await expect(modal.newPhoneInput).toBeVisible();
    await expect(modal.passwordInput).toBeVisible();
  });

  test('Change M-Pesa modal closes on ✕ click', async ({ page }) => {
    const s = new SettingsModalPage(page);
    const visible = await page.locator('nav button').filter({ hasText: '⚙️' }).isVisible().catch(() => false);
    if (!visible) test.skip();
    await s.open();
    await s.changeMpesaBtn.first().click();
    const modal = new ChangeMpesaModalPage(page);
    await modal.waitForVisible();
    await modal.close();
    await expect(modal.modal).not.toBeVisible();
  });

  test('Change M-Pesa password field has show/hide toggle', async ({ page }) => {
    const s = new SettingsModalPage(page);
    const visible = await page.locator('nav button').filter({ hasText: '⚙️' }).isVisible().catch(() => false);
    if (!visible) test.skip();
    await s.open();
    await s.changeMpesaBtn.first().click();
    const modal = new ChangeMpesaModalPage(page);
    await modal.waitForVisible();
    await expect(modal.passwordInput).toHaveAttribute('type', 'password');
    await modal.showHideToggle.click();
    await expect(modal.passwordInput).toHaveAttribute('type', 'text');
    await modal.showHideToggle.click();
    await expect(modal.passwordInput).toHaveAttribute('type', 'password');
  });

  test('Change M-Pesa submit is disabled when password is empty', async ({ page }) => {
    const s = new SettingsModalPage(page);
    const visible = await page.locator('nav button').filter({ hasText: '⚙️' }).isVisible().catch(() => false);
    if (!visible) test.skip();
    await s.open();
    await s.changeMpesaBtn.first().click();
    const modal = new ChangeMpesaModalPage(page);
    await modal.waitForVisible();
    await modal.newPhoneInput.fill('712345678');
    await modal.confirmPhoneInput.fill('712345678');
    await expect(modal.submitBtn).toBeDisabled();
  });

});
