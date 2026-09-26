// ─── Test User Credentials ────────────────────────────────────────────────────
// Set TEST_USER_EMAIL and TEST_USER_PASSWORD in .env.test (gitignored locally)
// or as GitHub Actions repository secrets for CI.
//
// globalSetup loads .env.test automatically — no need for --env-file flag.

export const TEST_PLAYER = {
  email:    process.env.TEST_USER_EMAIL    ?? '',
  password: process.env.TEST_USER_PASSWORD ?? '',
};

/** Minimum balance the test player must have to run betting tests. */
export const MINIMUM_TEST_BALANCE = 200;
