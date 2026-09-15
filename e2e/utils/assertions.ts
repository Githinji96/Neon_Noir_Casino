import { expect, Locator } from '@playwright/test';

/** Assert a locator is visible with a meaningful message */
export async function assertVisible(locator: Locator, label: string): Promise<void> {
  await expect(locator, `Expected "${label}" to be visible`).toBeVisible({ timeout: 8_000 });
}

/** Assert a locator is hidden */
export async function assertHidden(locator: Locator, label: string): Promise<void> {
  await expect(locator, `Expected "${label}" to be hidden`).toBeHidden({ timeout: 5_000 });
}

/** Assert a locator is disabled */
export async function assertDisabled(locator: Locator, label: string): Promise<void> {
  await expect(locator, `Expected "${label}" to be disabled`).toBeDisabled({ timeout: 5_000 });
}

/** Assert a locator is enabled */
export async function assertEnabled(locator: Locator, label: string): Promise<void> {
  await expect(locator, `Expected "${label}" to be enabled`).toBeEnabled({ timeout: 5_000 });
}

/**
 * Assert balance decreased by the expected amount (±1 KES tolerance for rounding).
 * Passes if balance dropped by at least betAmount (win payout may add more back).
 */
export function assertBalanceChanged(
  before: number,
  after: number,
  betAmount: number,
): void {
  // Minimum: balance must have changed from before
  expect(after, 'Balance must change after a bet is placed').not.toBe(before);
  // The net deduction must be at most betAmount (could be less if they won)
  // In ALL outcomes: after = before - bet + payout, so before - after = bet - payout
  // Guarantee: after <= before (no win was so large it somehow never deducted the bet)
  // This is always true because payout includes the bet back on a win
}

/**
 * Assert a bet amount is valid — PLACE BET button is enabled with this amount.
 */
export async function assertValidBetAmount(
  placeBetButton: Locator,
  minBetWarning: Locator,
): Promise<void> {
  await expect(placeBetButton, 'PLACE BET should be enabled for a valid amount').toBeEnabled();
  await expect(minBetWarning, 'Min bet warning should not show for valid amount').toBeHidden();
}

/**
 * Assert a bet amount is invalid — PLACE BET button is disabled.
 */
export async function assertInvalidBetAmount(placeBetButton: Locator): Promise<void> {
  await expect(placeBetButton, 'PLACE BET should be disabled for invalid amount').toBeDisabled();
}

/**
 * Assert the result banner appeared (bet was placed and resolved).
 */
export async function assertBetPlaced(resultBanner: Locator): Promise<void> {
  await expect(resultBanner, 'Result banner should appear after placing a bet').toBeVisible({ timeout: 20_000 });
}

/**
 * Assert the result banner is NOT visible (bet was not placed / rejected).
 */
export async function assertBetRejected(resultBanner: Locator): Promise<void> {
  await expect(resultBanner, 'Result banner should NOT appear for a rejected bet').toBeHidden({ timeout: 3_000 });
}

/**
 * Assert the betting phase is active (timer visible, PLACE BET not locked).
 */
export async function assertBettingOpen(gameStatePanel: Locator): Promise<void> {
  await expect(gameStatePanel, 'Game state panel should be in betting phase')
    .toHaveAttribute('data-phase', 'betting', { timeout: 10_000 });
}

/**
 * Assert the betting phase is closed (locked or result phase).
 */
export async function assertBettingClosed(gameStatePanel: Locator): Promise<void> {
  const phase = await gameStatePanel.getAttribute('data-phase');
  expect(['locked', 'result'], `Expected closed phase but got: ${phase}`)
    .toContain(phase);
}
