# Requirements Document

## Introduction

This feature delivers a complete Playwright + TypeScript end-to-end (E2E) test suite for the Neon Noir Casino web application (React + TypeScript + Vite, Supabase backend). The suite validates the UI of every major page and feature using the Page Object Model (POM) pattern, reusable helpers and fixtures, stable `data-testid` locators, and CI/CD-ready configuration. Coverage spans: Home, Slot Game, Live Tables, Jackpots, VIP, Settings/Account, Deposit/Withdraw, Notifications, Footer/Legal/Support, Responsiveness, and Accessibility/UX.

## Glossary

- **System**: The Playwright test suite and supporting tooling installed under `d:\CasinoGame`.
- **Suite**: All Playwright test files, page objects, fixtures, and helpers produced by this feature.
- **POM**: Page Object Model — one TypeScript class per page/component encapsulating locators and interactions.
- **BasePage**: Abstract POM base class providing shared navigation, waiting, and assertion helpers.
- **Fixture**: A Playwright `test.extend` fixture that wires POM instances into test context.
- **data-testid**: HTML attribute (`data-testid="…"`) used as the primary locator strategy.
- **Viewport**: A named screen size used for responsive testing (Desktop-1440, Desktop-1366, Tablet-768, Mobile-390).
- **Auth State**: Saved browser storage state (`storageState`) containing a valid user session.
- **CI**: Continuous-integration pipeline (GitHub Actions `.github/workflows/ci.yml`).
- **BaseURL**: The application URL configured in `playwright.config.ts` (default `http://localhost:5173`).
- **Trace**: Playwright trace archive captured on test failure.
- **Screenshot**: Automatic full-page screenshot captured on test failure.

---

## Requirements

### Requirement 1: Project Setup and Playwright Installation

**User Story:** As a developer, I want Playwright + TypeScript installed and configured in the existing project, so that I can run the test suite with a single command.

#### Acceptance Criteria

1. THE System SHALL install `@playwright/test` and `playwright` as dev-dependencies using an exact version pinned in `package.json`.
2. WHEN the command `npx playwright install` is run, THE System SHALL install Chromium, Firefox, and WebKit browsers.
3. THE System SHALL create a `playwright.config.ts` file at the project root that defines `baseURL`, a `testDir` pointing to `tests/e2e`, at least three named projects (`chromium`, `firefox`, `webkit`), `retries: 1` for CI, screenshot capture on failure, and trace capture on first retry.
4. THE System SHALL add `test:e2e` and `test:e2e:headed` entries to the `scripts` section of `package.json` so that `npm run test:e2e` runs the full suite headless.
5. THE System SHALL create a `tests/e2e` directory containing `pages/` (POM classes), `fixtures/` (Playwright fixtures), `helpers/` (reusable utilities), and one spec file per major feature area.
6. WHERE a `data-testid` attribute does not already exist on a UI element, THE System SHALL add the attribute to the relevant React source file so that the test can use a stable locator.

### Requirement 2: Base Page Object and Fixture Infrastructure

**User Story:** As a test author, I want a shared BasePage class and a central fixture file, so that I can write focused tests without repeating navigation or setup logic.

#### Acceptance Criteria

1. THE System SHALL define a `BasePage` class in `tests/e2e/pages/BasePage.ts` that exposes methods: `goto(path)`, `waitForNetworkIdle()`, `takeScreenshot(name)`, and `checkNoHorizontalScroll()`.
2. THE System SHALL define a `fixtures.ts` file in `tests/e2e/fixtures/` that exports a `test` object extending Playwright's base `test` with the following fixture properties: `homePage`, `slotsPage`, `liveTablesPage`, `jackpotsPage`, `vipPage`, `settingsPage`, `depositModal`, `withdrawModal`, `notificationsPage`, `contactPage`, and `navbarComponent`.
3. WHEN a test uses a page-object fixture, THE System SHALL automatically navigate to the correct URL and wait for the page to be ready before the test body executes.
4. THE System SHALL provide an `authFixture` that loads a saved auth storage state from `tests/e2e/fixtures/auth.json` when the file exists, enabling tests that require a logged-in user to reuse an existing session without re-authenticating.
5. IF `tests/e2e/fixtures/auth.json` does not exist, THEN THE System SHALL skip authenticated tests with a descriptive `.skip` message instead of failing.

### Requirement 3: Home Page Tests

**User Story:** As a QA engineer, I want automated tests for the Home page, so that regressions in the casino lobby are caught before release.

