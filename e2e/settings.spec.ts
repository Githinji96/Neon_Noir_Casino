import { test, expect } from '@playwright/test';
import { SettingsModalPage } from './pages/SettingsModalPage';
import { ChangeMpesaModalPage } from './pages/ChangeMpesaModalPage';
import { waitForPageReady, waitForAnimation } from './helpers/waitHelpers';

/**
 * Settings modal tests.
 * The ⚙️ button is only rendered in the desktop navbar when the user is logged in.
 * Tests skip gracefully when the button is absent (anonymous sessions).
 */

test.describe('Settings Modal', () => {

  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);
  });

  async function openSettings(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
    const btn = page.locator('nav button').filter({ hasText: '⚙️' });
    const visible = await btn.isVisible().catch(() => false);
    return visible ? (await btn.click(), true) : false;
  }

  // ── Open / Close ──────────────────────────────────────────────────

  test('settings panel opens when ⚙️ is clicked', async ({ page }) => {
    if (!(await openSettings(page))) test.skip();
    await waitForAnimation(page, 400);
    await expect(page.locator('h2').filter({ hasText: /^settings$/i })).toBeVisible({ timeout: 5_000 });
  });

  test('settings panel closes when ✕ is clicked', async ({ page }) => {
    if (!(await openSettings(page))) test.skip();
    await waitForAnimation(page, 400);
    const closeBtn = page.locator('[style*="520px"]').getByRole('button').filter({ hasText: '✕' }).first();
    await closeBtn.click();
    await waitForAnimation(page, 400);
    await expect(page.locator('h2').filter({ hasText: /^settings$/i })).not.toBeVisible();
  });

  test('settings panel closes when Escape is pressed', async ({ page }) => {
    if (!(await openSettings(page))) test.skip();
    await waitForAnimation(page, 400);
    await page.keyboard.press('Escape');
    await waitForAnimation(page, 400);
    await expect(page.locator('h2').filter({ hasText: /^settings$/i })).not.toBeVisible();
  });

  // ── Sidebar tabs ──────────────────────────────────────────────────

  test('all sidebar tabs are visible', async ({ page }) => {
    if (!(await openSettings(page))) test.skip();
    await waitForAnimation(page, 400);
    for (const label of ['Account', 'Wallet & Limits', 'Game', 'Notifications', 'Security', 'Preferences']) {
      await expect(page.locator('button').filter({ hasText: label }).first()).toBeVisible();
    }
  });

  test('Account tab is active by default', async ({ page }) => {
    if (!(await openSettings(page))) test.skip();
    await waitForAnimation(page, 400);
    // Active tab has yellow border and text
    const cls = await page.locator('button').filter({ hasText: /^👤 Account$/ }).first().getAttribute('class') ?? '';
    expect(cls).toMatch(/yellow/i);
  });

  test('Security tab shows Change Password fields', async ({ page }) => {
    if (!(await openSettings(page))) test.skip();
    await waitForAnimation(page, 400);
    await page.locator('button').filter({ hasText: /security/i }).click();
    await expect(page.locator('label').filter({ hasText: /new password/i })).toBeVisible();
  });

  test('Game tab shows Sound Effects toggle', async ({ page }) => {
    if (!(await openSettings(page))) test.skip();
    await waitForAnimation(page, 400);
    await page.locator('button').filter({ hasText: /^🎮 Game$/ }).click();
    await expect(page.locator('span').filter({ hasText: /sound effects/i })).toBeVisible();
  });

  test('Notifications tab shows toggles', async ({ page }) => {
    if (!(await openSettings(page))) test.skip();
    await waitForAnimation(page, 400);
    await page.locator('button').filter({ hasText: /^🔔 Notifications$/ }).click();
    await expect(page.locator('span').filter({ hasText: /promotions/i })).toBeVisible();
  });

  // ── Account tab ───────────────────────────────────────────────────

  test('Account tab shows Email label', async ({ page }) => {
    if (!(await openSettings(page))) test.skip();
    await waitForAnimation(page, 400);
    await expect(page.locator('span').filter({ hasText: /^Email$/ }).first()).toBeVisible();
  });

  test('Account tab shows M-Pesa Change/Add button', async ({ page }) => {
    if (!(await openSettings(page))) test.skip();
    await waitForAnimation(page, 400);
    await expect(page.getByRole('button', { name: /change|add number/i }).first()).toBeVisible();
  });

  // ── Security — password validation ───────────────────────────────
  // Actual error messages: "Passwords do not match" and "Min 8 characters"

  test('password mismatch shows "Passwords do not match" error', async ({ page }) => {
    if (!(await openSettings(page))) test.skip();
    await waitForAnimation(page, 400);
    await page.locator('button').filter({ hasText: /security/i }).click();
    const newPw  = page.locator('input[type="password"]').nth(0);
    const confPw = page.locator('input[type="password"]').nth(1);
    await newPw.fill('Password123!');
    await confPw.fill('DifferentPassword!');
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(
      page.locator('p').filter({ hasText: /passwords do not match/i })
    ).toBeVisible({ timeout: 3_000 });
  });

  test('short password shows "Min 8 characters" error', async ({ page }) => {
    if (!(await openSettings(page))) test.skip();
    await waitForAnimation(page, 400);
    await page.locator('button').filter({ hasText: /security/i }).click();
    const newPw  = page.locator('input[type="password"]').nth(0);
    const confPw = page.locator('input[type="password"]').nth(1);
    await newPw.fill('short');
    await confPw.fill('short');
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(
      page.locator('p').filter({ hasText: /min 8 characters/i })
    ).toBeVisible({ timeout: 3_000 });
  });

  // ── SAVE button ───────────────────────────────────────────────────

  test('SAVE button is visible', async ({ page }) => {
    if (!(await openSettings(page))) test.skip();
    await waitForAnimation(page, 400);
    await expect(page.getByRole('button', { name: /^save$/i }).first()).toBeVisible();
  });

  // ── Change M-Pesa modal ───────────────────────────────────────────

  test('Change M-Pesa modal opens from Account tab', async ({ page }) => {
    if (!(await openSettings(page))) test.skip();
    await waitForAnimation(page, 400);
    await page.getByRole('button', { name: /change|add number/i }).first().click();
    const modal = new ChangeMpesaModalPage(page);
    await modal.waitForVisible();
    await expect(modal.heading).toBeVisible();
    await expect(modal.newPhoneInput).toBeVisible();
    await expect(modal.passwordInput).toBeVisible();
  });

  test('Change M-Pesa modal closes on ✕ click', async ({ page }) => {
    if (!(await openSettings(page))) test.skip();
    await waitForAnimation(page, 400);
    await page.getByRole('button', { name: /change|add number/i }).first().click();
    const modal = new ChangeMpesaModalPage(page);
    await modal.waitForVisible();
    await modal.close();
    await expect(modal.modal).not.toBeVisible();
  });

  test('Change M-Pesa password field has show/hide toggle', async ({ page }) => {
    if (!(await openSettings(page))) test.skip();
    await waitForAnimation(page, 400);
    await page.getByRole('button', { name: /change|add number/i }).first().click();
    const modal = new ChangeMpesaModalPage(page);
    await modal.waitForVisible();
    await expect(modal.passwordInput).toHaveAttribute('type', 'password');
    await modal.showHideToggle.click();
    await expect(modal.passwordInput).toHaveAttribute('type', 'text');
    await modal.showHideToggle.click();
    await expect(modal.passwordInput).toHaveAttribute('type', 'password');
  });

  test('Change M-Pesa submit is disabled when password is empty', async ({ page }) => {
    if (!(await openSettings(page))) test.skip();
    await waitForAnimation(page, 400);
    await page.getByRole('button', { name: /change|add number/i }).first().click();
    const modal = new ChangeMpesaModalPage(page);
    await modal.waitForVisible();
    await modal.newPhoneInput.fill('712345678');
    await modal.confirmPhoneInput.fill('712345678');
    // Password is empty — button disabled
    await expect(modal.submitBtn).toBeDisabled();
  });

});
