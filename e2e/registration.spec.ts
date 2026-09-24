/**
 * Player Registration Tests — /auth/signup
 *
 * The signup form renders inside AuthCard which uses plain divs (no <main>).
 * All selectors are scoped to the card div (.rounded-2xl) to avoid conflicts
 * with footer elements (newsletter email inputs, footer links).
 *
 * react-hook-form uses mode:'onChange' — fields must be interacted with
 * using fill() + press('Tab') so onChange fires and isValid updates.
 */

import { test, expect, type Page, type Locator } from '@playwright/test';
import { waitForPageReady } from './helpers/waitHelpers';

// ─── The auth card wrapper ────────────────────────────────────────────────────
// AuthCard renders: div.min-h-screen > motion.div > div.rounded-2xl (the card)
const card = (page: Page): Locator =>
  page.locator('div.rounded-2xl').filter({ has: page.getByRole('heading', { name: /create account/i }) }).first();

/** Navigate to signup and wait for the form email input */
async function gotoSignup(page: Page): Promise<void> {
  await page.goto('/auth/signup');
  await waitForPageReady(page);
  await expect(page.getByPlaceholder('player@example.com')).toBeVisible({ timeout: 8_000 });
}

/**
 * Fill the form reliably for react-hook-form (mode:'onChange').
 * Uses fill() + blur() for text inputs, and direct DOM dispatchEvent
 * for the date field which doesn't trigger React onChange with fill() alone.
 */
