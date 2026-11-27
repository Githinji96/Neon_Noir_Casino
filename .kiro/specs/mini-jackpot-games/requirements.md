# Requirements Document

## Introduction

This specification covers the integration of Mini Jackpot Games into the existing Jackpots page of the Neon Noir Casino application. The goal is to unify Progressive Jackpots and a new set of six mini jackpot games under the existing `/jackpots` route, without creating a separate navigation item or URL for Mini Games.

The application is a React + TypeScript single-page app using Zustand for state management, Supabase as the backend (PostgreSQL database, auth, and edge functions), and an existing secure wallet architecture with `SECURITY DEFINER` RPCs for all financial operations. Mini games must reuse this infrastructure: server-generated outcomes, atomic balance updates, idempotency protection, and audit-logged history. The frontend must never determine or manipulate game outcomes.

Each of the six mini games (Neon Lucky Wheel, Neon Scratch Cards, Cyber Treasure Chest, Mini Slot Jackpot, Mystery Multiplier, and Crystal Match) will be individually configured by admins and exposed as playable cards only when fully implemented. Unimplemented games display a COMING SOON status. All financial flows use the existing `apply_spin_result` RPC pattern or an equivalent atomic, idempotent server transaction.

## Glossary

- **System**: The Neon Noir Casino web application — React frontend, Supabase backend, and edge functions
- **Jackpots_Page**: The existing page component rendered at `/jackpots` containing Progressive Jackpots and the new Mini Jackpot Games section
- **Progressive_Jackpots**: The existing five progressive jackpots: Mega Moolah Noir, Electric Pulse, Crystal Vault, Shadow Fortune, and Neon Nexus
- **Mini_Games**: The six new mini jackpot games: Neon Lucky Wheel, Neon Scratch Cards, Cyber Treasure Chest, Mini Slot Jackpot, Mystery Multiplier, and Crystal Match
- **Mini_Game_Card**: The card component that displays a mini game on the Jackpots page with artwork, title, description, category badge, bet limits, and a PLAY NOW or COMING SOON status
- **Game_View**: The modal, nested route, or overlay that renders an active mini game when a player clicks PLAY NOW
- **Wallet_Service**: The existing wallet and transaction ledger using the `profiles.balance` column, `transactions` table, `casino_ledger_entries` table, and `SECURITY DEFINER` RPCs for atomic balance updates
- **Game_Engine**: The server-side outcome generation logic (Supabase RPCs or edge functions) that determines game results — never the frontend
- **Admin_Panel**: The existing admin interface under `/admin/games` for configuring game settings
- **Admin_Game_Config**: The existing `admin_game_config` database table storing per-game configuration: enabled status, min/max bet, volatility
- **Mini_Game_Config**: A new database table (or extension of `admin_game_config`) storing per-mini-game configuration: enabled status, min/max bet, prize tiers, payout multipliers, outcome probabilities, maintenance status, and game-specific rules
- **Round_ID**: A unique identifier generated per game round to enforce idempotency and prevent duplicate debits or payouts
- **Player**: An authenticated user with a valid Supabase session
- **RNG**: Random Number Generation — server-side only, using cryptographically secure methods
- **RTP**: Return to Player — the configured percentage of total wagers that a game pays back over time
- **Idempotency_Key**: A unique identifier sent with each game round request that allows the server to detect and reject duplicate submissions

## Requirements

### Requirement 1: Jackpots Page Structure

**User Story:** As a player, I want to access both Progressive Jackpots and Mini Jackpot Games on a single page, so that I can browse all jackpot games without navigating to different URLs.

#### Acceptance Criteria

