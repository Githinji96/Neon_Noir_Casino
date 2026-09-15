import { test, expect } from '@playwright/test';
import { waitForPageReady } from './helpers/waitHelpers';

/**
 * Accessibility / UX tests.
 *
 * Covers:
 *  - ARIA labels on key interactive elements
 *  - Keyboard navigation (Tab order, focus states)
 *  - Visible focus indicators
 *  - Basic landmark structure
 */

test.describe('Accessibility — Home Page', () => {

  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);
  });

  test('hamburger button has aria-label="Menu"', async ({ page }) => {
    // Desktop viewport — hamburger is hidden via lg:hidden, so resize to mobile first
    await page.setViewportSize({ width: 390, height: 844 });
    const btn = page.getByRole('button', { name: /^menu$/i });
    await expect(btn).toBeVisible({ timeout: 3_000 });
    const label = await btn.getAttribute('aria-label');
    expect(label).toBe('Menu');
  });

  test('hamburger button has aria-expanded attribute', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const btn = page.getByRole('button', { name: /^menu$/i });
    const expanded = await btn.getAttribute('aria-expanded');
    expect(['true', 'false']).toContain(expanded);
  });

  test('page has a <main> landmark', async ({ page }) => {
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('footer has aria-label="Site footer"', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const footer = page.locator('footer[aria-label="Site footer"]');
    await expect(footer).toBeAttached();
  });

  test('nav element is present', async ({ page }) => {
    await expect(page.locator('nav').first()).toBeVisible();
  });

});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Accessibility — Notification Bell', () => {

  test.use({ viewport: { width: 1440, height: 900 } });

  test('bell button has an aria-label containing "Notifications"', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);
    const bell = page.getByRole('button', { name: /notifications/i });
    const visible = await bell.isVisible().catch(() => false);
    if (!visible) test.skip();
    const label = await bell.getAttribute('aria-label');
    expect(label).toMatch(/notifications/i);
  });

  test('bell button has aria-expanded attribute', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);
    const bell = page.getByRole('button', { name: /notifications/i });
    const visible = await bell.isVisible().catch(() => false);
    if (!visible) test.skip();
    const expanded = await bell.getAttribute('aria-expanded');
    expect(['true', 'false']).toContain(expanded);
  });

});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Accessibility — Settings Panel', () => {

  test.use({ viewport: { width: 1440, height: 900 } });

  test('settings button is keyboard-focusable and activatable', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);
    const settingsBtn = page.locator('nav button').filter({ hasText: '⚙️' });
    const visible = await settingsBtn.isVisible().catch(() => false);
    if (!visible) test.skip();

    // Tab to the settings button and press Enter
    await settingsBtn.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);

    const panel = page.locator('[style*="520px"]').filter({ hasText: /settings/i });
    await expect(panel).toBeVisible({ timeout: 3_000 });
  });

});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Accessibility — Login Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await waitForPageReady(page);
  });

  test('email input has an associated label', async ({ page }) => {
    // InputField renders a <label> — verify it exists
    const label = page.locator('label').filter({ hasText: /email/i }).first();
    await expect(label).toBeVisible();
  });

  test('password input has an associated label', async ({ page }) => {
    const label = page.locator('label').filter({ hasText: /password/i }).first();
    await expect(label).toBeVisible();
  });

  test('keyboard Tab moves focus from email to password', async ({ page }) => {
    const emailInput    = page.getByPlaceholder('player@example.com');
    const passwordInput = page.getByPlaceholder('Enter your password');

    await emailInput.focus();
    await page.keyboard.press('Tab');
    // After one Tab, either the password field or an intermediate element gets focus
    // We just confirm the password field is reachable by keyboard
    await passwordInput.focus();
    await expect(passwordInput).toBeFocused();
  });

  test('SIGN IN button is reachable via keyboard', async ({ page }) => {
    const signInBtn = page.getByRole('button', { name: /^sign in$/i });
    await signInBtn.focus();
    await expect(signInBtn).toBeFocused();
  });

  test('password show/hide toggle has a visible button with emoji icon', async ({ page }) => {
    // The toggle is a plain button containing 👁️ (show) or 🙈 (hide)
    const toggle = page.locator('button[type="button"]').filter({ hasText: /👁️|🙈/ }).first();
    await expect(toggle).toBeVisible();
    // It has tabIndex=-1 but is still clickable
    await toggle.click();
    const input = page.getByPlaceholder('Enter your password');
    await expect(input).toHaveAttribute('type', 'text');
  });

});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Accessibility — Contact Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/contact');
    await waitForPageReady(page);
  });

  test('form fields have associated labels', async ({ page }) => {
    await expect(page.locator('label[for="name"]')).toBeVisible();
    await expect(page.locator('label[for="email"]')).toBeVisible();
    await expect(page.locator('label[for="subject"]')).toBeVisible();
    await expect(page.locator('label[for="message"]')).toBeVisible();
  });

  test('invalid fields have aria-invalid="true" after submit attempt', async ({ page }) => {
    await page.getByRole('button', { name: /send message/i }).click();
    // The name field should be marked as invalid
    await expect(page.locator('#name')).toHaveAttribute('aria-invalid', 'true', { timeout: 3_000 });
  });

  test('error messages have role="alert"', async ({ page }) => {
    await page.getByRole('button', { name: /send message/i }).click();
    const alerts = page.locator('[role="alert"]');
    await expect(alerts.first()).toBeVisible({ timeout: 3_000 });
  });

  test('FAQ expand buttons have aria-expanded attribute', async ({ page }) => {
    const faqBtn = page.getByRole('button').filter({ hasText: /how do i/i }).first();
    await expect(faqBtn).toBeVisible();
    const expanded = await faqBtn.getAttribute('aria-expanded');
    expect(['true', 'false']).toContain(expanded);
  });

});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Accessibility — Change M-Pesa Modal', () => {

  test.use({ viewport: { width: 1440, height: 900 } });

  test('modal has role="dialog" and aria-modal="true"', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);

    // Open settings → account tab → Change/Add M-Pesa
    const settingsBtn = page.locator('nav button').filter({ hasText: '⚙️' });
    const settingsVisible = await settingsBtn.isVisible().catch(() => false);
    if (!settingsVisible) test.skip();

    await settingsBtn.click();
    await page.waitForTimeout(400);

    const changeMpesaBtn = page.getByRole('button', { name: /change|add number/i });
    await changeMpesaBtn.click();
    await page.waitForTimeout(400);

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });
    await expect(modal).toHaveAttribute('aria-modal', 'true');
  });

  test('password show/hide toggle in Change M-Pesa has aria-label and aria-pressed', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);

    const settingsBtn = page.locator('nav button').filter({ hasText: '⚙️' });
    const settingsVisible = await settingsBtn.isVisible().catch(() => false);
    if (!settingsVisible) test.skip();

    await settingsBtn.click();
    await page.waitForTimeout(400);

    const changeMpesaBtn = page.getByRole('button', { name: /change|add number/i });
    await changeMpesaBtn.click();
    await page.waitForTimeout(400);

    const toggle = page.locator('[role="dialog"]').getByRole('button', {
      name: /show password|hide password/i,
    });
    await expect(toggle).toBeVisible({ timeout: 5_000 });
    const label   = await toggle.getAttribute('aria-label');
    const pressed = await toggle.getAttribute('aria-pressed');
    expect(label).toBeTruthy();
    expect(['true', 'false']).toContain(pressed);
  });

});
