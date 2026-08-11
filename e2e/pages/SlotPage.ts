import { Page, Locator } from '@playwright/test';

/**
 * Page-Object for the Slot Machine page (route "/slot").
 */
export class SlotPage {
  readonly page: Page;

  // ── Back button ───────────────────────────────────────────────────
  readonly backBtn: Locator;

  // ── Game title ────────────────────────────────────────────────────
  readonly gameTitle: Locator;

  // ── Balance / win display panel ───────────────────────────────────
  readonly winDisplay: Locator;

  // ── Reel canvas ───────────────────────────────────────────────────
  readonly reelCanvas: Locator;

  // ── Spin button ───────────────────────────────────────────────────
  readonly spinBtn: Locator;

  // ── Auto / Turbo controls ─────────────────────────────────────────
  readonly autoBtn:  Locator;
  readonly turboBtn: Locator;

  // ── Bet controls ──────────────────────────────────────────────────
  readonly betSection: Locator;

  // ── Paytable button ───────────────────────────────────────────────
  readonly paytableBtn: Locator;

  // ── Paytable modal ────────────────────────────────────────────────
  readonly paytableModal: Locator;

  // ── Loading overlay ───────────────────────────────────────────────
  readonly loadingScreen: Locator;

  constructor(page: Page) {
    this.page = page;

    this.backBtn    = page.getByRole('button', { name: /← lobby|lobby/i });
    this.gameTitle  = page.locator('h1').first();
    this.winDisplay = page.locator('[class*="WinDisplay"], main .shrink-0').first();
    this.reelCanvas = page.locator('canvas').first();

    // Spin / Auto / Turbo live inside SpinControls
    this.spinBtn  = page.getByRole('button', { name: /^spin$|spin/i }).first();
    this.autoBtn  = page.getByRole('button', { name: /auto/i }).first();
    this.turboBtn = page.getByRole('button', { name: /turbo/i }).first();

    this.betSection  = page.locator('main').locator('text=BET').locator('..').first();
    this.paytableBtn = page.getByRole('button', { name: /paytable/i });

    this.paytableModal = page.locator('[class*="PaytableModal"], .fixed.inset-0').filter({
      hasText: /paytable/i,
    });

    this.loadingScreen = page.locator('text=LOADING...').first();
  }

  /** Navigate to the slot page via state (mirrors how the app navigates internally). */
  async goto(): Promise<void> {
    await this.page.goto('/slot');
  }

  /** Wait for the 1-second loading overlay to disappear. */
  async waitForLoad(): Promise<void> {
    await this.loadingScreen.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  }
}
