import { Page, Locator } from '@playwright/test';

/**
 * Page-Object for the Login page (route "/auth/login").
 */
export class LoginPage {
  readonly page: Page;

  readonly heading:       Locator;
  readonly emailInput:    Locator;
  readonly passwordInput: Locator;
  readonly rememberMe:    Locator;
  readonly forgotPwLink:  Locator;
  readonly signInBtn:     Locator;
  readonly googleBtn:     Locator;
  readonly appleBtn:      Locator;
  readonly signUpLink:    Locator;
  readonly serverError:   Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading       = page.getByRole('heading', { name: /welcome back/i });
    this.emailInput    = page.getByPlaceholder('player@example.com');
    this.passwordInput = page.getByPlaceholder('Enter your password');
    this.rememberMe    = page.getByRole('checkbox');
    this.forgotPwLink  = page.getByRole('link', { name: /forgot password/i });
    this.signInBtn     = page.getByRole('button', { name: /^sign in$/i });
    this.googleBtn     = page.getByRole('button', { name: /google/i });
    this.appleBtn      = page.getByRole('button', { name: /apple/i });
    this.signUpLink    = page.getByRole('link', { name: /sign up/i });
    this.serverError   = page.locator('[class*="AuthAlert"]').first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/auth/login');
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInBtn.click();
  }
}
