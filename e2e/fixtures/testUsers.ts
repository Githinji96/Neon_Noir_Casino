// ─── Test User Credentials ────────────────────────────────────────────────────
// Set these environment variables before running authenticated e2e tests:
//   TEST_USER_EMAIL    — the test player's email address
//   TEST_USER_PASSWORD — the test player's password
//
// For CI: add as GitHub Actions repository secrets.
// Locally: create a .env.test file (gitignored) or set them in your shell.
//
// If not set, auth-dependent tests will fall back to anonymous mode via
// globalSetup's try/catch — unauthenticated tests still run normally.

if (process.env.TEST_USER_EMAIL && !process.env.TEST_USER_PASSWORD) {
  console.warn('[testUsers] TEST_USER_EMAIL is set but TEST_USER_PASSWORD is missing.');
}

export const TEST_PLAYER = {
  email:    process.env.TEST_USER_EMAIL    ?? '',
  password: process.env.TEST_USER_PASSWORD ?? '',
};

/** Minimum balance the test player must have to run betting tests. */
export const MINIMUM_TEST_BALANCE = 200;