1. THE System SHALL render the Jackpots_Page at the existing `/jackpots` route without changing the route path or adding new top-level navigation items
2. THE System SHALL display the Progressive_Jackpots section as Section A on the Jackpots_Page
3. THE System SHALL display a new Mini_Games section on the Jackpots_Page directly below the Progressive_Jackpots section, with the section heading titled "MINI JACKPOT GAMES" and the subtitle "Quick games. Instant reveals. Exciting prizes." displayed directly beneath the heading
4. THE System SHALL preserve all five existing Progressive_Jackpots: Mega Moolah Noir, Electric Pulse, Crystal Vault, Shadow Fortune, and Neon Nexus
5. THE System SHALL retain the existing Progressive_Jackpots jackpot amounts, frequency badges, game mappings, and SPIN NOW actions
6. THE System SHALL remove all BUILDING labels, progress bars, percentages, and target amount sections from the Progressive_Jackpots display
7. THE System SHALL maintain the existing Neon Noir visual design for the Progressive_Jackpots section
8. WHEN the Player clicks a Progressive_Jackpot's SPIN NOW action, THE System SHALL navigate the Player to that jackpot's corresponding slot game
9. THE System SHALL render the Progressive_Jackpots card layout with no horizontal overflow on desktop, tablet, and mobile viewport widths

### Requirement 2: Mini Game Card Design

**User Story:** As a player, I want each mini game displayed as a consistent card with clear information and actions, so that I can quickly understand and start available games.

#### Acceptance Criteria

1. THE System SHALL render each Mini_Game as a Mini_Game_Card with a shared layout containing game artwork or a Neon Noir-themed icon, game title, description, compact category badge, minimum and maximum bet amounts, and an action button
2. THE System SHALL display on each Mini_Game_Card: game artwork or a Neon Noir-themed icon, game title, a description of 100 characters or fewer, a compact category badge, minimum and maximum bet amounts, and an action button labeled either PLAY NOW or COMING SOON
3. THE System SHALL source the minimum and maximum bet amounts displayed on each Mini_Game_Card from the actual Mini_Game_Config in the database, not from hardcoded values
4. IF a Mini_Game has Mini_Game_Config enabled status set to true and has Game_Engine integration for outcome handling and payout, THEN THE System SHALL display a PLAY NOW button on its Mini_Game_Card
5. IF a Mini_Game has Mini_Game_Config enabled status set to false or lacks Game_Engine integration, THEN THE System SHALL display a COMING SOON status on its Mini_Game_Card and SHALL NOT display a playable button
6. THE System SHALL use black backgrounds, neon gold and yellow buttons, purple accents, and cyan highlights consistent with the existing Neon Noir branding
7. THE System SHALL maintain consistent card heights across all Mini_Game_Cards within the same grid row such that no card is taller than any other card in the same row
8. THE System SHALL use compact category badges with the following per-game mapping: Neon Lucky Wheel = INSTANT WIN, Neon Scratch Cards = INSTANT WIN, Cyber Treasure Chest = INSTANT WIN, Mini Slot Jackpot = MINI SLOTS, Mystery Multiplier = MULTIPLIER, Crystal Match = INSTANT WIN
9. THE System SHALL render Mini_Game_Cards in a responsive grid: 1 column on viewports 767 pixels wide or narrower, 2 columns on viewports 768 to 1023 pixels wide, and 3 or more columns on viewports 1024 pixels wide or wider
10. IF Mini_Game_Config data fails to load for a Mini_Game_Card, THEN THE System SHALL display an error state indicating configuration is unavailable and SHALL NOT display playable bet amounts or a PLAY NOW button

### Requirement 3: Game Launch and Navigation

**User Story:** As a player, I want to launch a mini game from its card and return to the Jackpots page after playing, so that I can seamlessly browse and play multiple games.

#### Acceptance Criteria