#### Acceptance Criteria

1. WHEN the Home page loads at `/`, THE System SHALL assert that the Neon Noir Casino logo/brand text is visible.
2. WHEN the Home page loads, THE System SHALL assert that the main navigation bar contains links for Slots, Live Tables, Jackpots, and VIP.
3. WHEN the Home page loads, THE System SHALL assert that the hero banner heading `UNLEASH THE NEON WIN` is visible.
4. WHEN the Home page loads, THE System SHALL assert that a jackpot amount displaying `KES` is visible on the hero section.
5. WHEN the Home page loads, THE System SHALL assert that the `PLAY NOW` CTA button is present and clickable.
6. WHEN the `SEE ALL` or equivalent scroll trigger is clicked on the Home page, THE System SHALL assert that the page scrolls so that the Popular Choices section is within the viewport.
7. WHEN the Home page loads, THE System SHALL assert that at least four game cards are rendered in the new arrivals or popular choices sections.
8. THE System SHALL assert that the Home page contains no horizontal scroll at the 1440×900 viewport.

### Requirement 4: Slot Game Page Tests

**User Story:** As a QA engineer, I want automated tests for the Slot Game page, so that the core game UI elements are always rendered correctly.

#### Acceptance Criteria

1. WHEN the Slot Machine page loads at `/slot`, THE System SHALL assert that the game title or header is visible.
2. WHEN the Slot Machine page loads, THE System SHALL assert that the balance panel displaying `KES` is visible.
3. WHEN the Slot Machine page loads, THE System SHALL assert that the reel/canvas container element is present in the DOM.
4. WHEN the Slot Machine page loads, THE System SHALL assert that the Spin button is present and not disabled by default for an authenticated user with balance.
5. WHEN the Slot Machine page loads, THE System SHALL assert that auto-spin and turbo-spin controls are present.
6. WHEN the Slot Machine page loads, THE System SHALL assert that bet-amount controls (increase/decrease or a bet selector) are present.
7. WHEN the paytable button is clicked, THE System SHALL assert that the paytable modal or panel becomes visible.
8. THE System SHALL assert that the Slot Machine page renders without horizontal overflow at both 1440×900 and 390×844 viewports.

### Requirement 5: Live Tables Page Tests

**User Story:** As a QA engineer, I want automated tests for the Live Tables page, so that table cards and category filters always render correctly.

#### Acceptance Criteria

1. WHEN the Live Tables page loads at `/live-tables`, THE System SHALL assert that the page heading `Live Casino Tables` is visible.
2. WHEN the Live Tables page loads, THE System SHALL assert that at least one `TableCard` is rendered.
3. WHEN the Live Tables page loads, THE System SHALL assert that category filter buttons for Blackjack, Roulette, Baccarat, and Poker are present.
4. WHEN a category filter button is clicked, THE System SHALL assert that only table cards matching that game type remain visible.
5. WHEN the Live Tables page loads, THE System SHALL assert that each visible table card contains a table name, a status label (`LIVE`, `WAITING`, or `FULL`), and a bet-range display.
6. WHEN a non-full table card's `JOIN TABLE` button is clicked for an unauthenticated user, THE System SHALL assert that an alert message containing `sign in` is displayed.
7. THE System SHALL assert that the Live Tables page has no horizontal overflow at the 1440×900 viewport.

### Requirement 6: Jackpots Page Tests

**User Story:** As a QA engineer, I want automated tests for the Jackpots page, so that progressive jackpot cards always display the correct structure.

#### Acceptance Criteria

1. WHEN the Jackpots page loads at `/jackpots`, THE System SHALL assert that the page heading `Progressive Jackpots` is visible.
2. WHEN the Jackpots page loads, THE System SHALL assert that at least one `JackpotCard` is rendered.
3. WHEN the Jackpots page loads, THE System SHALL assert that each jackpot card contains a jackpot name and an amount displaying `KES`.
4. WHEN the Jackpots page loads, THE System SHALL assert that each jackpot card contains at least one tag label.
5. WHEN the Jackpots page loads, THE System SHALL assert that a `SPIN NOW` button is present on each jackpot card.
6. THE System SHALL assert that the Jackpots page renders without horizontal overflow at 390×844 viewport.

### Requirement 7: VIP Page Tests

**User Story:** As a QA engineer, I want automated tests for the VIP page, so that tier cards, progress bars, and cashback sections always render correctly.

