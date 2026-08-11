import { Page, Locator } from '@playwright/test';

/**
 * Page-Object for the VIP Club page (route "/vip").
 */
export class VIPPage {
  readonly page: Page;

  readonly heading:        Locator;
  readonly levelCard:      Locator;
  readonly progressBar:    Locator;
  readonly tierCards:      Locator;
  readonly cashbackCard:   Locator;
  readonly earnSection:    Locator;
  readonly signInPrompt:   Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading      = page.getByRole('heading', { name: /vip club/i });
    this.levelCard    = page.locator('main .rounded-2xl').first();
    this.progressBar  = page.locator('.h-3.rounded-full.bg-white\\/10');
    this.tierCards    = page.locator('main .rounded-xl').filter({ hasText: /cashback/i });
    this.cashbackCard = page.locator('main').filter({ hasText: /cashback/i }).first();
    this.earnSection  = page.locator('main').filter({ hasText: /how to earn points/i });
    this.signInPrompt = page.getByRole('button', { name: /sign in/i }).filter({ hasText: /sign in/i });
  }

  async goto(): Promise<void> {
    await this.page.goto('/vip');
  }
}