1. WHEN the Player clicks PLAY NOW on a Mini_Game_Card, THE System SHALL open the selected game in a Game_View using the application's existing routing and modal conventions
2. WHILE the Game_View is open, THE System SHALL provide a visible and operable close or back action that returns the Player to the `/jackpots` route
3. WHILE the Player navigates between the Jackpots_Page and a Game_View, THE System SHALL preserve in-progress round state such that the round remains resumable without allowing a round to be played or paid twice
4. WHILE a mini game round is in progress, THE System SHALL disable the round initiation control to prevent the Player from initiating additional rounds simultaneously
5. WHILE the viewport is 390 pixels wide or narrower, THE System SHALL ensure game controls fit the viewport without horizontal overflow
6. THE System SHALL NOT create a separate top-level navigation item for Mini_Games
7. THE System SHALL ensure all existing links to `/jackpots` remain functional and the `/jackpots` route remains accessible
8. WHEN the Player closes a Game_View while a round is in progress, THE System SHALL complete or cancel the in-progress round without producing a duplicate debit or payout

### Requirement 4: Neon Lucky Wheel

**User Story:** As a player, I want to spin an animated wheel with prize segments, so that I can see my result and any payout.

#### Acceptance Criteria

1. WHEN the Player launches Neon Lucky Wheel, THE System SHALL display an animated spinning wheel with 2 to 20 configurable prize segments sourced from Mini_Game_Config
2. WHEN the Player places a valid bet and initiates a spin, THE System SHALL debit the stake from the Player's wallet exactly once using the Wallet_Service
3. WHEN the spin completes, THE System SHALL generate the outcome on the server using the Game_Engine, not in frontend JavaScript
4. THE System SHALL support configurable bet limits, multipliers, and prize tiers sourced from Mini_Game_Config
5. WHEN the Player places a bet, THE System SHALL display the Player's selected bet before starting the round and SHALL display the final result after the round completes
6. IF the Player attempts to spin while a round is already in progress, THEN THE System SHALL reject the duplicate request and SHALL NOT debit an additional stake
7. WHEN the spin completes, THE System SHALL display the spin result and payout to the Player
8. IF the stake debit fails or is not confirmed, THEN THE System SHALL not initiate the spin and SHALL preserve the Player's wallet balance

### Requirement 5: Neon Scratch Cards

**User Story:** As a player, I want to scratch a card to reveal a prize, so that I can see if I won.

#### Acceptance Criteria

1. WHEN the Player launches Neon Scratch Cards, THE System SHALL display an interactive scratch-to-reveal card with a design sourced from Mini_Game_Config
2. WHEN the Player places a valid bet and starts a scratch round, THE System SHALL debit the stake from the Player's wallet exactly once using the Wallet_Service at round start, before the reveal interaction begins
3. WHEN the Player has scratched more than 50 percent of the card surface area, THE System SHALL display the result and any winnings to the Player
4. WHEN the Player starts a scratch round, THE System SHALL generate the card outcome on the server using the Game_Engine before the reveal interaction, not in frontend JavaScript
5. IF the Player has already claimed the result on a specific card, THEN THE System SHALL reject additional reveal or payout requests for that card
6. THE System SHALL support at least 2 card designs and configurable prize tiers sourced from Mini_Game_Config
7. IF the stake debit fails or is not confirmed, THEN THE System SHALL block the reveal interaction and SHALL NOT generate a card outcome

### Requirement 6: Cyber Treasure Chest

**User Story:** As a player, I want to select a treasure chest and see what prize it contains, so that I can win a payout.

#### Acceptance Criteria

1. WHEN the Player launches Cyber Treasure Chest, THE System SHALL display 2 to 10 treasure chests sourced from Mini_Game_Config
2. WHEN the Player places a valid bet, THE System SHALL debit the stake from the Player's wallet exactly once using the Wallet_Service before allowing chest selection
3. IF the stake debit fails or is not confirmed, THE System SHALL block chest selection until the debit is successfully confirmed
4. WHEN the Player selects a chest, THE System SHALL reveal the predetermined outcome that the Game_Engine generated on the server when the bet was placed
5. THE System SHALL support configured prize amounts and losing outcomes sourced from Mini_Game_Config
6. WHEN the Player has selected one chest, THE System SHALL prevent the Player from selecting additional chests to claim multiple prizes in the same round
7. WHEN the Player selects a chest, THE System SHALL display the outcome and any winnings to the Player
8. IF the server fails to return the predetermined outcome when the Player selects a chest, THEN THE System SHALL display an error message indicating the outcome could not be retrieved and SHALL allow the Player to retry the chest selection without an additional stake debit

