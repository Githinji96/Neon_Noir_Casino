import { defineConfig, devices } from '@playwright/test';

/**
 * Neon Noir Casino — Playwright configuration
 *
 * Run all tests:         npm run test:e2e
 * Interactive UI mode:   npm run test:e2e:ui
 * Single spec:           npx playwright test e2e/home.spec.ts
 * Authenticated only:    npx playwright test --project=chromium-auth
 *
 * Browser: uses system-installed Microsoft Edge (msedge) so no Playwright
 * browser download is required.  Switch to 'chrome' if Chrome is installed,
 * or remove `channel` and run `npx playwright install chromium` for the
 * bundled Chromium.
 */

const BASE_URL   = process.env.BASE_URL   ?? 'http://localhost:5173';
const AUTH_STATE = 'e2e/.auth/auth-state.json';

// Detect system Chrome or Edge — whichever is present
// Playwright resolves these via the `channel` option automatically on Windows.
const BROWSER_CHANNEL = process.env.BROWSER_CHANNEL ?? 'msedge'; // Edge is installed

export default defineConfig({
  testDir: './e2e',

  timeout: 35_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  globalSetup: './e2e/helpers/globalSetup.ts',

  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace:      'on-first-retry',
    video:      'on-first-retry',
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    /* Use system-installed Chrome — no Playwright browser download needed */
    channel: BROWSER_CHANNEL,
  },

  projects: [
    /* ── Anonymous projects ──────────────────────────────────────── */
    {
      name: 'desktop',
      use: { channel: BROWSER_CHANNEL, viewport: { width: 1440, height: 900 } },
      // slot/deposit/notifications/settings/auth run only in chromium-auth (needs real session)
      testIgnore: [
        '**/slot.spec.ts',
        '**/deposit-withdraw.spec.ts',
        '**/notifications.spec.ts',
        '**/settings.spec.ts',
      ],
    },
    {
      name: 'laptop',
      use: { channel: BROWSER_CHANNEL, viewport: { width: 1366, height: 768 } },
      testIgnore: [
        '**/slot.spec.ts',
        '**/deposit-withdraw.spec.ts',
        '**/notifications.spec.ts',
        '**/settings.spec.ts',
      ],
    },
    {
      name: 'tablet',
      use: { channel: BROWSER_CHANNEL, viewport: { width: 768, height: 1024 } },
      testIgnore: [
        '**/slot.spec.ts',
        '**/deposit-withdraw.spec.ts',
        '**/notifications.spec.ts',
        '**/settings.spec.ts',
      ],
    },
    {
      name: 'mobile',
      use: {
        channel: BROWSER_CHANNEL,
        viewport: { width: 390, height: 844 },
        userAgent:
          'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/90.0.4430.212 Mobile Safari/537.36',
        hasTouch: true,
        isMobile: true,
      },
      testIgnore: [
        '**/slot.spec.ts',
        '**/deposit-withdraw.spec.ts',
        '**/notifications.spec.ts',
        '**/settings.spec.ts',
      ],
    },

    /* ── Authenticated — desktop only ────────────────────────────── */
    {
      name: 'chromium-auth',
      use: {
        channel: BROWSER_CHANNEL,
        viewport: { width: 1440, height: 900 },
        storageState: AUTH_STATE,
      },
      testMatch: [
        '**/slot.spec.ts',
        '**/deposit-withdraw.spec.ts',
        '**/notifications.spec.ts',
        '**/settings.spec.ts',
        '**/auth.spec.ts',
      ],
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
