# Requirements Document

## Introduction

Neon Noir Casino is a modern, high-end iGaming web application featuring a dark cyberpunk aesthetic. The application consists of two primary screens: a Casino Lobby (home screen) for game discovery and navigation, and a fully interactive Slot Game interface with real-time spin mechanics, win detection, and balance management. The platform targets desktop and mobile users and is built with React, TailwindCSS, Framer Motion, and Zustand.

## Glossary

- **Casino_Lobby**: The home screen displaying game listings, jackpots, and navigation
- **Slot_Machine**: The interactive 5x3 reel slot game interface
- **RNG**: Random Number Generator — the system responsible for randomized reel outcomes
- **Reel**: A single vertical column of symbols in the slot machine (5 total)
- **Symbol**: A visual icon displayed on a reel (Bell, Star, Heart, Diamond, Coin, Shield, Skull, Token, Seven, Wild, Scatter)
- **Payline**: A defined pattern across reels that constitutes a winning combination
- **Wild_Symbol**: A special symbol that substitutes for any standard symbol to complete a payline
- **Scatter_Symbol**: A special symbol that triggers free spins when 3 or more appear
- **Free_Spins**: A bonus round granting a set number of spins without deducting from the player balance
- **Multiplier**: A factor applied to a win amount to increase the payout
- **RTP**: Return to Player — the theoretical percentage of wagered money returned to players over time
- **Volatility**: A measure of risk; how frequently and how large wins occur
- **Autoplay**: A mode where the slot machine spins automatically for a configured number of rounds
- **Turbo_Mode**: A mode that reduces reel spin animation duration for faster gameplay
- **Paytable**: A reference table showing symbol payout values and game rules
- **Balance**: The player's current in-game currency amount
- **Bet**: The amount of currency wagered per spin
- **Jackpot**: A large, often progressive prize pool displayed in the lobby
- **Game_Card**: A UI component representing a single game in the lobby grid
- **Navbar**: The top navigation bar present on all screens
- **Glassmorphism**: A UI style using frosted-glass translucent panels with blur and soft borders
- **Design_System**: The shared set of colors, typography, spacing, and component styles

---

## Requirements

### Requirement 1: Design System and Visual Theme

**User Story:** As a player, I want a visually immersive cyberpunk casino aesthetic, so that the experience feels premium and engaging.

#### Acceptance Criteria

