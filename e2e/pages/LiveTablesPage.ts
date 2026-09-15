import { Page, Locator, expect } from '@playwright/test';

/**
 * Page-Object for the Live Tables lobby (route "/live-tables").
 * Uses data-testid, aria roles, and text-based locators — never nth-child or coords.
 */
export class LiveTablesPage {
  readonly page: Page;

  // ── Page header ───────────────────────────────────────────────────
  readonly heading: Locator;
  readonly liveIndicator: Locator;

  // ── Category filter tabs (keyed by data-testid="filter-<id>") ────
  readonly filterAll:       Locator;
  readonly filterBlackjack: Locator;
  readonly filterRoulette:  Locator;
  readonly filterBaccarat:  Locator;
  readonly filterPoker:     Locator;

  // ── Alert banner ──────────────────────────────────────────────────
  readonly alertBanner: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading       = page.getByRole('heading', { name: /live.*casino.*tables/i });
    this.liveIndicator = page.locator('span').filter({ hasText: /tables live now/i });

    // Use data-testid so apostrophes and special chars in labels can't break the selector
    this.filterAll       = page.getByTestId('filter-all');
    this.filterBlackjack = page.getByTestId('filter-blackjack');
    this.filterRoulette  = page.getByTestId('filter-roulette');
    this.filterBaccarat  = page.getByTestId('filter-baccarat');
    this.filterPoker     = page.getByTestId('filter-poker');

    this.alertBanner = page.locator('div').filter({ hasText: /⚠️/ }).first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/live-tables');
    await this.page.waitForLoadState('networkidle');
  }

  /** All visible JOIN TABLE buttons */
  joinButtons(): Locator {
    return this.page.getByRole('button', { name: /join table/i });
  }

  /**
   * Card element scoped by table ID (data-testid="table-card-<id>").
   * Use ID to avoid apostrophes and special chars in table names.
   */
  tableCardById(tableId: string): Locator {
    return this.page.getByTestId(`table-card-${tableId}`);
  }

  /** Card element by display name — safe for names without apostrophes */
  tableCard(tableName: string): Locator {
    return this.page.locator(`[data-table-name="${tableName}"]`);
  }

  /**
   * JOIN TABLE button located directly by its data-testid on the button element.
   * This is the most reliable selector — no parent chain required.
   */
  joinButtonByTableId(tableId: string): Locator {
    return this.page.getByTestId(`join-table-${tableId}`);
  }

  /** Join by table ID — preferred and most reliable */
  async joinTableById(tableId: string): Promise<void> {
    // Wait for Navbar balance to be non-zero before joining.
    // handleJoin blocks with an alert when balance < minBet.
    await expect(
      this.page.getByTestId('navbar-balance'),
      'Navbar balance must be visible and non-zero before joining a table'
    ).not.toHaveText('KES 0.00', { timeout: 15_000 });

    const btn = this.joinButtonByTableId(tableId);
    await btn.waitFor({ state: 'visible', timeout: 10_000 });
    await btn.click();
  }

  /** Join by display name — uses the button's aria-label set to "Join <tableName>" */
  async joinTable(tableName: string): Promise<void> {
    const btn = this.page.getByRole('button', { name: `Join ${tableName}` });
    await btn.waitFor({ state: 'visible', timeout: 10_000 });
    await btn.click();
  }

  /** Click a filter tab and wait for animation, using data-testid */
  async filterByGame(gameType: 'all' | 'blackjack' | 'roulette' | 'baccarat' | 'poker'): Promise<void> {
    const btn = this.page.getByTestId(`filter-${gameType}`);
    await btn.waitFor({ state: 'attached', timeout: 8_000 });
    await btn.click();
    await this.page.waitForTimeout(350); // let Framer Motion animate
  }

  /** Assert a table card is visible by name */
  async verifyTableVisible(tableName: string): Promise<void> {
    await expect(this.tableCard(tableName)).toBeVisible({ timeout: 8_000 });
  }

  /** Assert dealer name inside a table card */
  async verifyDealer(tableName: string, expectedDealer: string): Promise<void> {
    await expect(this.tableCard(tableName)).toContainText(expectedDealer, { timeout: 5_000 });
  }

  /** Assert the bet range shown on the card */
  async verifyBetRange(tableName: string, minBet: number, maxBet: number): Promise<void> {
    const card = this.tableCard(tableName);
    await expect(card).toContainText(`KES ${minBet}`, { timeout: 5_000 });
    await expect(card).toContainText(maxBet.toLocaleString(), { timeout: 5_000 });
  }

  /** Count visible table cards */
  async getTableCount(): Promise<number> {
    return this.page.locator('[data-testid^="table-card-"]').count();
  }
}
