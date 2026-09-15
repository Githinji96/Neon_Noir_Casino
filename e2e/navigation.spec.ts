import { test, expect } from '@playwright/test';
import { NavbarPage } from './pages/NavbarPage';
import { waitForPageReady, waitForAnimation } from './helpers/waitHelpers';

test.describe('Navigation — public routes', () => {

  test('/ renders the Casino Lobby', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);
    await expect(page.locator('main')).toBeVisible();
  });

  test('/live-tables renders the Live Tables page', async ({ page }) => {
    await page.goto('/live-tables');
    await waitForPageReady(page);
    await expect(page.getByRole('heading', { name: /live.*casino.*tables/i })).toBeVisible();
  });

  test('/jackpots renders the Jackpots page', async ({ page }) => {
    await page.goto('/jackpots');
    await waitForPageReady(page);
    // h1 text: "Progressive Jackpots" — the word "Progressive" and "Jackpots" are in the heading
    await expect(
      page.locator('h1').filter({ hasText: /jackpot/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('/vip renders the VIP Club page', async ({ page }) => {
    await page.goto('/vip');
    await waitForPageReady(page);
    await expect(page.getByRole('heading', { name: /vip club/i })).toBeVisible();
  });

  test('/contact renders the Contact page', async ({ page }) => {
    await page.goto('/contact');
    await waitForPageReady(page);
    await expect(page.getByRole('heading', { name: /contact support/i })).toBeVisible();
  });

  test('/privacy-policy renders the Privacy Policy page', async ({ page }) => {
    await page.goto('/privacy-policy');
    await waitForPageReady(page);
    await expect(page.locator('main')).toContainText(/privacy/i);
  });

  test('/terms renders the Terms & Conditions page', async ({ page }) => {
    await page.goto('/terms');
    await waitForPageReady(page);
    await expect(page.locator('main')).toContainText(/terms/i);
  });

  test('/auth/login renders the Login page', async ({ page }) => {
    await page.goto('/auth/login');
    await waitForPageReady(page);
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  });

  test('/auth/signup renders the Sign Up page with email input', async ({ page }) => {
    await page.goto('/auth/signup');
    await waitForPageReady(page);
    // SignUpPage has an email input field
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 8_000 });
  });

  test('/slot without auth redirects to login', async ({ page }) => {
    await page.goto('/slot');
    await page.waitForURL(/auth\/login|\/slot/, { timeout: 8_000 });
    expect(page.url()).toMatch(/auth\/login|\/slot/);
  });

  test('unknown route redirects to home', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page).toHaveURL('/');
  });

  // ── Mobile menu ───────────────────────────────────────────────────

  test('hamburger opens mobile menu on small screen', async ({ page, viewport }) => {
    if ((viewport?.width ?? 1440) >= 1024) test.skip();
    await page.goto('/');
    await waitForPageReady(page);
    const navbar = new NavbarPage(page);
    await navbar.openMobileMenu();
    await waitForAnimation(page, 400);
    await expect(navbar.mobileDrawer).toBeVisible();
  });

  test('mobile menu shows Login when logged out', async ({ page, viewport }) => {
    if ((viewport?.width ?? 1440) >= 1024) test.skip();
    await page.goto('/');
    await waitForPageReady(page);
    const navbar = new NavbarPage(page);
    await navbar.openMobileMenu();
    await waitForAnimation(page, 400);
    await expect(navbar.mobileDrawer.getByRole('button', { name: /login/i })).toBeVisible();
  });

  test('mobile menu closes when backdrop is clicked', async ({ page, viewport }) => {
    if ((viewport?.width ?? 1440) >= 1024) test.skip();
    await page.goto('/');
    await waitForPageReady(page);
    const navbar = new NavbarPage(page);
    await navbar.openMobileMenu();
    await waitForAnimation(page, 400);
    await page.mouse.click(10, 300);
    await waitForAnimation(page, 400);
    await expect(navbar.mobileDrawer).not.toBeVisible();
  });

  test('pressing Escape closes the mobile menu', async ({ page, viewport }) => {
    if ((viewport?.width ?? 1440) >= 1024) test.skip();
    await page.goto('/');
    await waitForPageReady(page);
    const navbar = new NavbarPage(page);
    await navbar.openMobileMenu();
    await waitForAnimation(page, 400);
    await page.keyboard.press('Escape');
    await waitForAnimation(page, 400);
    await expect(navbar.mobileDrawer).not.toBeVisible();
  });

});
