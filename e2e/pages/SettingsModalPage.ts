import { Page, Locator } from '@playwright/test';

/**
 * Page-Object for the Settings side-panel.
 * Opened via the ⚙️ button in the navbar (desktop) or mobile menu.
 */
export class SettingsModalPage {
  readonly page: Page;

  readonly panel:          Locator;
  readonly heading:        Locator;
  readonly closeBtn:       Locator;
  readonly saveBtn:        Locator;

  // ── Sidebar tabs ──────────────────────────────────────────────────
  readonly tabAccount:       Locator;
  readonly tabSecurity:      Locator;
  readonly tabGame:          Locator;
  readonly tabNotifications: Locator;
  readonly tabPreferences:   Locator;

  // ── Account tab ───────────────────────────────────────────────────
  readonly changeMpesaBtn: Locator;

  // ── Security tab ──────────────────────────────────────────────────
  readonly newPasswordInput:     Locator;
  readonly confirmPasswordInput: Locator;
  readonly updatePasswordBtn:    Locator;
  readonly passwordValidation:   Locator;

  constructor(page: Page) {
    this.page = page;

    this.panel   = page.locator('[style*="520px"]').filter({ hasText: /SETTINGS/i });
    this.heading = page.locator('h2').filter({ hasText: /settings/i });
    this.closeBtn = this.panel.getByRole('button').filter({ hasText: '✕' }).first();
    this.saveBtn  = page.getByRole('button', { name: /save/i }).filter({ hasText: /save/i });

    // Sidebar buttons by label
    this.tabAccount       = page.getByRole('button', { name: /account/i }).filter({ hasText: /account/i });
    this.tabSecurity      = page.getByRole('button', { name: /security/i });
    this.tabGame          = page.getByRole('button', { name: /game/i });
    this.tabNotifications = page.getByRole('button', { name: /notifications/i }).filter({ hasText: /notifications/i });
    this.tabPreferences   = page.getByRole('button', { name: /preferences/i });

    this.changeMpesaBtn = page.getByRole('button', { name: /change|add number/i });

    // Security tab fields
    this.newPasswordInput     = page.getByLabel(/new password/i);
    this.confirmPasswordInput = page.getByLabel(/confirm password/i);
    this.updatePasswordBtn    = page.getByRole('button', { name: /update password/i });
    this.passwordValidation   = page.locator('p').filter({ hasText: /passwords do not match|min 8/i });
  }

  async open(via: 'desktop' | 'mobile' = 'desktop'): Promise<void> {
    if (via === 'desktop') {
      await this.page.locator('nav button').filter({ hasText: '⚙️' }).click();
    } else {
      // In mobile menu, the Settings row
      await this.page.getByRole('button', { name: /settings/i }).click();
    }
    await this.panel.waitFor({ state: 'visible', timeout: 5_000 });
  }

  async close(): Promise<void> {
    await this.closeBtn.click();
    await this.panel.waitFor({ state: 'hidden', timeout: 3_000 });
  }

  async goToTab(tab: 'account' | 'security' | 'game' | 'notifications' | 'preferences'): Promise<void> {
    const tabMap = {
      account:       this.tabAccount,
      security:      this.tabSecurity,
      game:          this.tabGame,
      notifications: this.tabNotifications,
      preferences:   this.tabPreferences,
    };
    await tabMap[tab].click();
  }
}
