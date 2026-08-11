import { Page, Locator } from '@playwright/test';

/**
 * Page-Object for the Jackpots page (route "/jackpots").
 */
export class JackpotsPage {
  readonly page: Page;

  readonly heading:      Locator;
  readonly subHeading:   Locator;
  readonly jackpotCards: Locator;
  readonly spinBtns:     Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading    = page.getByRole('heading', { name: /progressive.*jackpots/i });
    this.subHeading = page.locator('p').filter({ hasText: /every bet contributes/i });

    // Each jackpot card is expected to contain a "SPIN NOW" button
    this.spinBtns     = page.getByRole('button', { name: /spin now/i });
    this.jackpotCards = this.spinBtns.locator('../..'); // two levels up as rough parent
  }

  async goto(): Promise<void> {
    await this.page.goto('/jackpots');
  }
}
