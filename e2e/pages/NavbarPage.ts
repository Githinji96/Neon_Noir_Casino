import { Page, Locator } from '@playwright/test';

/**
 * Page-Object for the sticky Navbar (both desktop and mobile variants).
 */
export class NavbarPage {
  readonly page: Page;

  // ── Logo ──────────────────────────────────────────────────────────
  readonly logoDesktop: Locator;
  readonly logoMobile: Locator;

  // ── Desktop nav links ─────────────────────────────────────────────
  readonly navSlots: Locator;
  readonly navLiveTables: Locator;
  readonly navJackpots: Locator;
  readonly navVIP: Locator;

  // ── Desktop auth buttons ──────────────────────────────────────────
  readonly loginBtn: Locator;
  readonly signUpBtn: Locator;
  readonly depositBtn: Locator;
  readonly withdrawBtn: Locator;

  // ── Balance display ───────────────────────────────────────────────
  readonly balance: Locator;

  // ── Notification bell ─────────────────────────────────────────────
  readonly notificationBell: Locator;

  // ── Settings ──────────────────────────────────────────────────────
  readonly settingsBtn: Locator;

  // ── Mobile hamburger ──────────────────────────────────────────────
  readonly hamburger: Locator;
  readonly mobileDrawer: Locator;

  // ── Mobile quick-nav strip ────────────────────────────────────────
  readonly quickNavSlots: Locator;
  readonly quickNavLiveTables: Locator;
  readonly quickNavJackpots: Locator;
  readonly quickNavVIP: Locator;

  constructor(page: Page) {
    this.page = page;

    // Logo — mobile shows "N·N·C", desktop shows full name
    this.logoDesktop = page.locator('a').filter({ hasText: 'NEON NOIR CASINO' }).first();
    this.logoMobile  = page.locator('a').filter({ hasText: 'N·N·C' }).first();

    // Desktop nav (hidden on < lg)
    this.navSlots      = page.locator('nav ul a').filter({ hasText: /^Slots$/i });
    this.navLiveTables = page.locator('nav ul a').filter({ hasText: /live tables/i });
    this.navJackpots   = page.locator('nav ul a').filter({ hasText: /^jackpots$/i });
    this.navVIP        = page.locator('nav ul a').filter({ hasText: /^vip$/i });

    // Auth buttons
    this.loginBtn    = page.locator('nav').getByRole('button', { name: /login/i }).first();
    this.signUpBtn   = page.locator('nav').getByRole('button', { name: /sign up/i });
    this.depositBtn  = page.locator('nav').getByRole('button', { name: /deposit/i });
    this.withdrawBtn = page.locator('nav').getByRole('button', { name: /withdraw/i });

    // Balance — any span inside the nav that shows "KES"
    this.balance = page.locator('nav span').filter({ hasText: /KES/i }).first();

    // Bell — aria-label contains "Notifications"
    this.notificationBell = page.getByRole('button', { name: /notifications/i });

    // Settings — ⚙️ button (desktop)
    this.settingsBtn = page.locator('nav button').filter({ hasText: '⚙️' });

    // Hamburger — aria-label="Menu"
    this.hamburger    = page.getByRole('button', { name: /^menu$/i });
    this.mobileDrawer = page.locator('.fixed.top-0.right-0').filter({ hasText: 'Neon Noir Casino' });

    // Quick-nav strip links (mobile only)
    this.quickNavSlots      = page.locator('a[href="/slots"]').first();
    this.quickNavLiveTables = page.locator('a[href="/live-tables"]').first();
    this.quickNavJackpots   = page.locator('a[href="/jackpots"]').first();
    this.quickNavVIP        = page.locator('a[href="/vip"]').first();
  }

  async openMobileMenu(): Promise<void> {
    await this.hamburger.click();
  }

  async closeMobileMenuWithX(): Promise<void> {
    // The drawer header has a close ✕ button
    await this.mobileDrawer.getByRole('button').filter({ hasText: '✕' }).click();
  }
}
