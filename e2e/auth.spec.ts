import { test, expect } from '@playwright/test';
import { LoginPage as LoginPageObject } from './pages/LoginPage';
import { TEST_CREDENTIALS, fillLoginForm, submitLoginForm } from './helpers/authHelpers';
import { waitForPageReady } from './helpers/waitHelpers';

test.describe('Authentication — Login Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await waitForPageReady(page);
  });

  test('"Welcome Back" heading is visible', async ({ page }) => {
    const login = new LoginPageObject(page);
    await expect(login.heading).toBeVisible();
  });

  test('email input is present', async ({ page }) => {
    const login = new LoginPageObject(page);
    await expect(login.emailInput).toBeVisible();
  });

  test('password input defaults to type="password"', async ({ page }) => {
    const login = new LoginPageObject(page);
    await expect(login.passwordInput).toBeVisible();
    await expect(login.passwordInput).toHaveAttribute('type', 'password');
  });

  test('password show/hide toggle changes field type', async ({ page }) => {
    // PasswordField renders the toggle inside InputField's rightElement prop.
    // The toggle is a <button type="button" tabIndex="-1"> inside
    // <span class="absolute right-3 top-1/2 -translate-y-1/2">
    // It has no aria-label — locate it by its position relative to the password input.
    const login = new LoginPageObject(page);
    await expect(login.passwordInput).toHaveAttribute('type', 'password');

    // The password field wrapper div — toggle is the span.absolute inside it
    const toggle = page
      .locator('div.relative')
      .filter({ has: login.passwordInput })
      .locator('span.absolute.right-3')
      .locator('button[type="button"]');

    await expect(toggle).toBeAttached({ timeout: 5_000 });
    await toggle.click({ force: true }); // tabIndex=-1 needs force
    await expect(login.passwordInput).toHaveAttribute('type', 'text');
    await toggle.click({ force: true });
    await expect(login.passwordInput).toHaveAttribute('type', 'password');
  });

  test('"Remember me" checkbox is present', async ({ page }) => {
    const login = new LoginPageObject(page);
    await expect(login.rememberMe).toBeVisible();
  });

  test('"Forgot Password?" link navigates to /auth/forgot-password', async ({ page }) => {
    const login = new LoginPageObject(page);
    await login.forgotPwLink.click();
    await expect(page).toHaveURL('/auth/forgot-password');
  });

  test('SIGN IN button is visible and enabled', async ({ page }) => {
    const login = new LoginPageObject(page);
    await expect(login.signInBtn).toBeVisible();
    await expect(login.signInBtn).toBeEnabled();
  });

  test('Google and Apple OAuth buttons are visible', async ({ page }) => {
    const login = new LoginPageObject(page);
    await expect(login.googleBtn).toBeVisible();
    await expect(login.appleBtn).toBeVisible();
  });

  test('"Sign Up" link navigates to /auth/signup', async ({ page }) => {
    const login = new LoginPageObject(page);
    await login.signUpLink.click();
    await expect(page).toHaveURL('/auth/signup');
  });

  test('submitting empty form stays on login page', async ({ page }) => {
    const login = new LoginPageObject(page);
    await login.signInBtn.click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain('/auth/login');
  });

  test('wrong credentials show error message', async ({ page }) => {
    const login = new LoginPageObject(page);
    await login.emailInput.fill('nobody@fake.casino');
    await login.passwordInput.fill('WrongPassword!');
    await login.signInBtn.click();
    const error = page.locator('[class*="AuthAlert"], [role="alert"], .text-red-400').first();
    await expect(error).toBeVisible({ timeout: 12_000 });
  });

  test('correct credentials log in and redirect to home', async ({ page }) => {
    await fillLoginForm(page);
    await submitLoginForm(page);
    await page.waitForURL('/', { timeout: 20_000 });
    await expect(page).toHaveURL('/');
  });

  test('after login the balance is visible in the navbar', async ({ page }) => {
    await fillLoginForm(page);
    await submitLoginForm(page);
    await page.waitForURL('/', { timeout: 20_000 });
    const balance = page.locator('nav span').filter({ hasText: /KES/i }).first();
    await expect(balance).toBeVisible({ timeout: 8_000 });
  });

  test('after login the notification bell is visible on desktop', async ({ page, viewport }) => {
    if ((viewport?.width ?? 1440) < 1024) test.skip();
    await fillLoginForm(page);
    await submitLoginForm(page);
    await page.waitForURL('/', { timeout: 20_000 });
    const bell = page.getByRole('button', { name: /notifications/i });
    await expect(bell).toBeVisible({ timeout: 8_000 });
  });

  test('login page has no horizontal overflow', async ({ page }) => {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);
  });

});

test.describe('Authentication — Sign Up Page', () => {
  test('page loads with email input', async ({ page }) => {
    await page.goto('/auth/signup');
    await waitForPageReady(page);
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Authentication — Forgot Password Page', () => {
  test('page loads with email input', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await waitForPageReady(page);
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 8_000 });
  });
});
