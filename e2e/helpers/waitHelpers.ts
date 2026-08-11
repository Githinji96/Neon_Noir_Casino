import { Page } from '@playwright/test';

/**
 * Wait for Framer Motion animations to settle (default transition is ~300 ms).
 * Pass a longer delay for spring-based animations if needed.
 */
export async function waitForAnimation(page: Page, ms = 400): Promise<void> {
  await page.waitForTimeout(ms);
}

/**
 * Dismiss any full-screen loading spinners before interacting with the page.
 * Keeps tests from flaking while the auth store initialises.
 */
export async function waitForPageReady(page: Page, timeout = 8_000): Promise<void> {
  // Wait until the spinning loader (border-t-transparent) is gone
  await page
    .locator('[class*="animate-spin"]')
    .first()
    .waitFor({ state: 'hidden', timeout })
    .catch(() => {
      /* No spinner visible — page is already ready */
    });
}

/**
 * Scroll to the bottom of the page so lazy-rendered sections (e.g. Footer)
 * enter the viewport and become visible.
 */
export async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
}

/**
 * Measure horizontal overflow — returns true when the page body is wider than
 * the viewport (horizontal scroll bar would appear).
 */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}
