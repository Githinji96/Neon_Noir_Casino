// ─── Test User Credentials ────────────────────────────────────────────────────
// Set these environment variables before running e2e tests:
//   TEST_USER_EMAIL    — the test player's email address
//   TEST_USER_PASSWORD — the test player's password
//
// Example (.env.test or CI secrets):
//   TEST_USER_EMAIL=your-test-user@example.com
//   TEST_USER_PASSWORD=your-test-password
//
// NEVER commit real credentials here. Use environment variables only.

if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
  throw new Error(
    'E2E tests require TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables. ' +
    'Create a .env.test file or set them in your CI secrets.'
  );
}

export const TEST_PLAYER = {
  email:    process.env.TEST_USER_EMAIL,
  password: process.env.TEST_USER_PASSWORD,
};

/** Minimum balance the test player must have to run betting tests. */
export const MINIMUM_TEST_BALANCE = 200;
