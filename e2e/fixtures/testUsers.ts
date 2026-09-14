// ─── Test User Credentials ────────────────────────────────────────────────────
// Never hard-code passwords in CI. Override via environment variables:
//   TEST_USER_EMAIL / TEST_USER_PASSWORD

export const TEST_PLAYER = {
  email:    process.env.TEST_USER_EMAIL    ?? 'bonfacegithinji64@gmail.com',
  password: process.env.TEST_USER_PASSWORD ?? 'Bg33173375#',
};

/** Minimum balance the test player must have to run betting tests. */
export const MINIMUM_TEST_BALANCE = 200;
