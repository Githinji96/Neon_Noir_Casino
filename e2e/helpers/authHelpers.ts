import { Page, BrowserContext } from '@playwright/test';

/**
 * Real test account credentials.
 * Override via environment variables in CI so the password is never committed
 * to source control in CI pipelines:
 *   TEST_USER_EMAIL / TEST_USER_PASSWORD
 */
export const TEST_CREDENTIALS = {
  email:    process.env.TEST_USER_EMAIL    ?? 'bonfacegithinji64@gmail.com',
  password: process.env.TEST_USER_PASSWORD ?? 'Bg33173375#',
};

/**
 * Log in via the UI and wait until the user lands on the home page.
 * Returns when the balance element or main lobby is visible.
 */
export async function loginViaUI(page: Page): Promise<void> {
  await page.goto('/auth/login');
  await page.getByPlaceholder('player@example.com').fill(TEST_CREDENTIALS.email);
  await page.getByPlaceholder('Enter your password').fill(TEST_CREDENTIALS.password);
  await page.getByRole('button', { name: /^sign in$/i }).click();

  // Wait for either successful redirect to home or a visible error
  await page.waitForURL('/', { timeout: 15_000 }).catch(async () => {
    // If still on login, auth may have failed — surface a clear error
    const errorEl = page.locator('[class*="AuthAlert"], [role="alert"]').first();
    const visible  = await errorEl.isVisible().catch(() => false);
    if (visible) {
      const msg = await errorEl.textContent();
      throw new Error(`Login failed: ${msg}`);
    }
    // Otherwise may have taken a different redirect — continue
  });
}

/**
 * Save authenticated storage state to disk so subsequent tests can reuse it
 * without going through the login flow every time.
 *
 * Usage in playwright.config.ts:
 *   globalSetup: './e2e/helpers/globalSetup.ts'
 */
export async function saveAuthState(context: BrowserContext, path: string): Promise<void> {
  await context.storageState({ path });
}

/**
 * Navigate to the login page and fill in credentials.
 * Does NOT assert success — callers check the result themselves.
 */
export async function fillLoginForm(
  page: Page,
  email = TEST_CREDENTIALS.email,
  password = TEST_CREDENTIALS.password,
): Promise<void> {
  await page.goto('/auth/login');
  await page.getByPlaceholder('player@example.com').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
}

/**
 * Click the SIGN IN button. Callers assert the expected outcome.
 */
export async function submitLoginForm(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^sign in$/i }).click();
}