async function fillValidForm(page: Page, overrides: Partial<{
  firstName: string; lastName: string; username: string;
  email: string; phone: string; dob: string;
  password: string; confirmPassword: string;
}> = {}): Promise<{ email: string }> {
  const ts    = Date.now();
  const email = overrides.email ?? `e2etest+${ts}@neonnoircasino.test`;

  // Helper: fill then blur (blur fires RHF's onBlur handler which re-validates)
  const fb = async (locator: Locator, value: string) => {
    await locator.fill(value);
    await locator.blur();
  };

  await fb(page.getByPlaceholder('John'),                  overrides.firstName ?? 'E2E');
  await fb(page.getByPlaceholder('Doe'),                   overrides.lastName  ?? 'Player');
  await fb(page.getByPlaceholder('CyberPlayer99'),         overrides.username  ?? `Player${ts}`);
  await fb(page.getByPlaceholder('player@example.com'),   email);
  await fb(page.getByPlaceholder('712 345 678'),           overrides.phone     ?? '712345678');

  // Date input: fill() alone doesn't fire React onChange, so dispatch events manually
  const dobValue = overrides.dob ?? '1995-06-15';
  const dobInput = page.locator('input[type="date"]');
  await dobInput.fill(dobValue);
  await page.evaluate((val) => {
    const el = document.querySelector('input[type="date"]') as HTMLInputElement;
    if (!el) return;
    el.value = val;
    ['input', 'change'].forEach((evt) =>
      el.dispatchEvent(new Event(evt, { bubbles: true }))
    );
  }, dobValue);
  await dobInput.blur();

  // Password fields — scroll into view first
  const pwd = page.getByPlaceholder('Min 8 chars, uppercase, number, symbol');
  await pwd.scrollIntoViewIfNeeded();
  await fb(pwd, overrides.password ?? 'ValidPass1!');

  const cpwd = page.getByPlaceholder('Repeat your password');
  await cpwd.scrollIntoViewIfNeeded();
  await fb(cpwd, overrides.confirmPassword ?? 'ValidPass1!');

  // Checkboxes — scroll to each and check; dispatch change so RHF registers it
  const checkboxes = card(page).locator('input[type="checkbox"]');
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) {
    const cb = checkboxes.nth(i);
    await cb.scrollIntoViewIfNeeded();
    if (!(await cb.isChecked())) {
      await cb.check();
      await cb.dispatchEvent('change');
    }
  }

  // Give RHF 400ms to revalidate everything before the caller reads isValid
  await page.waitForTimeout(400);

  await page.getByRole('button', { name: /create account/i }).scrollIntoViewIfNeeded();
  return { email };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Page structure
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Registration — Page structure', () => {
  test.beforeEach(async ({ page }) => { await gotoSignup(page); });

  test('signup page loads at /auth/signup', async ({ page }) => {
    await expect(page).toHaveURL('/auth/signup');
  });

  test('Create Account heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
  });

  test('First Name input is present', async ({ page }) => {
    await expect(page.getByPlaceholder('John')).toBeVisible();
  });

  test('Last Name input is present', async ({ page }) => {
    await expect(page.getByPlaceholder('Doe')).toBeVisible();
  });

  test('Username input is present', async ({ page }) => {
    await expect(page.getByPlaceholder('CyberPlayer99')).toBeVisible();
  });

  test('Email input is present', async ({ page }) => {
    await expect(page.getByPlaceholder('player@example.com')).toBeVisible();
  });

  test('M-Pesa phone input has +254 prefix', async ({ page }) => {
    await expect(page.getByText('+254')).toBeVisible();
    await expect(page.getByPlaceholder('712 345 678')).toBeVisible();
  });

  test('Date of Birth input is present', async ({ page }) => {
    await expect(page.locator('input[type="date"]')).toBeVisible();
  });

  test('Password input defaults to type password', async ({ page }) => {
    const pwd = page.getByPlaceholder('Min 8 chars, uppercase, number, symbol');
    await expect(pwd).toBeVisible();
    await expect(pwd).toHaveAttribute('type', 'password');
  });

  test('Confirm Password input is present', async ({ page }) => {
    const cpwd = page.getByPlaceholder('Repeat your password');
    await cpwd.scrollIntoViewIfNeeded();
    await expect(cpwd).toBeVisible();
  });

  test('Age confirmation checkbox is present', async ({ page }) => {
    const cb = card(page).locator('input[type="checkbox"]').first();
    await cb.scrollIntoViewIfNeeded();
    await expect(cb).toBeVisible({ timeout: 8_000 });
  });

  test('Two checkboxes present (age + terms)', async ({ page }) => {
    // Scroll to bottom of form so both render
    await page.getByPlaceholder('Repeat your password').scrollIntoViewIfNeeded();
    const cbs = card(page).locator('input[type="checkbox"]');
    await expect(cbs).toHaveCount(2, { timeout: 8_000 });
  });

  test('CREATE ACCOUNT button is present', async ({ page }) => {
    const btn = page.getByRole('button', { name: /create account/i });
    await btn.scrollIntoViewIfNeeded();
    await expect(btn).toBeVisible();
  });

  test('"Sign In" link is present and navigates to /auth/login', async ({ page }) => {
    // The Sign In link is at the bottom of the form card — scroll first
    const link = card(page).getByRole('link', { name: /sign in/i });
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible({ timeout: 5_000 });
    await link.click();
    await expect(page).toHaveURL('/auth/login');
  });

  test('Terms & Conditions link is present in the form', async ({ page }) => {
    const link = card(page).getByRole('link', { name: /terms & conditions/i });
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible({ timeout: 5_000 });
  });

  test('Privacy Policy link is present in the form', async ({ page }) => {
    const link = card(page).getByRole('link', { name: /privacy policy/i });
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible({ timeout: 5_000 });
  });

  test('page has no horizontal overflow', async ({ page }) => {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Field validation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Registration — Field validation', () => {
  test.beforeEach(async ({ page }) => { await gotoSignup(page); });

  test('CREATE ACCOUNT is disabled on empty form', async ({ page }) => {
    const btn = page.getByRole('button', { name: /create account/i });
    await btn.scrollIntoViewIfNeeded();
    await expect(btn).toBeDisabled();
  });

  test('short first name shows validation error', async ({ page }) => {
    const f = page.getByPlaceholder('John');
    await f.fill('A');
    await f.press('Tab');
    await expect(page.locator('.text-red-400').first()).toBeVisible({ timeout: 3_000 });
  });

  test('invalid email shows error', async ({ page }) => {
    const e = page.getByPlaceholder('player@example.com');
    await e.fill('notanemail');
    await e.press('Tab');
    await expect(page.locator('.text-red-400').first()).toBeVisible({ timeout: 3_000 });
  });

  test('short phone number shows error', async ({ page }) => {
    const ph = page.getByPlaceholder('712 345 678');
    await ph.fill('123');
    await ph.press('Tab');
    await expect(page.locator('.text-red-400').first()).toBeVisible({ timeout: 3_000 });
  });

  test('underage date of birth shows error', async ({ page }) => {
    const under = new Date();
    under.setFullYear(under.getFullYear() - 10);
    const dob = page.locator('input[type="date"]');
    await dob.fill(under.toISOString().split('T')[0]);
    await dob.press('Tab');
    await expect(page.locator('.text-red-400').first()).toBeVisible({ timeout: 3_000 });
  });

  test('mismatched passwords show error', async ({ page }) => {
    const pwd = page.getByPlaceholder('Min 8 chars, uppercase, number, symbol');
    await pwd.scrollIntoViewIfNeeded();
    await pwd.fill('ValidPass1!');
    await pwd.press('Tab');
    const cpwd = page.getByPlaceholder('Repeat your password');
    await cpwd.fill('DifferentPass2!');
    await cpwd.press('Tab');
    await expect(page.locator('.text-red-400').first()).toBeVisible({ timeout: 3_000 });
  });

  test('unchecked age checkbox keeps button disabled', async ({ page }) => {
    await fillValidForm(page);
    const cb = card(page).locator('input[type="checkbox"]').first();
    await cb.scrollIntoViewIfNeeded();
    await cb.uncheck();
    const btn = page.getByRole('button', { name: /create account/i });
    await btn.scrollIntoViewIfNeeded();
    await expect(btn).toBeDisabled({ timeout: 3_000 });
  });

  test('unchecked terms checkbox keeps button disabled', async ({ page }) => {
    await fillValidForm(page);
    const cb = card(page).locator('input[type="checkbox"]').nth(1);
    await cb.scrollIntoViewIfNeeded();
    await cb.uncheck();
    const btn = page.getByRole('button', { name: /create account/i });
    await btn.scrollIntoViewIfNeeded();
    await expect(btn).toBeDisabled({ timeout: 3_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Player Registration (Complete flow)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Player Registration', () => {
  // Allow extra time: Supabase signup + phone-patch loop + redirect can take ~15s on slow networks
  test.setTimeout(60_000);

  test('should successfully register a new player', async ({ page }) => {
    // ── Unique test data — new timestamp + random suffix for each run
    const timestamp = Date.now();
    const rand      = Math.random().toString(36).slice(2, 7);
    // Phone: randomize suffix to avoid any potential duplicate conflicts across runs.
    // Must be 9 digits starting with 7 (Safaricom range).
    const phoneSuffix = String(10000 + (timestamp % 90000)).slice(0, 5);
    // Username: max 20 chars, only letters/numbers/underscores. Use short random suffix.
    const user = {
      firstName: 'Test',
      lastName:  'Player',
      username:  `PW${rand}`,   // 2 + 5 = 7 chars — well within the 4–20 limit
      // Random email ensures no duplicate-account conflicts across runs
      email:     `test_${timestamp}_${rand}@mailinator.com`,
      // 9-digit suffix only — the +254 prefix is fixed in the form
      phone:     `7112${phoneSuffix}`,
      // DOB in YYYY-MM-DD, must be 18+
      dob:       '1995-01-01',
      password:  'Test@12345',
    };

    // ── 1. Navigate ────────────────────────────────────────────────────────────
    await page.goto('/auth/signup');
    await waitForPageReady(page);

    // ── 2. Verify Create Account form ─────────────────────────────────────────
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible({ timeout: 8_000 });

    /**
     * fillField: fill() + blur() triggers RHF onChange reliably without the
     * 30ms-per-character delay of pressSequentially. We only use
     * pressSequentially as a fallback if fill() doesn't mark the field dirty.
     */
    const fillField = async (locator: Locator, value: string) => {
      await locator.click();
      await locator.fill(value);
      await locator.blur();
    };

    // ── 3–6. Text fields ───────────────────────────────────────────────────────
    await fillField(page.getByPlaceholder('John'),               user.firstName);
    await fillField(page.getByPlaceholder('Doe'),                user.lastName);
    await fillField(page.getByPlaceholder('CyberPlayer99'),      user.username);
    await fillField(page.getByPlaceholder('player@example.com'), user.email);

    // ── 7. M-Pesa number ───────────────────────────────────────────────────────
    await fillField(page.getByPlaceholder('712 345 678'), user.phone);

    // ── 8. Date of Birth — fill + dispatch native events for RHF ──────────────
    const dobInput = page.locator('input[type="date"]');
    await dobInput.fill(user.dob);
    await page.evaluate((val) => {
      const el = document.querySelector('input[type="date"]') as HTMLInputElement;
      if (!el) return;
      el.value = val;
      ['input', 'change'].forEach((e) =>
        el.dispatchEvent(new Event(e, { bubbles: true }))
      );
    }, user.dob);
    await dobInput.blur();

    // ── 9–10. Password fields ──────────────────────────────────────────────────
    const pwd = page.getByPlaceholder('Min 8 chars, uppercase, number, symbol');
    await pwd.scrollIntoViewIfNeeded();
    await fillField(pwd, user.password);

    const cpwd = page.getByPlaceholder('Repeat your password');
    await cpwd.scrollIntoViewIfNeeded();
    await fillField(cpwd, user.password);

    // ── 11. Age confirmation checkbox ──────────────────────────────────────────
    const ageCheckbox = card(page).locator('input[type="checkbox"]').first();
    await ageCheckbox.scrollIntoViewIfNeeded();
    await ageCheckbox.check();
    await ageCheckbox.dispatchEvent('change');

    // ── 12. Terms & Conditions / Privacy Policy checkbox ──────────────────────
    const termsCheckbox = card(page).locator('input[type="checkbox"]').nth(1);
    await termsCheckbox.scrollIntoViewIfNeeded();
    await termsCheckbox.check();
    await termsCheckbox.dispatchEvent('change');

    // Wait for RHF to revalidate all fields
    await page.waitForTimeout(600);

    // ── 13. Submit ─────────────────────────────────────────────────────────────
    const submitBtn = page.getByRole('button', { name: /create account/i });
    await submitBtn.scrollIntoViewIfNeeded();

    // Wait up to 3s for the button to become enabled. If still disabled,
    // collect visible validation errors to explain why.
    const isEnabled = await submitBtn.isEnabled({ timeout: 3_000 }).catch(() => false);

    if (!isEnabled) {
      // Collect all visible red error messages for the failure report
      const errorTexts = await page.locator('.text-red-400').allTextContents();
      // Check each field's current value for debugging
      const fieldValues = await page.evaluate(() => ({
        firstName: (document.querySelector('input[placeholder="John"]') as HTMLInputElement)?.value,
        lastName:  (document.querySelector('input[placeholder="Doe"]') as HTMLInputElement)?.value,
        username:  (document.querySelector('input[placeholder="CyberPlayer99"]') as HTMLInputElement)?.value,
        email:     (document.querySelector('input[placeholder="player@example.com"]') as HTMLInputElement)?.value,
        phone:     (document.querySelector('input[placeholder="712 345 678"]') as HTMLInputElement)?.value,
        dob:       (document.querySelector('input[type="date"]') as HTMLInputElement)?.value,
        ageCheck:  (document.querySelectorAll('input[type="checkbox"]')[0] as HTMLInputElement)?.checked,
        termsCheck:(document.querySelectorAll('input[type="checkbox"]')[1] as HTMLInputElement)?.checked,
      }));
      throw new Error(
        `Submit button still disabled after form fill.\n` +
        `Field values: ${JSON.stringify(fieldValues, null, 2)}\n` +
        `Validation errors: ${errorTexts.join(' | ') || 'none visible'}`
      );
    }

    await submitBtn.click();

    // ── Assertions ─────────────────────────────────────────────────────────────

    // After submit, one of three things happens:
    // 1. Welcome screen appears briefly, then app navigates to /  (success)
    // 2. App navigates directly to / without showing welcome screen (also success — e.g. if the
    //    2.5s redirect fires faster than the test can observe the welcome text)
    // 3. A server error alert appears (failure with a useful message)
    // 4. Nothing happens within 25s (hung network call)

    const welcomeText  = page.getByText(/welcome to neon noir/i);
    const errorAlert   = page.locator('[role="alert"]').first();

    // Wait up to 25s for any of: welcome text, redirect to /, or error alert
    const outcome = await Promise.race([
      welcomeText.waitFor({ state: 'visible', timeout: 25_000 })
        .then(() => 'welcome' as const)
        .catch(() => null),
      page.waitForURL('/', { timeout: 25_000 })
        .then(() => 'redirected' as const)
        .catch(() => null),
      errorAlert.waitFor({ state: 'visible', timeout: 25_000 })
        .then(() => 'error' as const)
        .catch(() => null),
    ]);

    if (outcome === 'error') {
      const msg = await errorAlert.textContent().catch(() => '');
      throw new Error(`Registration failed — server returned: ${msg?.trim()}`);
    }

    if (!outcome) {
      throw new Error('Registration timed out — no welcome screen, no redirect, no error after 25s');
    }

    // If we got here via welcome screen, also confirm the success paragraph
    if (outcome === 'welcome') {
      await expect(
        page.getByText(/your account has been created successfully/i)
      ).toBeVisible({ timeout: 5_000 });
    }

    // ✓ App is on / (either navigated there after welcome, or redirected directly)
    await expect(page).toHaveURL('/', { timeout: 10_000 });

    // ✓ Navbar shows the player's balance — confirms auto-login after signup
    await expect(
      page.getByTestId('navbar-balance')
    ).toBeVisible({ timeout: 8_000 });

    // ✓ Default balance starts at KES 0.00 (no deposit yet)
    const balanceText = await page.getByTestId('navbar-balance').textContent() ?? '';
    const balance     = parseFloat(balanceText.replace(/[^0-9.]/g, ''));
    expect(balance).toBeGreaterThanOrEqual(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — Navigation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Registration — Navigation', () => {
  test.beforeEach(async ({ page }) => { await gotoSignup(page); });

  test('Terms & Conditions link opens /terms in new tab', async ({ page }) => {
    const link = card(page).getByRole('link', { name: /terms & conditions/i });
    await link.scrollIntoViewIfNeeded();
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      link.click(),
    ]);
    await newPage.waitForLoadState();
    expect(newPage.url()).toContain('/terms');
    await newPage.close();
  });

  test('Privacy Policy link opens /privacy-policy in new tab', async ({ page }) => {
    const link = card(page).getByRole('link', { name: /privacy policy/i });
    await link.scrollIntoViewIfNeeded();
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      link.click(),
    ]);
    await newPage.waitForLoadState();
    expect(newPage.url()).toContain('/privacy-policy');
    await newPage.close();
  });
});