### Requirement 7: Mini Slot Jackpot

**User Story:** As a player, I want to play a compact three-reel slot game, so that I can match symbols and win payouts.

#### Acceptance Criteria

1. WHEN the Player launches Mini Slot Jackpot, THE System SHALL display a three-reel slot interface with symbols, paylines, and prize combinations that fits within the Game_View without scrolling
2. WHEN the Player places a bet within the configured minimum and maximum from Mini_Game_Config and within the available balance, and initiates a spin, THE System SHALL debit the stake from the Player's wallet exactly once using the Wallet_Service
3. WHEN the spin completes, THE System SHALL generate the reel outcome on the server using the Game_Engine and SHALL display the winning combination and payout for winning outcomes or a no-win indication for non-matching outcomes
4. WHERE wild symbols or bonus symbols are enabled in the Mini_Game_Config, THE System SHALL treat wild symbols as substituting for other symbols and SHALL treat bonus symbols as triggering bonus outcomes, with each feature independently enabled or disabled
5. THE System SHALL use configurable prize combinations sourced from Mini_Game_Config
6. THE System SHALL display the Player's selected bet before starting the round
7. IF the stake debit fails or is not confirmed, THEN THE System SHALL not initiate the spin and SHALL preserve the Player's wallet balance
8. IF the bet is outside the configured minimum, maximum, or available balance, THEN THE System SHALL reject the bet and SHALL not initiate the spin
9. IF the Player attempts to spin while a round is already in progress, THEN THE System SHALL reject the duplicate request

### Requirement 8: Mystery Multiplier

**User Story:** As a player, I want to play a short multiplier game with visible rules, so that I can understand my potential payout before playing.

#### Acceptance Criteria

1. WHEN the Player launches Mystery Multiplier, THE System SHALL display the game rules, possible multiplier values, payout formula, and minimum and maximum bet limits before the Player starts a round
2. WHEN the Player places a bet within the configured minimum and maximum from Mini_Game_Config and within the available balance, and starts a round, THE System SHALL debit the stake from the Player's wallet exactly once using the Wallet_Service
3. WHEN the round completes, THE System SHALL generate the multiplier outcome on the server using the Game_Engine and SHALL display the final multiplier and calculated payout
4. THE System SHALL use configurable multipliers and outcome probabilities sourced from Mini_Game_Config
5. THE System SHALL display the final multiplier, stake, and gross payout after each round such that the payout calculation is observable: final multiplier multiplied by stake equals gross payout
6. IF the stake debit fails or is not confirmed, THEN THE System SHALL not generate an outcome, SHALL preserve the Player's wallet balance, and SHALL display an error indicating the round could not be started

### Requirement 9: Crystal Match

**User Story:** As a player, I want to play a crystal-matching game, so that I can match symbols and verify my outcome.

#### Acceptance Criteria

1. WHEN the Player launches Crystal Match, THE System SHALL display a grid of crystal symbols sourced from Mini_Game_Config with predefined symbol combinations
2. WHEN the Player places a valid bet and starts a round, THE System SHALL debit the stake from the Player's wallet exactly once using the Wallet_Service
3. WHEN the round completes, THE System SHALL generate the match outcome on the server using the Game_Engine and SHALL display the matched symbols, prize tier achieved, and calculated payout
4. THE System SHALL use predefined symbol combinations and prize tiers sourced from Mini_Game_Config
5. WHEN the Player launches Crystal Match, THE System SHALL display the gameplay rules before play, including the minimum matching symbols required, prize tiers, and payout calculation method
6. WHEN a round completes, THE System SHALL display the Round_ID, final symbol arrangement, matched combinations, and payout amount to the Player so that outcomes are verifiable
7. IF the Player attempts to start a round while a round is already in progress, THEN THE System SHALL reject the duplicate request and SHALL NOT debit an additional stake

