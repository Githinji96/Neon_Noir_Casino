import { Page, Locator } from '@playwright/test';

/**
 * Page-Object for the Live Tables page (route "/live-tables").
 */
export class LiveTablesPage {
  readonly page: Page;

  // ── Page header ───────────────────────────────────────────────────
  readonly heading: Locator;
  readonly liveIndicator: Locator;

  // ── Category filter tabs ──────────────────────────────────────────
  readonly filterAll:        Locator;
  readonly filterBlackjack:  Locator;
  readonly filterRoulette:   Locator;
  readonly filterBaccarat:   Locator;
  readonly filterPoker:      Locator;

  // ── Table cards grid ──────────────────────────────────────────────
  readonly tableCards: Locator;

  // ── Alert banner ──────────────────────────────────────────────────
  readonly alertBanner: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading       = page.getByRole('heading', { name: /live.*casino.*tables/i });
    this.liveIndicator = page.locator('span').filter({ hasText: /tables live now/i });

    // Category buttons are styled pills — locate by text
    this.filterAll       = page.getByRole('button', { name: /^all$/i });
    this.filterBlackjack = page.getByRole('button', { name: /blackjack/i });
    this.filterRoulette  = page.getByRole('button', { name: /roulette/i });
    this.filterBaccarat  = page.getByRole('button', { name: /baccarat/i });
    this.filterPoker     = page.getByRole('button', { name: /poker/i });

    // Table cards — each card has a "Join" button
    this.tableCards = page.locator('main').getByRole('button', { name: /join/i }).locator('..');

    this.alertBanner = page.locator('div').filter({ hasText: /⚠️/ }).first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/live-tables');
  }

  /** Returns all visible "Join" buttons on the page. */
  joinButtons(): Locator {
    return this.page.getByRole('button', { name: /join/i });
  }
}
