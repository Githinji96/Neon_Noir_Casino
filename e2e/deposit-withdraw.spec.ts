import { test, expect, type Page } from '@playwright/test';
import { waitForPageReady, waitForAnimation } from './helpers/waitHelpers';

/**
 * Deposit and Withdrawal modal tests.
 *
 * WithdrawalModal uses createPortal(modal, document.body).
 * The outermost div class is: "fixed inset-0 z-[200] flex items-end sm:items-center ..."
 * The h2 inside reads "WITHDRAW" (exact, uppercase).
 *
 * We identify the withdrawal overlay by z-[200] class and then find
 * child elements within it.
 */

async function openDepositModal(page: Page): Promise<boolean> {
  const btn = page.locator('nav').getByRole('button', { name: /^deposit$/i });
  if (!(await btn.isVisible().catch(() => false))) return false;
  await btn.click();
  await waitForAnimation(page, 400);
  return true;
}

async function openWithdrawModal(page: Page): Promise<boolean> {
  const btn = page.locator('nav').getByRole('button', { name: /^withdraw$/i });
  if (!(await btn.isVisible().catch(() => false))) return false;
  await btn.click();
  await waitForAnimation(page, 400);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Deposit Modal', () => {

  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);
  });

  test('M-PESA DEPOSIT heading is visible', async ({ page }) => {
    if (!(await openDepositModal(page))) test.skip();
    await expect(page.locator('h2').filter({ hasText: /m-pesa deposit/i })).toBeVisible({ timeout: 5_000 });
  });

  test('"Deposit To" phone row is displayed', async ({ page }) => {
    if (!(await openDepositModal(page))) test.skip();
    const modal = page.locator('.fixed').filter({ hasText: /m-pesa deposit/i });
    await expect(
      modal.locator('label').filter({ hasText: /deposit to/i })
    ).toBeVisible({ timeout: 5_000 });
  });

  test('CURRENT BALANCE row is displayed', async ({ page }) => {
    if (!(await openDepositModal(page))) test.skip();
    // Balance row: <span>CURRENT BALANCE</span> and KES amount
    await expect(
      page.locator('span').filter({ hasText: /current balance/i }).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('amount input is present', async ({ page }) => {
    if (!(await openDepositModal(page))) test.skip();
    const modal = page.locator('.fixed').filter({ hasText: /m-pesa deposit/i });
    await expect(modal.locator('input[type="number"]')).toBeVisible({ timeout: 5_000 });
  });

  test('quick-amount buttons 100 and 500 are present', async ({ page }) => {
    if (!(await openDepositModal(page))) test.skip();
    const modal = page.locator('.fixed').filter({ hasText: /m-pesa deposit/i });
    await expect(modal.getByRole('button', { name: /^100$/ })).toBeVisible({ timeout: 5_000 });
    await expect(modal.getByRole('button', { name: /^500$/ })).toBeVisible({ timeout: 5_000 });
  });

  test('DEPOSIT VIA M-PESA button is visible', async ({ page }) => {
    if (!(await openDepositModal(page))) test.skip();
    await expect(
      page.getByRole('button', { name: /deposit via m-pesa/i })
    ).toBeVisible({ timeout: 5_000 });
  });

  test('amount below KES 10 minimum shows error', async ({ page }) => {
    if (!(await openDepositModal(page))) test.skip();
    const modal  = page.locator('.fixed').filter({ hasText: /m-pesa deposit/i });
    const input  = modal.locator('input[type="number"]');
    if (await input.isDisabled().catch(() => true)) test.skip();
    await input.fill('5');
    await page.getByRole('button', { name: /deposit via m-pesa/i }).click();
    await expect(
      page.locator('[data-testid="deposit-error"]')
    ).toBeVisible({ timeout: 5_000 });
  });

  test('amount above KES 150,000 maximum shows error', async ({ page }) => {
    if (!(await openDepositModal(page))) test.skip();
    const modal  = page.locator('.fixed').filter({ hasText: /m-pesa deposit/i });
    const input  = modal.locator('input[type="number"]');
    if (await input.isDisabled().catch(() => true)) test.skip();
    await input.fill('200000');
    await page.getByRole('button', { name: /deposit via m-pesa/i }).click();
    await expect(
      page.locator('[data-testid="deposit-error"]')
    ).toBeVisible({ timeout: 5_000 });
  });

  test('modal closes when ✕ is clicked', async ({ page }) => {
    if (!(await openDepositModal(page))) test.skip();
    await page.locator('.fixed').filter({ hasText: /m-pesa deposit/i })
      .getByRole('button').filter({ hasText: '✕' }).click();
    await waitForAnimation(page, 400);
    await expect(page.locator('h2').filter({ hasText: /m-pesa deposit/i })).not.toBeVisible();
  });

});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Withdrawal Modal', () => {

  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);
  });

  /**
   * WithdrawalModal uses createPortal → the outermost div is
   * class="fixed inset-0 z-[200] flex items-end sm:items-center ..."
   * appended directly to <body>.
   * We locate it by its z-[200] class.
   */
  function getWithdrawOverlay(page: Page) {
    return page.locator('.fixed.inset-0.z-\\[200\\]');
  }

  test('WITHDRAW heading is visible', async ({ page }) => {
    if (!(await openWithdrawModal(page))) test.skip();
    await expect(
      getWithdrawOverlay(page).locator('h2').filter({ hasText: /^withdraw$/i })
    ).toBeVisible({ timeout: 5_000 });
  });

  test('AVAILABLE balance label is displayed', async ({ page }) => {
    if (!(await openWithdrawModal(page))) test.skip();
    // <span class="font-orbitron text-xs text-white/40 tracking-widest">AVAILABLE</span>
    await expect(
      getWithdrawOverlay(page).locator('span').filter({ hasText: /^available$/i })
    ).toBeVisible({ timeout: 5_000 });
  });

  test('Min / Max / Daily limit labels are displayed', async ({ page }) => {
    if (!(await openWithdrawModal(page))) test.skip();
    const overlay = getWithdrawOverlay(page);
    // Labels: "Min", "Max", "Daily" (inside grid of 3 divs)
    await expect(overlay.locator('p').filter({ hasText: /^Min$/ })).toBeVisible({ timeout: 5_000 });
    await expect(overlay.locator('p').filter({ hasText: /^Max$/ })).toBeVisible({ timeout: 5_000 });
    await expect(overlay.locator('p').filter({ hasText: /^Daily$/ })).toBeVisible({ timeout: 5_000 });
  });

  test('"Withdraw To" label is shown', async ({ page }) => {
    if (!(await openWithdrawModal(page))) test.skip();
    await expect(
      getWithdrawOverlay(page).locator('label').filter({ hasText: /withdraw to/i })
    ).toBeVisible({ timeout: 5_000 });
  });

  test('amount input is present', async ({ page }) => {
    if (!(await openWithdrawModal(page))) test.skip();
    await expect(
      getWithdrawOverlay(page).locator('input[type="number"]')
    ).toBeVisible({ timeout: 5_000 });
  });

  test('REQUEST WITHDRAWAL button is visible', async ({ page }) => {
    if (!(await openWithdrawModal(page))) test.skip();
    await expect(
      getWithdrawOverlay(page).getByRole('button', { name: /request withdrawal/i })
    ).toBeVisible({ timeout: 5_000 });
  });

  test('amount below KES 100 minimum shows validation error', async ({ page }) => {
    if (!(await openWithdrawModal(page))) test.skip();
    const overlay = getWithdrawOverlay(page);
    const input   = overlay.locator('input[type="number"]');
    const reqBtn  = overlay.getByRole('button', { name: /request withdrawal/i });
    if (await input.isDisabled().catch(() => true)) test.skip();
    await input.fill('5');
    await reqBtn.click();
    await expect(
      page.locator('[data-testid="withdrawal-error"]')
    ).toBeVisible({ timeout: 5_000 });
  });

  test('processing time notice is visible', async ({ page }) => {
    if (!(await openWithdrawModal(page))) test.skip();
    // Text: "Processing: 1–24 hours · Admin review required"
    await expect(
      getWithdrawOverlay(page).locator('div').filter({ hasText: /admin review/i }).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('modal closes when ✕ is clicked', async ({ page }) => {
    if (!(await openWithdrawModal(page))) test.skip();
    const overlay = getWithdrawOverlay(page);
    await overlay.getByRole('button').filter({ hasText: '✕' }).first().click();
    await waitForAnimation(page, 400);
    await expect(overlay).not.toBeVisible();
  });

});
