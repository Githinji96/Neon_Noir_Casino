import { defineConfig } from '@playwright/test';

// .env.test is loaded automatically via the npm script (see package.json)
// or by passing --env-file=.env.test to node directly.

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

/** Specs that are ONLY run under their dedicated projects.
 *  Excluding these from the viewport projects prevents them running 4× redundantly
 *  and avoids skip-spam when auth-sensitive tests can't load on those viewports. */
const AUTH_ONLY_SPECS = [
  '**/liveTables.spec.ts',      // runs under live-tables project
  '**/slot-betting.spec.ts',    // runs under chromium-auth project
  '**/slot.spec.ts',            // runs under chromium-auth project
  '**/deposit-withdraw.spec.ts',// runs under chromium-auth project
  '**/notifications.spec.ts',   // runs under chromium-auth project
  '**/settings.spec.ts',        // runs under chromium-auth project
  '**/auth.spec.ts',            // runs under chromium-auth project
  '**/accessibility.spec.ts',   // runs under chromium-auth project (requires ⚙️ auth-gated UI)
  '**/registration.spec.ts',    // runs under registration project (needs NO auth state)
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
    // All projects share the same saved auth state so every test runs authenticated.
    // globalSetup saves this file before any tests run.
    storageState: AUTH_STATE,
    // Disable GPU acceleration to prevent Edge GPU process crashes on Windows.
    launchOptions: {
      args: ['--disable-gpu', '--disable-gpu-compositing'],
    },
  },

  projects: [
    /* ── Desktop (1440×900) ───────────────────────────────────────── */
    {
      name: 'desktop',
      use: { channel: resolvedChannel, viewport: { width: 1440, height: 900 } },
      testIgnore: AUTH_ONLY_SPECS,
    },

    /* ── Laptop (1366×768) ───────────────────────────────────────── */
    {
      name: 'laptop',
      use: { channel: resolvedChannel, viewport: { width: 1366, height: 768 } },
      testIgnore: AUTH_ONLY_SPECS,
    },

    /* ── Tablet (768×1024) ───────────────────────────────────────── */
    {
      name: 'tablet',
      use: { channel: resolvedChannel, viewport: { width: 768, height: 1024 } },
      testIgnore: AUTH_ONLY_SPECS,
    },

    /* ── Mobile (390×844) ────────────────────────────────────────── */
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

    /* ── chromium-auth — auth-specific spec files ─────────────────── */
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
        '**/accessibility.spec.ts',
      ],
    },

    /* ── Live Tables — desktop only, higher timeout for bet flows ── */
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

    /* ── Registration — runs with NO auth state so signUp starts clean ── */
    {
      name: 'registration',
      use: {
        channel: resolvedChannel,
        viewport: { width: 1440, height: 900 },
        // Explicitly no storageState — a pre-existing Supabase session in
        // localStorage causes supabase.auth.signUp() to throw instead of
        // returning { error }, which the signUp() catch block converts to
        // the generic "We could not create your account" fallback message.
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
