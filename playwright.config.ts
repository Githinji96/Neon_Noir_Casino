import { defineConfig } from '@playwright/test';

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

// In CI: BROWSER_CHANNEL is set to '' → Playwright uses bundled Chromium.
// Locally: defaults to 'msedge' (or 'chrome' if you prefer).
const BROWSER_CHANNEL = process.env.BROWSER_CHANNEL ?? 'msedge';
// When channel is empty string, pass undefined so Playwright uses bundled browser
const resolvedChannel = BROWSER_CHANNEL || undefined;

/** Specs that require saved auth state — excluded from the desktop project,
 *  run only under chromium-auth which loads e2e/.auth/auth-state.json */
const AUTH_ONLY_SPECS = [
  '**/slot.spec.ts',          // needs chromium-auth saved state
  '**/slot-betting.spec.ts',  // needs chromium-auth saved state
  '**/deposit-withdraw.spec.ts',
  '**/notifications.spec.ts',
  '**/settings.spec.ts',
  '**/liveTables.spec.ts',    // runs under its own live-tables project
];

export default defineConfig({
  testDir: './e2e',

  timeout: 35_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 1,
  // Cap at 2 workers locally — the live tables tests do heavy login+bet flows
  // and running too many in parallel crashes the Vite dev server.
  workers: process.env.CI ? 1 : 2,

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
    channel: resolvedChannel,
  },

  projects: [
    /* ── Desktop — anonymous specs + auth.spec (uses loginViaUI) ────── */
    {
      name: 'desktop',
      use: { channel: resolvedChannel, viewport: { width: 1440, height: 900 } },
      testIgnore: AUTH_ONLY_SPECS,
    },

    /* ── Other viewports — anonymous specs only ──────────────────── */
    {
      name: 'laptop',
      use: { channel: resolvedChannel, viewport: { width: 1366, height: 768 } },
      testIgnore: AUTH_ONLY_SPECS,
    },
    {
      name: 'tablet',
      use: { channel: resolvedChannel, viewport: { width: 768, height: 1024 } },
      testIgnore: AUTH_ONLY_SPECS,
    },
    {
      name: 'mobile',
      use: {
        channel: resolvedChannel,
        viewport: { width: 390, height: 844 },
        userAgent:
          'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/90.0.4430.212 Mobile Safari/537.36',
        hasTouch: true,
        isMobile: true,
      },
      testIgnore: AUTH_ONLY_SPECS,
    },

    /* ── Authenticated — desktop with saved auth state ───────────── */
    {
      name: 'chromium-auth',
      use: {
        channel: resolvedChannel,
        viewport: { width: 1440, height: 900 },
        storageState: AUTH_STATE,
      },
      testMatch: [
        '**/slot.spec.ts',
        '**/slot-betting.spec.ts',
        '**/deposit-withdraw.spec.ts',
        '**/notifications.spec.ts',
        '**/settings.spec.ts',
        '**/auth.spec.ts',
      ],
    },

    /* ── Live Tables — desktop only, higher timeout for bet flows ── */
    {
      name: 'live-tables',
      use: {
        channel: resolvedChannel,
        viewport: { width: 1440, height: 900 },
      },
      testMatch: ['**/liveTables.spec.ts'],
      timeout: 60_000,
    },
  ],

  webServer: {
    command: process.env.CI ? 'npm run preview -- --port 4173' : 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,  // 2 minutes — CI runners can be slow to start
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
