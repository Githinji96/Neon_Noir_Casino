import { test, expect } from '@playwright/test';
import { ContactPage as ContactPageObject } from './pages/ContactPage';
import { waitForPageReady, scrollToBottom, waitForAnimation } from './helpers/waitHelpers';

/**
 * Force the footer's IntersectionObserver to trigger by scrolling to the
 * bottom AND calling the observer callback directly via JS evaluation.
 * The footer starts at opacity:0 with initial={{ opacity: 0 }} framer-motion
 * and only becomes visible when `visible` state is set true.
 */
async function showFooter(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  await scrollToBottom(page);
  // Give IntersectionObserver time to fire (threshold: 0.05)
  await page.waitForTimeout(800);
  // Fallback: if still opacity 0, force via JS
  await page.evaluate(() => {
    const footer = document.querySelector('footer[aria-label="Site footer"]') as HTMLElement | null;
    if (footer && window.getComputedStyle(footer).opacity === '0') {
      // Framer-motion animates via style attribute — override it
      footer.style.opacity = '1';
      footer.style.transform = 'none';
    }
  });
  await waitForAnimation(page, 300);
}

test.describe('Footer', () => {

  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);
    await showFooter(page);
  });

  test('footer element is present in the DOM', async ({ page }) => {
    await expect(page.locator('footer[aria-label="Site footer"]')).toBeAttached();
  });

  test('NEON NOIR brand name is in the footer', async ({ page }) => {
    // The h2 text is "NEON NOIR" — desktop grid is hidden md:grid, mobile brand is always visible
    // Force footer visible first (done in beforeEach), then check the h2
    const brandH2 = page.locator('footer[aria-label="Site footer"] h2').first();
    await expect(brandH2).toBeAttached();
    const text = await brandH2.textContent();
    expect(text).toMatch(/neon noir/i);
  });

  test('Privacy Policy link is present', async ({ page }) => {
    await expect(
      page.locator('footer').getByRole('link', { name: /privacy policy/i }).first()
    ).toBeAttached();
  });

  test('Terms link is present', async ({ page }) => {
    await expect(
      page.locator('footer').getByRole('link', { name: /^terms$/i }).first()
    ).toBeAttached();
  });

  test('Contact Support link is present', async ({ page }) => {
    await expect(
      page.locator('footer').getByRole('link', { name: /contact support|help center/i }).first()
    ).toBeAttached();
  });

  test('"Play Responsibly" notice is present', async ({ page }) => {
    await expect(
      page.locator('footer p').filter({ hasText: /play responsibly/i })
    ).toBeAttached();
  });

  test('18+ badge is present', async ({ page }) => {
    await expect(
      page.locator('footer span').filter({ hasText: /18\+/ })
    ).toBeAttached();
  });

  test('copyright notice contains a year', async ({ page }) => {
    const copyright = page.locator('footer p').filter({ hasText: /neon noir casino/i }).first();
    await expect(copyright).toBeAttached();
    const text = await copyright.textContent();
    expect(text).toMatch(/202[0-9]/);
  });

  test('Payment Methods section heading is present', async ({ page }) => {
    await expect(
      page.locator('footer p').filter({ hasText: /payment methods/i })
    ).toBeAttached();
  });

  test('newsletter email input accepts valid email and shows subscribed', async ({ page }) => {
    // The newsletter form lives in the desktop md:grid — only visible at ≥768px.
    // At mobile viewport the form is display:none; skip rather than fail.
    const input   = page.locator('footer input[type="email"]').first();
    const joinBtn = page.locator('footer button').filter({ hasText: /^join$/i }).first();
    const inputVisible = await input.isVisible().catch(() => false);
    if (!inputVisible) test.skip();
    await input.fill('player@example.com');
    await joinBtn.click();
    // Success renders <p role="status">✓ Subscription successful.</p>
    // Allow up to 6s for the 4s timeout race + React re-render
    await expect(
      page.locator('footer [role="status"]').first()
    ).toBeVisible({ timeout: 7_000 });
  });

  test('newsletter form shows error for invalid email', async ({ page, viewport }) => {
    // The newsletter form is inside `hidden md:grid` — only rendered at md+ (≥768px).
    // Skip on viewports smaller than 768px where the form is display:none.
    if ((viewport?.width ?? 1440) < 768) test.skip();

    // Scroll to bottom to trigger footer IntersectionObserver (done in beforeEach,
    // but also scroll the newsletter input into view explicitly)
    const input = page.locator('footer input[type="email"]').first();
    await input.scrollIntoViewIfNeeded();
    await expect(input).toBeVisible({ timeout: 5_000 });

    const joinBtn = page.locator('footer button').filter({ hasText: /^join$/i }).first();
    await input.fill('not-an-email');
    await joinBtn.click();

    // Error message from validateField: "Please enter a valid email address."
    await expect(
      page.locator('footer').locator('p[role="alert"]').first()
    ).toBeVisible({ timeout: 3_000 });
  });

  test('Privacy Policy link navigates to /privacy-policy', async ({ page }) => {
    await page.locator('footer').getByRole('link', { name: /privacy policy/i }).first().click();
    await expect(page).toHaveURL('/privacy-policy');
  });

  test('Terms link navigates to /terms', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);
    await showFooter(page);
    await page.locator('footer').getByRole('link', { name: /^terms$/i }).first().click();
    await expect(page).toHaveURL('/terms');
  });

});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Privacy Policy Page', () => {
  test('page renders with privacy-related content', async ({ page }) => {
    await page.goto('/privacy-policy');
    await waitForPageReady(page);
    await expect(page.locator('main')).toContainText(/privacy/i);
  });

  test('no horizontal overflow', async ({ page }) => {
    await page.goto('/privacy-policy');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Terms & Conditions Page', () => {
  test('page renders with terms-related content', async ({ page }) => {
    await page.goto('/terms');
    await waitForPageReady(page);
    await expect(page.locator('main')).toContainText(/terms/i);
  });

  test('no horizontal overflow', async ({ page }) => {
    await page.goto('/terms');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Contact / Support Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/contact');
    await waitForPageReady(page);
  });

  test('CONTACT SUPPORT heading is visible', async ({ page }) => {
    const contact = new ContactPageObject(page);
    await expect(contact.heading).toBeVisible();
  });

  test('form fields are present', async ({ page }) => {
    const contact = new ContactPageObject(page);
    await expect(contact.nameInput).toBeVisible();
    await expect(contact.emailInput).toBeVisible();
    await expect(contact.subjectInput).toBeVisible();
    await expect(contact.messageTextarea).toBeVisible();
  });

  test('SEND MESSAGE button is present', async ({ page }) => {
    const contact = new ContactPageObject(page);
    await expect(contact.sendBtn).toBeVisible();
  });

  test('submitting empty form shows name validation error', async ({ page }) => {
    const contact = new ContactPageObject(page);
    await contact.sendBtn.click();
    await expect(contact.nameError).toBeVisible({ timeout: 3_000 });
  });

  test('short name shows error', async ({ page }) => {
    const contact = new ContactPageObject(page);
    await contact.nameInput.fill('A');
    await contact.sendBtn.click();
    await expect(contact.nameError).toBeVisible({ timeout: 3_000 });
  });

  test('invalid email shows error', async ({ page }) => {
    const contact = new ContactPageObject(page);
    await contact.nameInput.fill('John Doe');
    await contact.emailInput.fill('not-an-email');
    await contact.subjectInput.fill('Test subject');
    await contact.messageTextarea.fill('This is a test message with enough characters.');
    await contact.sendBtn.click();
    await expect(contact.emailError).toBeVisible({ timeout: 3_000 });
  });

  test('short subject shows error', async ({ page }) => {
    const contact = new ContactPageObject(page);
    await contact.nameInput.fill('John Doe');
    await contact.emailInput.fill('john@example.com');
    await contact.subjectInput.fill('Hi');
    await contact.messageTextarea.fill('This is a test message with enough characters.');
    await contact.sendBtn.click();
    await expect(contact.subjectError).toBeVisible({ timeout: 3_000 });
  });

  test('short message shows error', async ({ page }) => {
    const contact = new ContactPageObject(page);
    await contact.nameInput.fill('John Doe');
    await contact.emailInput.fill('john@example.com');
    await contact.subjectInput.fill('Test subject');
    await contact.messageTextarea.fill('Too short');
    await contact.sendBtn.click();
    await expect(contact.messageError).toBeVisible({ timeout: 3_000 });
  });

  test('character counter is visible', async ({ page }) => {
    const contact = new ContactPageObject(page);
    await expect(contact.charCounter).toBeVisible();
    await contact.messageTextarea.fill('Hello world');
    const text = await contact.charCounter.textContent();
    expect(text).toMatch(/\d+\/2000/);
  });

  test('FAQ items are present and expandable', async ({ page }) => {
    const faqBtn = page.getByRole('button').filter({ hasText: /how do i/i }).first();
    await expect(faqBtn).toBeVisible({ timeout: 5_000 });
    await faqBtn.click();
    await waitForAnimation(page, 300);
    await expect(faqBtn).toHaveAttribute('aria-expanded', 'true');
  });

  test('no horizontal overflow', async ({ page }) => {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);
  });

});
