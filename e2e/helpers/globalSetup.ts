import { chromium, FullConfig } from '@playwright/test';
import { loginViaUI, saveAuthState } from './authHelpers';

/**
 * Global setup — runs once before the entire test suite.
 *
 * Logs in with the real test account and saves the Supabase session
 * (cookies + localStorage) to auth-state.json.  Individual tests that
 * need auth load this file via storageState instead of going through the
 * login flow again.
 *
 * Uses system-installed Chrome (channel: 'chrome') so no Playwright
 * browser download is required.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:5173';
  const channel = (config.projects[0]?.use as { channel?: string })?.channel ?? 'chrome';

  const browser = await chromium.launch({ channel });
  const context = await browser.newContext({ baseURL });
  const page    = await context.newPage();

  try {
    await loginViaUI(page);
    await saveAuthState(context, 'e2e/.auth/auth-state.json');
    console.log('[globalSetup] Auth state saved to e2e/.auth/auth-state.json');
  } catch (err) {
    console.warn('[globalSetup] Could not log in:', err);
    console.warn('[globalSetup] Tests requiring auth will fall back to anonymous mode.');
  } finally {
    await browser.close();
  }
}