1. THE Design_System SHALL use a dark purple and black gradient as the primary background color scheme.
2. THE Design_System SHALL define neon yellow (#FFD700), electric purple, and cyan as accent colors applied consistently across interactive elements.
3. THE Design_System SHALL apply Glassmorphism styling (translucent frosted-glass panels, backdrop blur, soft borders) to all card and modal components.
4. THE Design_System SHALL use bold, futuristic typography for all headings and large numeric displays (e.g. jackpot counters, balance).
5. WHEN a user hovers over an interactive element, THE Design_System SHALL apply a glowing neon highlight animation with a smooth transition of no more than 300ms.
6. THE Design_System SHALL apply subtle pulsing animations to jackpot counters and promotional banners.
7. THE Design_System SHALL be responsive and apply a mobile-first layout, adapting all components to screen widths from 320px to 1920px.

---

### Requirement 2: Navbar

**User Story:** As a player, I want a persistent navigation bar, so that I can access all major sections of the casino at any time.

#### Acceptance Criteria

1. THE Navbar SHALL display the logo text "NEON NOIR CASINO" on the left side of the bar.
2. THE Navbar SHALL display navigation links for: Slots, Live Tables, Jackpots, and VIP.
3. THE Navbar SHALL display the player's current Balance formatted as a currency value (e.g. $25,400.00).
4. THE Navbar SHALL display a Deposit button styled with the neon yellow accent color.
5. THE Navbar SHALL display a profile avatar icon, a notifications icon, and a settings icon on the right side.
6. WHEN a navigation link is active, THE Navbar SHALL visually distinguish it from inactive links using the neon yellow accent color.
7. WHEN the viewport width is below 768px, THE Navbar SHALL collapse navigation links into a hamburger menu.

---

### Requirement 3: Hero Section

**User Story:** As a player, I want a visually striking hero banner on the lobby, so that I am immediately drawn into the casino experience.

#### Acceptance Criteria

1. THE Casino_Lobby SHALL display a Hero Section as the first visible section below the Navbar.
2. THE Hero Section SHALL display the headline text "UNLEASH THE NEON WIN" in large, bold, futuristic typography.
3. THE Hero Section SHALL display an animated jackpot counter that increments in real time, starting from a seeded value (e.g. $3,429,102.55).
4. WHEN the Hero Section is rendered, THE jackpot counter SHALL increment by a random amount between $0.01 and $2.00 every 100ms to simulate a live progressive jackpot.
5. THE Hero Section SHALL display a "Play Now" CTA button and a "Details" CTA button.
6. THE Hero Section SHALL use a blurred casino chips image as the background with a dark overlay to maintain text legibility.
7. WHEN a user clicks "Play Now", THE Casino_Lobby SHALL navigate the user to the Slot_Machine screen.

---

### Requirement 4: New Arrivals Section

**User Story:** As a player, I want to browse newly added slot games in the lobby, so that I can discover and play the latest titles.

#### Acceptance Criteria

1. THE Casino_Lobby SHALL display a "New Arrivals" section containing a responsive grid of Game_Card components.
2. THE Game_Card SHALL display a game thumbnail image, a game title (e.g. "Cyber Strike 777", "Neon Jungle Fruits"), and a badge indicating either "HOT" or "NEW".
3. WHEN a user hovers over a Game_Card, THE Game_Card SHALL apply a glowing neon border effect and a slight zoom transform (scale 1.05) with a transition of no more than 300ms.
4. THE New Arrivals section SHALL display a minimum of 6 Game_Card components populated from mock data.
5. WHEN a user clicks a Game_Card, THE Casino_Lobby SHALL navigate the user to the Slot_Machine screen.

---

### Requirement 5: Progressive Jackpots Section

**User Story:** As a player, I want to see live progressive jackpot amounts, so that I can choose high-value games to play.

#### Acceptance Criteria

1. THE Casino_Lobby SHALL display a "Progressive Jackpots" section as a horizontally scrollable card list.
2. Each jackpot card SHALL display: a jackpot name (e.g. "Mega Moolah Noir", "Electric Pulse", "Crystal Vault"), a prize amount, one or more tags (e.g. "Daily", "Hourly"), and a "Spin Now" button.
3. WHEN the Progressive Jackpots section is rendered, THE jackpot prize amounts SHALL animate incrementally to simulate live updates.
4. WHEN a user clicks "Spin Now" on a jackpot card, THE Casino_Lobby SHALL navigate the user to the Slot_Machine screen.
5. THE Progressive Jackpots section SHALL display a minimum of 3 jackpot cards populated from mock data.

---

### Requirement 6: Popular Choices Section

**User Story:** As a player, I want to see popular games with key stats, so that I can make informed decisions about which games to play.

#### Acceptance Criteria

1. THE Casino_Lobby SHALL display a "Popular Choices" section containing a grid of smaller game cards.
2. Each Popular Choices card SHALL display: a game avatar or icon, the game's RTP percentage, and the game's Volatility level (Low, Medium, or High).
3. THE Popular Choices section SHALL display a minimum of 4 cards populated from mock data.
4. WHEN a user clicks a Popular Choices card, THE Casino_Lobby SHALL navigate the user to the Slot_Machine screen.

---

### Requirement 7: Bottom Navigation Bar

**User Story:** As a mobile player, I want a floating bottom navigation bar, so that I can quickly switch between key sections without scrolling.

#### Acceptance Criteria

1. THE Casino_Lobby SHALL display a floating bottom navigation bar containing tabs: Home, Promos, Spin, History, and Support.
2. WHEN a tab is active, THE bottom navigation bar SHALL highlight it using the neon yellow accent color.
3. WHEN a user taps the "Spin" tab, THE Casino_Lobby SHALL navigate the user to the Slot_Machine screen.
4. WHILE the viewport width is 768px or greater, THE bottom navigation bar SHALL be hidden.

---

### Requirement 8: Slot Machine Reel Layout

**User Story:** As a player, I want a visually clear 5x3 reel grid, so that I can follow the game outcome on each spin.

#### Acceptance Criteria

1. THE Slot_Machine SHALL display a 5-column by 3-row reel grid.
2. THE Slot_Machine SHALL render each cell with one of the following symbols: Bell, Star, Heart, Diamond, Coin, Shield, Skull, Token, Seven, Wild_Symbol, or Scatter_Symbol.
3. THE Slot_Machine SHALL display each symbol on a dark background with neon-styled iconography consistent with the Design_System.
4. WHEN a spin completes, THE Slot_Machine SHALL highlight all cells that form a winning Payline using a glowing neon border.
5. WHEN a winning combination is detected, THE Slot_Machine SHALL apply a pulse animation to the winning symbols.

---

### Requirement 9: Spin Mechanics

**User Story:** As a player, I want smooth and responsive spin controls, so that the gameplay feels fluid and satisfying.

#### Acceptance Criteria

1. THE Slot_Machine SHALL display a central "SPIN" button styled with the neon yellow accent color and a glowing shadow effect.
2. WHEN a user clicks the SPIN button, THE RNG SHALL generate a new randomized 5x3 symbol grid using weighted symbol probabilities.
3. WHEN a spin is initiated, THE Slot_Machine SHALL animate each reel column with a top-to-bottom easing scroll animation, staggering the stop of each column by 150ms.
4. WHILE a spin animation is in progress, THE Slot_Machine SHALL disable the SPIN button to prevent concurrent spins.
5. THE Slot_Machine SHALL display an Autoplay toggle that, when enabled, automatically triggers a new spin after each spin completes.
6. WHEN Autoplay is active and the player Balance reaches $0.00, THE Slot_Machine SHALL disable Autoplay and display a notification to the player.
7. THE Slot_Machine SHALL display a Turbo_Mode toggle that, when enabled, reduces the reel spin animation duration by 70%.

---

### Requirement 10: Betting Controls

**User Story:** As a player, I want to adjust my bet amount before each spin, so that I can manage my risk and potential reward.

#### Acceptance Criteria

1. THE Slot_Machine SHALL display a bet amount control with a minus (-) button, a plus (+) button, and a numeric display showing the current Bet value.
2. WHEN a user clicks the plus (+) button, THE Slot_Machine SHALL increase the Bet by one step from the defined bet ladder (e.g. $0.20, $0.50, $1.00, $2.00, $5.00, $10.00, $20.00, $50.00, $100.00).
3. WHEN a user clicks the minus (-) button, THE Slot_Machine SHALL decrease the Bet by one step from the defined bet ladder.
4. IF the current Bet is at the minimum value and the user clicks minus (-), THEN THE Slot_Machine SHALL keep the Bet at the minimum value without decrementing.
5. IF the current Bet is at the maximum value and the user clicks plus (+), THEN THE Slot_Machine SHALL keep the Bet at the maximum value without incrementing.
6. IF the player Balance is less than the current Bet, THEN THE Slot_Machine SHALL disable the SPIN button and display an "Insufficient Balance" indicator.

---

### Requirement 11: RNG and Symbol Weight System

**User Story:** As a player, I want fair and randomized outcomes, so that the game feels authentic and trustworthy.

#### Acceptance Criteria

1. THE RNG SHALL assign a weighted probability to each symbol, where premium symbols (Wild_Symbol, Scatter_Symbol, Seven) have lower weights than standard symbols (Bell, Star, Heart, Diamond, Coin, Shield, Skull, Token).
2. THE RNG SHALL generate each reel column independently, so that the outcome of one reel does not influence another.
3. THE RNG SHALL use a client-side pseudo-random algorithm seeded at runtime to produce non-deterministic results across sessions.
4. FOR ALL spins, THE RNG SHALL produce a complete 5x3 symbol grid where every cell contains exactly one valid symbol from the defined symbol set.

---

### Requirement 12: Win Detection and Paylines

**User Story:** As a player, I want the game to automatically detect and reward winning combinations, so that I don't have to manually evaluate outcomes.

#### Acceptance Criteria

1. THE Slot_Machine SHALL evaluate a minimum of 5 horizontal Paylines (one per row, plus two diagonal lines) after each spin.
2. WHEN 3 or more identical symbols appear consecutively from the leftmost reel on a Payline, THE Slot_Machine SHALL register a win.
3. WHEN a Wild_Symbol appears on a Payline, THE Slot_Machine SHALL treat it as a substitute for any standard symbol to complete or extend a winning combination.
4. WHEN a win is detected, THE Slot_Machine SHALL calculate the payout as: Bet × symbol multiplier × number of matching symbols.
5. WHEN a win is detected, THE Slot_Machine SHALL update the "Last Win" display with the win amount.
6. WHEN a win is detected, THE Slot_Machine SHALL add the win amount to the player Balance.
7. WHEN 3 or more Scatter_Symbols appear anywhere on the grid, THE Slot_Machine SHALL trigger the Free_Spins bonus round.

---

### Requirement 13: Free Spins System

**User Story:** As a player, I want a free spins bonus round, so that I have opportunities for extended play and larger wins without additional cost.

#### Acceptance Criteria

1. WHEN the Free_Spins round is triggered, THE Slot_Machine SHALL award 10 free spins to the player.
2. WHILE the Free_Spins round is active, THE Slot_Machine SHALL not deduct the Bet from the player Balance on each spin.
3. WHILE the Free_Spins round is active, THE Slot_Machine SHALL display the remaining free spin count prominently on screen.
4. WHEN the Free_Spins count reaches 0, THE Slot_Machine SHALL end the bonus round and resume normal play.
5. WHEN the Free_Spins round ends, THE Slot_Machine SHALL display a summary of total winnings earned during the bonus round.

---

### Requirement 14: Balance Management

**User Story:** As a player, I want my balance to update accurately after every spin, so that I always know how much I have available to play.

#### Acceptance Criteria

1. THE Slot_Machine SHALL display the current player Balance at all times during gameplay.
2. WHEN a spin is initiated (outside of Free_Spins), THE Slot_Machine SHALL deduct the current Bet from the player Balance before the reels begin spinning.
3. WHEN a win is detected after a spin, THE Slot_Machine SHALL add the calculated payout to the player Balance after the reel animation completes.
4. THE Slot_Machine SHALL initialize the player Balance to a default starting value of $1,000.00 for new sessions.
5. WHEN the player Balance reaches $0.00, THE Slot_Machine SHALL disable the SPIN button and display a "No Funds" message.

---

### Requirement 15: Paytable Modal

**User Story:** As a player, I want to view the paytable and game rules, so that I understand symbol values and bonus mechanics before playing.

#### Acceptance Criteria

1. THE Slot_Machine SHALL display a button to open the Paytable modal.
2. WHEN the Paytable button is clicked, THE Slot_Machine SHALL display a modal overlay containing the full paytable.
3. THE Paytable modal SHALL list premium symbols with their rules: "Wild Noir" (substitutes all except Scatter, multiplies wins) and "Cyber Volt" (triggers free spins when 3 or more appear).
4. THE Paytable modal SHALL list standard symbols (Diamond, Token, Chip, Seven, Cherry) with their payout multipliers (e.g. 5x, 4x, 3x, 2x, 1x).
5. THE Paytable modal SHALL display the game's RTP (96.5%) and Volatility (High) in the footer.
6. WHEN the user clicks "Back to Game" in the Paytable modal, THE Slot_Machine SHALL close the modal and return focus to the game.

---

### Requirement 16: Win Feedback and Animations

**User Story:** As a player, I want clear visual feedback when I win, so that wins feel rewarding and exciting.

#### Acceptance Criteria

1. WHEN a win is detected, THE Slot_Machine SHALL display an animated win announcement showing the win amount.
2. WHEN a win is detected, THE Slot_Machine SHALL apply a glowing pulse animation to all winning symbols for a duration of 2 seconds.
3. WHEN a win is detected, THE Slot_Machine SHALL highlight the winning Payline with a neon-colored line overlay.
4. WHERE sound is enabled, THE Slot_Machine SHALL play a win sound effect when a winning combination is detected.
5. THE Slot_Machine SHALL display a sound toggle button that enables or disables all game audio.

---

### Requirement 17: Loading and Shimmer Effects

**User Story:** As a player, I want smooth loading states, so that the application feels polished even while content is being prepared.

#### Acceptance Criteria

1. WHEN the Casino_Lobby is loading game data, THE Casino_Lobby SHALL display shimmer placeholder animations in place of Game_Card components.
2. WHEN the Slot_Machine is initializing, THE Slot_Machine SHALL display a loading animation before the reel grid becomes interactive.
3. THE shimmer effect SHALL use a gradient sweep animation consistent with the Design_System color palette.

---

### Requirement 18: Particle Background Animation

**User Story:** As a player, I want an animated background, so that the casino environment feels alive and immersive.

#### Acceptance Criteria

1. THE Casino_Lobby SHALL render a subtle particle animation in the background layer behind all content.
2. THE particles SHALL be small, low-opacity neon-colored dots or sparks that drift slowly across the screen.
3. THE particle animation SHALL not interfere with user interactions on foreground elements.
4. WHEN the device is a low-performance device (detected via reduced-motion media query), THE Casino_Lobby SHALL disable the particle animation.

---

### Requirement 19: Component Architecture

**User Story:** As a developer, I want a modular component structure, so that the codebase is maintainable and scalable.

#### Acceptance Criteria

1. THE application SHALL be implemented using React with a component-based architecture.
2. THE application SHALL use TailwindCSS for all styling, with a custom theme configuration extending the Design_System colors and typography.
3. THE application SHALL use Zustand for global state management, including player Balance, Bet, spin history, and Free_Spins state.
4. THE application SHALL use Framer Motion for all transition and animation implementations.
5. THE application SHALL define the following top-level components as separate modules: Navbar, GameCard, SlotMachine, PaytableModal, HeroSection, JackpotCard, BottomNav.
6. THE application SHALL include a mock data module exporting game listings, jackpot data, and symbol definitions.
7. THE application SHALL define symbol weights and payout multipliers in a dedicated game configuration module, separate from component logic.
