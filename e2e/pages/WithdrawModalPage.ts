import { Page, Locator } from '@playwright/test';

/**
 * Page-Object for the Withdrawal modal.
 */
export class WithdrawModalPage {
  readonly page: Page;

  readonly modal:           Locator;
  readonly heading:         Locator;
  readonly closeBtn:        Locator;
  readonly availableBalance: Locator;
  readonly phoneRow:        Locator;
  readonly amountInput:     Locator;
  readonly requestBtn:      Locator;
  readonly errorMsg:        Locator;
  readonly quickBtns:       Locator;
  readonly limitCards:      Locator;

  // Confirm step
  readonly confirmBtn:      Locator;
  readonly backBtn:         Locator;

  // Success step
  readonly successMessage:  Locator;
  readonly doneBtn:         Locator;

  constructor(page: Page) {
    this.page = page;

    this.modal   = page.locator('.fixed').filter({ hasText: /^withdraw$/i }).first();
    this.heading = page.locator('h2').filter({ hasText: /^withdraw$/i });
    this.closeBtn = this.modal.getByRole('button').filter({ hasText: '✕' }).first();

    this.availableBalance = this.modal.locator('div').filter({ hasText: /available/i }).first();
    this.phoneRow         = this.modal.locator('div').filter({ hasText: /withdraw to/i }).first();
    this.amountInput      = this.modal.locator('input[type="number"]');
    this.requestBtn       = this.modal.getByRole('button', { name: /request withdrawal/i });
    this.errorMsg         = this.modal.locator('div').filter({ hasText: /minimum withdrawal|maximum|insufficient|no verified/i }).first();
    this.quickBtns        = this.modal.locator('button').filter({ hasText: /^(500|1K|5K|10K)$/ });
    this.limitCards       = this.modal.locator('.grid').filter({ hasText: /min/i });

    this.confirmBtn     = this.modal.getByRole('button', { name: /confirm/i });
    this.backBtn        = this.modal.getByRole('button', { name: /back/i });
    this.successMessage = this.modal.locator('p').filter({ hasText: /request submitted/i });
    this.doneBtn        = this.modal.getByRole('button', { name: /done/i });
  }

  /** Open from the navbar WITHDRAW button (desktop). */
  async openFromNavbar(): Promise<void> {
    await this.page.locator('nav').getByRole('button', { name: /^withdraw$/i }).click();
    await this.modal.waitFor({ state: 'visible', timeout: 5_000 });
  }

  async close(): Promise<void> {
    await this.closeBtn.click();
    await this.modal.waitFor({ state: 'hidden', timeout: 3_000 });
  }

  async fillAmount(amount: number | string): Promise<void> {
    await this.amountInput.fill(String(amount));
  }

  async requestWithdrawal(): Promise<void> {
    await this.requestBtn.click();
  }
}