#### Acceptance Criteria

1. WHEN the VIP page loads at `/vip`, THE System SHALL assert that the `VIP CLUB` heading is visible.
2. WHEN the VIP page loads with an authenticated user, THE System SHALL assert that the current VIP level card is visible and displays a tier name.
3. WHEN the VIP page loads with an authenticated user, THE System SHALL assert that the progress bar element is present in the DOM.
4. WHEN the VIP page loads, THE System SHALL assert that the All Tiers section renders at least five tier cards (Bronze, Silver, Gold, Platinum, Diamond).
5. WHEN the VIP page loads with an unauthenticated user, THE System SHALL assert that a `SIGN IN` button is displayed in place of VIP progress.
6. THE System SHALL assert that the VIP page has no horizontal overflow at the 768×1024 viewport.

### Requirement 8: Settings / Account Modal Tests

**User Story:** As a QA engineer, I want automated tests for the Settings modal, so that account info, M-Pesa sections, password fields, and form validation always work correctly.

#### Acceptance Criteria

1. WHEN the settings gear icon is clicked in the Navbar, THE System SHALL assert that the Settings panel slides into view.
2. WHEN the Settings panel is open on the `Account` tab, THE System SHALL assert that the username, email, and balance fields are visible and read-only (not editable input fields).
3. WHEN the Settings panel is open on the `Account` tab, THE System SHALL assert that the registered M-Pesa number section is visible.
4. WHEN the `Change` or `Add Number` button in the M-Pesa section is clicked, THE System SHALL assert that the Change M-Pesa Number modal opens.
5. WHEN the Change M-Pesa modal is open, THE System SHALL assert that the new-number, confirm-number, and password fields are present.
6. WHEN the password show/hide toggle in the Change M-Pesa modal is clicked, THE System SHALL assert that the password field type toggles between `password` and `text`.
7. WHEN the `UPDATE NUMBER` button in the Change M-Pesa modal is clicked with empty fields, THE System SHALL assert that a validation error message is displayed.
8. WHEN the Settings panel is open on the `Security` tab, THE System SHALL assert that the new-password and confirm-password input fields are present.
9. WHEN the Escape key is pressed while the Settings panel is open, THE System SHALL assert that the panel closes.

### Requirement 9: Deposit / Withdraw Modal Tests

**User Story:** As a QA engineer, I want automated tests for the Deposit and Withdrawal modals, so that balance display, amount fields, M-Pesa number, form validation, and modal lifecycle always work correctly.

#### Acceptance Criteria

1. WHEN the `DEPOSIT` button in the Navbar is clicked for an authenticated user, THE System SHALL assert that the Deposit modal opens and the heading `M-PESA DEPOSIT` is visible.
2. WHEN the Deposit modal is open, THE System SHALL assert that the registered M-Pesa phone number is displayed in read-only form.
3. WHEN the Deposit modal is open, THE System SHALL assert that the current balance is displayed.
4. WHEN the Deposit modal amount field is submitted empty, THE System SHALL assert that an error message appears.
5. WHEN the `✕` close button in the Deposit modal is clicked, THE System SHALL assert that the modal closes.
6. WHEN the `WITHDRAW` button in the Navbar is clicked for an authenticated user, THE System SHALL assert that the Withdrawal modal opens and the heading `WITHDRAW` is visible.
7. WHEN the Withdrawal modal is open, THE System SHALL assert that the available balance and withdrawal limits (Min, Max, Daily) are displayed.
8. WHEN the Withdrawal modal amount field is submitted with a value below the minimum (KES 100), THE System SHALL assert that an error message containing `Minimum withdrawal` appears.
9. WHEN the overlay backdrop of the Withdrawal modal is clicked, THE System SHALL assert that the modal closes.

### Requirement 10: Notifications Tests

**User Story:** As a QA engineer, I want automated tests for the notification bell and panel, so that badge, open/close, mark-all-read, and individual notification interactions always work correctly.

#### Acceptance Criteria

1. WHEN the page loads with an authenticated user, THE System SHALL assert that the notification bell icon is visible in the Navbar.
2. WHEN the notification bell is clicked, THE System SHALL assert that the notifications dropdown panel opens.
3. WHEN the notifications panel is open, THE System SHALL assert that it contains either a list of notifications or an empty-state message.
4. WHEN the notifications panel is open and there are unread notifications, THE System SHALL assert that a `Mark all read` button is visible.
5. WHEN the `Mark all read` button is clicked, THE System SHALL assert that the unread badge count decreases or disappears.
6. WHEN the close button within the notifications panel is clicked, THE System SHALL assert that the panel closes.
7. WHEN a click occurs outside the notifications panel, THE System SHALL assert that the panel closes.