### Requirement 10: Player Wallet and Financial Integrity

**User Story:** As a player, I want all my mini game stakes and payouts to use the existing secure wallet system, so that my balance is accurate and protected from fraud.

#### Acceptance Criteria

1. THE System SHALL integrate every playable Mini_Game with the existing Wallet_Service and transaction ledger
2. WHEN the Player opens a Mini_Game, THE System SHALL display the current Player balance and selected bet before starting a round
3. WHEN the Player submits a bet, THE System SHALL validate the bet against the configured minimum, configured maximum, and available balance before accepting the round, SHALL reject a zero-value stake as an invalid bet before the round starts, and SHALL display an error indication with zero balance change for rejected bets
4. WHEN a round is accepted, THE System SHALL debit the stake exactly once from the Player's balance using an atomic transaction
5. THE System SHALL generate all game outcomes on the server using the Game_Engine and SHALL NOT expose RNG state, outcome precomputation, or payout calculation to the frontend
6. THE System SHALL calculate all payouts using the configured game rules stored in Mini_Game_Config
7. WHEN a round results in a win outcome with a non-zero payout amount determined by the Game_Engine, THE System SHALL credit the payout to the Player's balance exactly once using an atomic transaction
8. THE System SHALL use atomic transactions to prevent partial wallet updates where a debit occurs but a credit does not
9. THE System SHALL implement idempotency and duplicate-request protection for bets, reveals, spins, and payouts using a Round_ID or Idempotency_Key
10. THE System SHALL store in game history for each round: a unique Round_ID, Player ID, game ID, stake amount, outcome, payout amount, and timestamp
11. WHEN a network failure or retry occurs, THE System SHALL respond with an error indication if the round was not processed or SHALL return the original round result if the round was already processed, without creating duplicate debits or payouts
12. IF a player attempts to manipulate outcomes through browser developer tools or modified network requests, THEN THE System SHALL reject the manipulation and SHALL NOT alter the game outcome or payout
13. THE System SHALL NOT alter existing Player balances, Progressive_Jackpots balances, progressive jackpot contributions, existing RNG logic, existing RTP calculations, or unrelated financial logic as part of this integration
14. IF the stake debit succeeds but the payout credit fails, THEN THE System SHALL roll back the transaction and restore the Player's pre-round balance
15. IF a duplicate request is submitted with the same Round_ID or Idempotency_Key, THEN THE System SHALL reject the duplicate request without additional debits or credits and SHALL return the original round result

### Requirement 11: Admin Configuration

**User Story:** As an admin, I want to configure each mini game's settings, so that I can control game availability, payouts, and rules.

#### Acceptance Criteria

1. WHERE an admin accesses the Admin_Panel, THE System SHALL provide configuration for each Mini_Game including: enabled and disabled status, minimum and maximum bet, up to 20 prize tiers with payout multipliers, outcome probabilities expressed as percentages, maintenance status, and game-specific rules and payout configuration
2. WHEN an admin saves configuration changes, THE System SHALL validate the configuration server-side such that minimum bet is greater than 0, maximum bet is greater than minimum bet, all multipliers are greater than 0, and all outcome probabilities sum to 100.00 percent
3. IF an admin saves a configuration where probabilities do not sum to 100 percent, or minimum bet is greater than or equal to maximum bet, or any multiplier is less than or equal to 0, or more than 20 prize tiers are defined, THEN THE System SHALL prevent the configuration from being published and SHALL display a descriptive error indicating which field failed and why
4. WHEN an admin makes configuration changes, THE System SHALL log the administrative changes in the existing audit log including admin user ID, Mini_Game ID, timestamp, field modified, previous value, and new value
5. THE System SHALL NOT give the frontend direct authority to determine or modify game outcomes or payout probabilities
6. WHEN an admin saves configuration changes, THE System SHALL reflect the changes in the Mini_Game_Card display within 5 seconds using the existing Supabase Realtime subscription pattern
7. IF the server-side save fails due to an infrastructure error, THEN THE System SHALL retain the previous configuration and SHALL display an error indicating the save failed

