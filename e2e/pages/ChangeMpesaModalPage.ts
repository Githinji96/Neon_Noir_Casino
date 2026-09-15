import { Page, Locator } from '@playwright/test';

/**
 * Page-Object for the Change M-Pesa Number modal.
 */
export class ChangeMpesaModalPage {
  readonly page: Page;

  readonly modal:           Locator;
  readonly heading:         Locator;
  readonly closeBtn:        Locator;
  readonly currentPhoneRow: Locator;
  readonly newPhoneInput:   Locator;
  readonly confirmPhoneInput: Locator;
  readonly passwordInput:   Locator;
  readonly showHideToggle:  Locator;
  readonly submitBtn:       Locator;
  readonly cancelBtn:       Locator;
  readonly errorMsg:        Locator;
  readonly successBanner:   Locator;

  constructor(page: Page) {
    this.page = page;

    this.modal   = page.locator('[role="dialog"]').filter({ hasText: /change m-pesa number/i });
    this.heading = this.modal.locator('h2').filter({ hasText: /change m-pesa number/i });
    this.closeBtn = this.modal.getByRole('button').filter({ hasText: '✕' });

    this.currentPhoneRow  = this.modal.locator('div').filter({ hasText: /current m-pesa number/i }).first();
    this.newPhoneInput    = this.modal.locator('#mpesa-new-phone');
    this.confirmPhoneInput = this.modal.locator('#mpesa-confirm-phone');
    this.passwordInput    = this.modal.locator('#mpesa-current-password');
    this.showHideToggle   = this.modal.getByRole('button', { name: /show password|hide password/i });
    this.submitBtn        = this.modal.getByRole('button', { name: /update number/i });
    this.cancelBtn        = this.modal.getByRole('button', { name: /cancel/i });

    // Error is shown inside a red alert div
    this.errorMsg    = this.modal.locator('[role="alert"]').first();
    this.successBanner = this.modal.locator('p').filter({ hasText: /number updated/i });
  }

  async waitForVisible(): Promise<void> {
    await this.modal.waitFor({ state: 'visible', timeout: 5_000 });
  }

  async close(): Promise<void> {
    await this.closeBtn.click();
    await this.modal.waitFor({ state: 'hidden', timeout: 3_000 });
  }
}
