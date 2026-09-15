import { Page, Locator } from '@playwright/test';

/**
 * Page-Object for the Casino Lobby (home page, route "/").
 */
export class HomePage {
  readonly page: Page;

  // ── Hero section ──────────────────────────────────────────────────
  readonly heroSection:  Locator;
  readonly heroPlayBtn:  Locator;  // primary CTA inside hero

  // ── New Arrivals section ──────────────────────────────────────────
  readonly newArrivalsSection: Locator;
  readonly seeAllBtn:          Locator;

  // ── Popular Choices section ───────────────────────────────────────
  readonly popularSection: Locator;

  // ── Progressive Jackpots section ─────────────────────────────────
  readonly jackpotSection: Locator;

  constructor(page: Page) {
    this.page = page;

    // Hero — first section on the page containing a play button
    this.heroSection = page.locator('main').first();
    this.heroPlayBtn = page.getByRole('button', { name: /play now|spin now|play/i }).first();

    // New Arrivals
    this.newArrivalsSection = page.locator('section').filter({ hasText: /new arrivals/i }).first();
    this.seeAllBtn          = page.getByRole('button', { name: /see all/i }).first();

    // Popular Choices — the section that contains "Popular"
    this.popularSection = page
      .locator('section, div[id], div[data-section]')
      .filter({ hasText: /popular/i })
      .first();

    // Progressive Jackpots
    this.jackpotSection = page.locator('section').filter({ hasText: /jackpot/i }).first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }
}
