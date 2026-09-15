import { Page, Locator } from '@playwright/test';

/**
 * Page-Object for the M-PESA Deposit modal.
 */
export class DepositModalPage {
  readonly page: Page;

  readonly modal:       Locator;
  readonly heading:     Locator;
  readonly closeBtn:    Locator;
  readonly phoneRow:    Locator;
  readonly amountInput: Locator;
  readonly submitBtn:   Locator;
  readonly errorMsg:    Locator;
  readonly quickBtns:   Locator;  // 100 / 500 / 1K / 5K
  readonly balanceRow:  Locator;

  constructor(page: Page) {
    this.page = page;

    this.modal    = page.locator('.fixed').filter({ hasText: /m-pesa deposit/i });
    this.heading  = page.locator('h2').filter({ hasText: /m-pesa deposit/i });
    this.closeBtn = this.modal.getByRole('button').filter({ hasText: '✕' });

    this.phoneRow    = this.modal.locator('div').filter({ hasText: /deposit to/i }).first();
    this.amountInput = this.modal.locator('input[type="number"]');
    this.submitBtn   = this.modal.getByRole('button', { name: /deposit via m-pesa/i });
    this.errorMsg    = this.modal.locator('div').filter({ hasText: /minimum deposit|maximum deposit|no m-pesa/i });
    this.quickBtns   = this.modal.locator('button').filter({ hasText: /^(100|500|1K|5K)$/ });
    this.balanceRow  = this.modal.locator('div').filter({ hasText: /current balance/i });
  }

  /** Open the modal from the desktop navbar DEPOSIT button. */
  async openFromNavbar(): Promise<void> {
    await this.page.locator('nav').getByRole('button', { name: /^deposit$/i }).click();
    await this.modal.waitFor({ state: 'visible', timeout: 5_000 });
  }

  async close(): Promise<void> {
    await this.closeBtn.click();
    await this.modal.waitFor({ state: 'hidden', timeout: 3_000 });
  }

  async fillAmount(amount: number | string): Promise<void> {
    await this.amountInput.fill(String(amount));
  }

  async submit(): Promise<void> {
    await this.submitBtn.click();
  }
}