### Requirement 12: Game History and Responsible Play

**User Story:** As a player, I want to see my recent game history and understand the rules and odds, so that I can play responsibly.

#### Acceptance Criteria

1. THE System SHALL provide a recent-round history for each Mini_Game showing the last 20 completed rounds with game name, stake, result, payout, and timestamp
2. THE System SHALL distinguish stake, gross payout, and net result, where net result equals gross payout minus stake, in the game history display
3. THE System SHALL display game rules and odds or prize probabilities for each Mini_Game before or during play, sourced from Mini_Game_Config
4. WHEN a round completes, THE System SHALL display a result message to the Player indicating the round outcome and any payout amount
5. WHILE a round is being processed, THE System SHALL prevent repeated submissions from the Player and SHALL indicate that a submission was rejected
6. THE System SHALL respect existing responsible-gambling controls and player limits
7. WHEN a round completes, THE System SHALL commit the round outcome and settle payouts regardless of whether the result message is successfully displayed
8. IF the Player's account_status indicates a banned or suspended account, THEN THE System SHALL prevent the Player from starting new rounds and SHALL display a message indicating the account is restricted

### Requirement 13: Technical Integration

**User Story:** As a developer, I want the mini games to integrate with the existing architecture, so that the codebase remains maintainable and consistent.

#### Acceptance Criteria

1. THE System SHALL reuse the existing router structure and keep the Jackpots_Page at the `/jackpots` route
2. THE System SHALL reuse the existing design system, authentication, wallet, and game infrastructure without creating parallel or duplicate systems
3. IF a new database table, server endpoint, or migration is required for Mini_Game_Config or game history, THEN THE System SHALL add or modify only the specific table, endpoint, or migration needed, without altering existing schema unrelated to Mini_Games
4. THE System SHALL apply authorization requiring an authenticated session, server-side validation against Mini_Game_Config bounds, and atomic Wallet_Service transactions for all mini game operations
5. THE System SHALL NOT introduce a new frontend framework or replace the existing React and Zustand architecture
6. THE System SHALL NOT redesign unrelated pages or fabricate game functionality, outcomes, winners, or financial records
7. IF a Mini_Game lacks Game_Engine integration, Wallet_Service integration, or a valid Mini_Game_Config entry, THEN THE System SHALL display a COMING SOON status on its Mini_Game_Card and SHALL prevent rounds from being played until all three prerequisites are satisfied

### Requirement 14: Financial Correctness Properties

**User Story:** As a developer, I want verifiable correctness properties for the financial behavior of mini games, so that I can prevent bugs that cause incorrect debits, credits, or duplicate transactions.

#### Acceptance Criteria

1. THE System SHALL preserve the invariant that Player balance after any completed round, where completed means the Game_Engine has generated an outcome and the Wallet_Service has settled the stake debit and any applicable payout credit atomically, equals balance_before minus stake plus payout
2. WHEN the same round request is submitted with the same Idempotency_Key, THE System SHALL produce no additional debit or credit on the second submission and SHALL return the original round result
3. THE System SHALL enforce the confluence property that the order of debiting stake and crediting payout does not affect the final balance, as both are applied atomically in a single transaction such that neither operation persists if the other fails
4. THE System SHALL enforce the round-trip property that for any bet that passes validation against available balance and Mini_Game_Config bounds, and any server-generated outcome, the net balance change equals payout minus stake
5. IF a round is rejected before settlement due to validation failure or aborted due to an error before the atomic transaction commits, THEN THE System SHALL produce zero balance change
6. IF a Player attempts to place a bet exceeding the available balance, THEN THE System SHALL reject the bet without debiting any amount
7. IF a Player attempts to place a bet outside the configured minimum and maximum bounds from Mini_Game_Config, THEN THE System SHALL reject the bet without debiting any amount
8. WHEN a duplicate round submission is received with the same Round_ID, THE System SHALL not produce a duplicate game history entry