### Requirement 11: Footer, Legal Pages, and Support Tests

**User Story:** As a QA engineer, I want automated tests for the footer, privacy policy, terms, and contact form, so that all links, legal pages, and form submissions always work correctly.

#### Acceptance Criteria

1. WHEN the Home page loads, THE System SHALL assert that the Footer is rendered and contains the `NEON NOIR` brand text.
2. WHEN the Home page loads, THE System SHALL assert that the Footer contains links for `Terms & Conditions`, `Privacy Policy`, and `Contact Support`.
3. WHEN the `Privacy Policy` footer link is clicked, THE System SHALL assert that the browser navigates to `/privacy-policy` and the page heading is visible.
4. WHEN the `Terms` footer link is clicked, THE System SHALL assert that the browser navigates to `/terms` and the page heading is visible.
5. WHEN the Contact page loads at `/contact`, THE System SHALL assert that the contact form fields for Name, Email, Subject, and Message are present.
6. WHEN the contact form is submitted with all fields empty, THE System SHALL assert that validation error messages appear for each required field.
7. WHEN the contact form is submitted with a Name shorter than 2 characters, THE System SHALL assert that the Name field error message is displayed.
8. WHEN the contact form is submitted with an invalid email format, THE System SHALL assert that the Email field error message is displayed.
9. WHEN the contact form is filled with valid data and submitted, THE System SHALL assert that a success confirmation containing a ticket ID is displayed.

### Requirement 12: Responsiveness Tests

**User Story:** As a QA engineer, I want automated responsiveness tests across all defined breakpoints, so that layout regressions are caught across device sizes.

#### Acceptance Criteria

1. THE System SHALL run responsiveness tests at the following four named viewport configurations: `Desktop-1440` (1440×900), `Desktop-1366` (1366×768), `Tablet-768` (768×1024), and `Mobile-390` (390×844).
2. WHEN the Home page is tested at `Desktop-1440`, THE System SHALL assert no horizontal scrollbar is present.
3. WHEN the Home page is tested at `Mobile-390`, THE System SHALL assert that the mobile hamburger menu button is visible and the desktop navigation bar is hidden.
4. WHEN the hamburger menu is opened at `Mobile-390`, THE System SHALL assert that a slide-in navigation drawer appears containing at least the Slots, Live Tables, Jackpots, and VIP links.
5. WHEN the Home page is tested at `Mobile-390` for an authenticated user, THE System SHALL assert that the balance display is visible in the Navbar.
6. WHEN the Live Tables page is tested at `Mobile-390`, THE System SHALL assert no horizontal scrollbar is present.
7. WHEN the Jackpots page is tested at `Tablet-768`, THE System SHALL assert no horizontal scrollbar is present.
8. WHEN the VIP page is tested at `Tablet-768`, THE System SHALL assert no horizontal scrollbar is present.

### Requirement 13: Accessibility and UX Tests

**User Story:** As a QA engineer, I want automated accessibility tests, so that keyboard navigation, focus states, tab order, and ARIA labels meet baseline standards.

#### Acceptance Criteria

1. WHEN the Home page is loaded, THE System SHALL assert that the Navbar logo link has a non-empty accessible name (via `href`, text content, or `aria-label`).
2. WHEN the notification bell is focused via keyboard, THE System SHALL assert that the element has a visible focus ring or focus-visible style applied.
3. WHEN the Tab key is pressed on the Home page, THE System SHALL assert that focus moves through interactive elements in a logical order without getting trapped.
4. WHEN the `PLAY NOW` button on the Home page is activated via keyboard (Enter), THE System SHALL assert that the navigation to the slot page occurs.
5. WHEN the Deposit modal is open, THE System SHALL assert that focus is trapped within the modal while it is visible.
6. WHEN the Navbar's mobile hamburger button is rendered, THE System SHALL assert it has `aria-label="Menu"` and `aria-expanded` attribute set correctly.
7. WHEN category filter buttons are rendered on the Live Tables page, THE System SHALL assert that each button is reachable and activatable via keyboard.
8. WHEN the notification bell button is rendered, THE System SHALL assert it has an `aria-label` that includes the word `Notifications`.
