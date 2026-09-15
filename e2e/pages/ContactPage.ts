import { Page, Locator } from '@playwright/test';

/**
 * Page-Object for the Contact / Support page (route "/contact").
 */
export class ContactPage {
  readonly page: Page;

  readonly heading:       Locator;
  readonly nameInput:     Locator;
  readonly emailInput:    Locator;
  readonly subjectInput:  Locator;
  readonly messageTextarea: Locator;
  readonly sendBtn:       Locator;
  readonly successBanner: Locator;
  readonly nameError:     Locator;
  readonly emailError:    Locator;
  readonly subjectError:  Locator;
  readonly messageError:  Locator;
  readonly faqItems:      Locator;
  readonly charCounter:   Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading  = page.getByRole('heading', { name: /contact support/i });

    // Use element IDs from the component
    this.nameInput      = page.locator('#name');
    this.emailInput     = page.locator('#email');
    this.subjectInput   = page.locator('#subject');
    this.messageTextarea = page.locator('#message');

    this.sendBtn = page.getByRole('button', { name: /send message/i });

    this.successBanner = page.locator('[role="status"]').filter({ hasText: /message sent successfully/i });

    // Error messages have role="alert" and IDs like name-error, email-error …
    this.nameError    = page.locator('#name-error');
    this.emailError   = page.locator('#email-error');
    this.subjectError = page.locator('#subject-error');
    this.messageError = page.locator('#message-error');

    // FAQ accordion buttons
    this.faqItems   = page.getByRole('button', { name: /how do i/i });
    this.charCounter = page.locator('span').filter({ hasText: /\/2000/ });
  }

  async goto(): Promise<void> {
    await this.page.goto('/contact');
  }

  async fillForm(data: {
    name:    string;
    email:   string;
    subject: string;
    message: string;
  }): Promise<void> {
    await this.nameInput.fill(data.name);
    await this.emailInput.fill(data.email);
    await this.subjectInput.fill(data.subject);
    await this.messageTextarea.fill(data.message);
  }
}
