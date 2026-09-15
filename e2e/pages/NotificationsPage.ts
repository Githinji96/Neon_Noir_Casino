import { Page, Locator } from '@playwright/test';

/**
 * Page-Object for the Notification Bell dropdown + full Notifications page.
 */
export class NotificationsPage {
  readonly page: Page;

  // ── Bell button ───────────────────────────────────────────────────
  readonly bellBtn:      Locator;
  readonly unreadBadge:  Locator;

  // ── Dropdown panel ────────────────────────────────────────────────
  readonly panel:          Locator;
  readonly panelHeading:   Locator;
  readonly markAllReadBtn: Locator;
  readonly closePanelBtn:  Locator;
  readonly viewAllBtn:     Locator;
  readonly emptyState:     Locator;

  // ── Full notifications page (/notifications) ──────────────────────
  readonly pageHeading: Locator;

  constructor(page: Page) {
    this.page = page;

    this.bellBtn     = page.getByRole('button', { name: /^notifications/i });
    this.unreadBadge = this.bellBtn.locator('span').filter({ hasText: /^\d+$/ });

    this.panel        = page.locator('.fixed, .absolute').filter({ hasText: /notifications/i }).last();
    this.panelHeading = this.panel.locator('span').filter({ hasText: /^notifications$/i });
    this.markAllReadBtn = this.panel.getByRole('button', { name: /mark all read/i });
    this.closePanelBtn  = this.panel.getByRole('button', { name: /close/i });
    this.viewAllBtn     = this.panel.getByRole('button', { name: /view all notifications/i });
    this.emptyState     = this.panel.locator('p').filter({ hasText: /no notifications yet/i });

    this.pageHeading = page.getByRole('heading', { name: /notifications/i });
  }

  async openDropdown(): Promise<void> {
    await this.bellBtn.click();
    await this.panel.waitFor({ state: 'visible', timeout: 5_000 });
  }

  async closeDropdown(): Promise<void> {
    await this.closePanelBtn.click();
    await this.panel.waitFor({ state: 'hidden', timeout: 3_000 });
  }
}
