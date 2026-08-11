import { Page, Locator } from '@playwright/test';

/**
 * Page-Object for the site Footer.
 */
export class FooterPage {
  readonly page: Page;

  readonly footer:        Locator;
  readonly brandName:     Locator;
  readonly privacyLink:   Locator;
  readonly termsLink:     Locator;
  readonly contactLink:   Locator;
  readonly responsibleMsg: Locator;
  readonly paymentMethods: Locator;
  readonly ageRestriction: Locator;
  readonly copyright:     Locator;
  readonly newsletterInput: Locator;
  readonly newsletterJoin:  Locator;

  constructor(page: Page) {
    this.page = page;

    this.footer      = page.locator('footer[aria-label="Site footer"]');
    this.brandName   = this.footer.locator('h2').filter({ hasText: /neon noir/i });

    // Link locators — match by text in the footer context
    this.privacyLink  = this.footer.getByRole('link', { name: /privacy policy/i }).first();
    this.termsLink    = this.footer.getByRole('link', { name: /terms/i }).first();
    this.contactLink  = this.footer.getByRole('link', { name: /contact support|help center/i }).first();

    this.responsibleMsg  = this.footer.locator('p').filter({ hasText: /play responsibly/i });
    this.paymentMethods  = this.footer.locator('div').filter({ hasText: /payment methods/i }).first();
    this.ageRestriction  = this.footer.locator('span').filter({ hasText: /18\+/ });
    this.copyright       = this.footer.locator('p').filter({ hasText: /© 2026 neon noir/i });
    this.newsletterInput = this.footer.locator('input[type="email"]');
    this.newsletterJoin  = this.footer.getByRole('button', { name: /join/i });
  }
}
