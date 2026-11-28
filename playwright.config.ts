import { defineConfig } from '@playwright/test';

// .env.test is loaded automatically via the npm script (see package.json)
// or by passing --env-file=.env.test to node directly.

/**
 * Neon Noir Casino — Playwright configuration
 *
 * Run all tests:         npm run test:e2e
 * Interactive UI mode:   npm run test:e2e:ui
 * Single spec:           npx playwright test e2e/home.spec.ts
 * By project:            npx playwright test --project=chromium-auth
 *
 * Projects:
 *   desktop, laptop, tablet, mobile  — viewport variants, all specs, authenticated
 *   chromium-auth                    — desktop viewport, all specs, authenticated
 *   live-tables                      — liveTables.spec.ts only, 60s timeout
 *   registration                     — registration.spec.ts only, no auth state
 */

const BASE_URL   = process.env.BASE_URL   ?? 'http://localhost:5173';
const AUTH_STATE = 'e2e/.auth/auth-state.json';

const BROWSER_CHANNEL = process.env.BROWSER_CHANNEL ?? 'msedge';
const resolvedChannel = BROWSER_CHANNEL || undefined;

/** Specs with their own dedicated projects — excluded from the 5 standard projects. */
const DEDICATED_SPECS = [
  '**/liveTables.spec.ts',   // live-tables project (60s timeout)
  '**/registration.spec.ts', // registration project (no auth state)
];

export default defineConfig({
  testDir: './e2e',

  timeout: 35_000,
  expect: { timeout: process.env.CI ? 20_000 : 10_000 },
  retries: process.env.CI ? 2 : 1,
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
    storageState: AUTH_STATE,
    launchOptions: {
      args: ['--disable-gpu', '--disable-gpu-compositing'],
    },
  },

  projects: [
    /* ── Desktop (1440×900) ───────────────────────────────────────── */
    {
      name: 'desktop',
      use: { channel: resolvedChannel, viewport: { width: 1440, height: 900 } },
      testIgnore: DEDICATED_SPECS,
    },

    /* ── Laptop (1366×768) ────────────────────────────────────────── */
    {
      name: 'laptop',
      use: { channel: resolvedChannel, viewport: { width: 1366, height: 768 } },
      testIgnore: DEDICATED_SPECS,
    },

    /* ── Tablet (768×1024) ────────────────────────────────────────── */
    {
      name: 'tablet',
      use: { channel: resolvedChannel, viewport: { width: 768, height: 1024 } },
      testIgnore: DEDICATED_SPECS,
    },

    /* ── Mobile (390×844) ─────────────────────────────────────────── */
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
      testIgnore: DEDICATED_SPECS,
    },

    /* ── chromium-auth (1440×900, authenticated) ──────────────────── */
    {
      name: 'chromium-auth',
      use: {
        channel: resolvedChannel,
        viewport: { width: 1440, height: 900 },
        storageState: AUTH_STATE,
      },
      testIgnore: DEDICATED_SPECS,
    },

    /* ── Live Tables — dedicated, 60s timeout ─────────────────────── */
    {
      name: 'live-tables',
      use: {
        channel: resolvedChannel,
        viewport: { width: 1440, height: 900 },
        storageState: AUTH_STATE,
      },
      testMatch: ['**/liveTables.spec.ts'],
      timeout: 60_000,
    },

    /* ── Registration — dedicated, no auth state ──────────────────── */
    {
      name: 'registration',
      use: {
        channel: resolvedChannel,
        viewport: { width: 1440, height: 900 },
        storageState: { cookies: [], origins: [] },
      },
      testMatch: ['**/registration.spec.ts'],
      timeout: 60_000,
    },
  ],

  webServer: {
    command: process.env.CI ? 'npx vite preview --port 4173 --host' : 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
