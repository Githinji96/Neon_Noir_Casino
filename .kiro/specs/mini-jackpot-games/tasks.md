# Implementation Plan: Mini Jackpot Games

## Overview

This plan incrementally builds the Mini Jackpot Games feature on top of the existing Neon Noir Casino infrastructure. It follows the migration phases from the design: database + RPC infrastructure first, then the frontend scaffold (all COMING SOON), then each game component activated one by one. All financial operations use the existing SECURITY DEFINER RPC pattern; no new framework is introduced.

---

## Tasks

- [x] 1. Database infrastructure — migrations and RPCs
  - [x] 1.1 Create `mini_game_config` table migration
    - Write `supabase/migrations/create_mini_game_config.sql`
    - Schema: id, game_id (unique), enabled, min_bet, max_bet, prize_tiers (jsonb), outcome_probabilities (jsonb), maintenance, game_specific_rules (jsonb), created_at, updated_at
    - Enable RLS: authenticated users can SELECT; service role manages all; policy for admin roles to SELECT all
    - Seed 6 rows with `enabled = false`: `lucky-wheel`, `scratch-cards`, `treasure-chest`, `mini-slot`, `mystery-multiplier`, `crystal-match`
    - _Requirements: 2.3, 11.1, 13.3_

  - [x] 1.2 Create `mini_game_rounds` table migration
    - Write `supabase/migrations/create_mini_game_rounds.sql`
    - Schema: id, idempotency_key (UNIQUE), user_id (FK → profiles), game_id, stake, outcome (jsonb), payout, phase ('pending'|'complete'), created_at, settled_at
    - Create indexes on user_id, game_id, created_at
    - Enable RLS: players read own rows; service role manages all; admin roles read all
    - _Requirements: 10.10, 13.3, 14.8_

  - [x] 1.3 Create game RPCs migration
    - Write `supabase/migrations/create_mini_game_rpcs.sql`
    - Implement `generate_mini_game_outcome(p_prize_tiers jsonb, p_game_id text)` helper using `gen_random_bytes` for cryptographically secure weighted random selection; fallback to last tier on floating-point edge case
    - Implement `play_mini_game(p_user_id uuid, p_game_id text, p_stake numeric, p_idempotency_key uuid)` SECURITY DEFINER: auth check → idempotency check → config load+validate → balance lock FOR UPDATE → outcome generation → atomic balance update → round INSERT → return payload
    - Implement `initiate_mini_game(p_user_id uuid, p_game_id text, p_stake numeric, p_idempotency_key uuid)` SECURITY DEFINER: same validation + debit; insert round with `phase = 'pending'`; return round_id only (no outcome)
    - Implement `claim_mini_game_result(p_user_id uuid, p_round_id uuid, p_selection jsonb)` SECURITY DEFINER: verify phase='pending' + ownership → credit payout → set phase='complete'+settled_at → return outcome+new_balance
    - Implement `get_mini_game_history(p_user_id uuid, p_game_id text, p_limit int)` — returns last ≤20 complete rounds; net_result = payout - stake
    - Implement `update_mini_game_config(p_game_id text, p_config jsonb)` SECURITY DEFINER: admin role check (super_admin|game_manager) → validate min_bet>0, max_bet>min_bet, all multipliers>0, probability sum=1.00, ≤20 prize_tiers → UPSERT config → INSERT admin_audit_log
    - Grant EXECUTE to `authenticated` on all player-facing RPCs
    - _Requirements: 10.1, 10.4–10.9, 10.14, 11.2, 11.4, 14.1–14.8_

- [x] 2. Shared types and Zustand store
  - [x] 2.1 Create shared TypeScript types
    - Write `src/types/miniGames.ts`
    - Define `MiniGameId` union type (6 values)
    - Define `MiniGameConfig` interface (all columns from `mini_game_config` table)
    - Define `PrizeTier` interface (label, multiplier, probability, symbol?)
    - Define `RoundPhase` type ('idle'|'betting'|'processing'|'result'|'error')
    - Define `CurrentRound` interface (roundId, gameId, stake, outcome, payout, idempotencyKey)
    - Define `MiniGameHistoryEntry` interface (roundId, gameId, stake, grossPayout, netResult, timestamp)
    - _Requirements: 13.2_

  - [x] 2.2 Implement `useMiniGameStore`
    - Write `src/store/miniGameStore.ts` using Zustand
    - State: configs (Record<MiniGameId, MiniGameConfig|null>), configErrors, configLoading, activeGame, roundPhase, currentRound, roundError, gameHistory
    - Implement `loadConfigs()`: fetch all rows from `mini_game_config` via Supabase select; populate configs and configErrors
    - Implement `subscribeToConfigUpdates()`: open Supabase Realtime channel on `mini_game_config`; re-call `loadConfigs()` on INSERT/UPDATE; return unsubscribe function
    - Implement `openGame(gameId)`: set activeGame, push history state for back-button support
    - Implement `closeGame()`: if roundPhase === 'processing', wait for in-flight RPC; reset activeGame and round state; pop history state
    - Implement `setBet(stake)`: update currentRound stake, validate against config bounds and profile balance, set roundError if invalid
    - Implement `submitRound(userId, stake)`: generate idempotencyKey, set roundPhase='processing', call `play_mini_game` RPC, update currentRound and balance, call `useAuthStore.getState().refreshBalance()`, set roundPhase='result' or 'error'
    - Implement `initiateRound(userId, stake)`: call `initiate_mini_game` RPC, set roundPhase='betting' (waiting for player interaction)
    - Implement `claimResult(userId)`: call `claim_mini_game_result` RPC with currentRound.roundId, update payout/outcome, set roundPhase='result'
    - Implement `loadHistory(gameId, userId)`: call `get_mini_game_history` RPC, populate gameHistory[gameId]
    - Implement `resetRound()`: set roundPhase='idle', clear currentRound and roundError
    - _Requirements: 3.3, 3.4, 10.2, 10.3, 10.9, 10.11_

  - [x] 2.3 Write property tests for `useMiniGameStore` financial logic
    - Write `src/store/__tests__/miniGame.property.test.ts` using `fast-check`
    - **Property 1: Balance Invariant** — for any (balanceBefore ≥ 0, stake > 0, payout ≥ 0) where balanceBefore ≥ stake, `computeNewBalance(balanceBefore, stake, payout)` equals `round(balanceBefore - stake + payout, 2)` within 0.01
    - **Validates: Requirements 14.1, 10.4, 10.7, 10.8**
    - **Property 3: Atomicity** — mocked RPC that throws after debit: balance before === balance after (zero net change)
    - **Validates: Requirements 14.3, 10.8, 10.14**
    - **Property 4: Round-Trip Net Change** — for any (stake, payout), `netResult = payout - stake`; verify value stored matches value returned by history
    - **Validates: Requirements 14.4, 10.10**
    - **Property 5: Zero Balance Change on Rejection** — for any stake that fails validation (< min, > max, > balance), submitRound resolves with no balance change
    - **Validates: Requirements 14.5, 10.3**
    - _Requirements: 14.1, 14.3, 14.4, 14.5_

- [x] 3. Frontend scaffold — JackpotsPage extension and card grid
  - [x] 3.1 Create `MiniGameCard` component
    - Write `src/components/miniGames/MiniGameCard.tsx`
    - Props: `gameId: MiniGameId`, `config: MiniGameConfig | null`, `configError: boolean`, `onPlay: (gameId: MiniGameId) => void`
    - Render: Neon Noir-themed icon/artwork, game title, description (≤100 chars), compact category badge (INSTANT WIN | MINI SLOTS | MULTIPLIER per Requirement 2.8), min/max bet from config, action button
    - PLAY NOW button (neon gold): shown when `config.enabled === true`; calls `onPlay`
    - COMING SOON button (disabled, muted): shown when `config === null || !config.enabled`
    - Config error state: render "Configuration unavailable" text, hide bet amounts and play button
    - Apply Neon Noir styling: black backgrounds, neon gold/yellow buttons, purple accents, cyan highlights
    - _Requirements: 2.1–2.10, 13.7_

  - [x] 3.2 Create `MiniGameModal` component scaffold
    - Write `src/components/miniGames/MiniGameModal.tsx`
    - Renders when `useMiniGameStore.activeGame !== null` via a React portal at `document.body`
    - Desktop: max-width 640px, centered with backdrop; Mobile (≤390px): full-screen 100vw × 100dvh, no border-radius
    - Visible close/back button calling `useMiniGameStore.closeGame()`
    - Escape key listener: calls `closeGame()`
    - `popstate` listener: calls `closeGame()` on browser back
    - Focus trap: first interactive element focused on open; Tab cycles within modal
    - Renders placeholder `<div>` for game content (per-game components wired in later tasks)
    - _Requirements: 3.1, 3.2, 3.5, 3.8_

  - [x] 3.3 Extend `JackpotsPage` with `MiniJackpotGamesSection`
    - Modify `src/pages/JackpotsPage.tsx` to add `<MiniJackpotGamesSection />` below `<ProgressiveJackpotsSection />`
    - Create `src/components/miniGames/MiniJackpotGamesSection.tsx` inline or as a separate file
    - Section heading: "MINI JACKPOT GAMES" (font-orbitron, uppercase, gold glow), subtitle: "Quick games. Instant reveals. Exciting prizes."
    - Call `useMiniGameStore.loadConfigs()` and `subscribeToConfigUpdates()` on mount; unsubscribe on unmount
    - Render `<MiniGameCard />` for each of the 6 game IDs; pass config and configError from store
    - Responsive grid: `grid-cols-1` / `md:grid-cols-2` / `lg:grid-cols-3`; CSS Grid auto-rows for equal card heights
    - Render `<MiniGameModal />` once (single instance)
    - Wire `onPlay` to `useMiniGameStore.openGame(gameId)`
    - _Requirements: 1.1–1.9, 2.9, 3.6, 3.7_

- [x] 4. Checkpoint — Infrastructure and scaffold
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. `MiniGameHistoryPanel` and shared game layout
  - [x] 5.1 Create `MiniGameHistoryPanel` component
    - Write `src/components/miniGames/MiniGameHistoryPanel.tsx`
    - Collapsible panel rendered at the bottom of each game view
    - Call `useMiniGameStore.loadHistory(gameId, userId)` on game open
    - Table columns: Round ID (first 8 chars), Stake (KES), Payout (KES), Net (KES, green/red/grey), Time (relative)
    - Show last 20 completed rounds; distinguish stake, gross payout, net result
    - Empty state: "No rounds played yet"
    - _Requirements: 12.1, 12.2_

  - [x] 5.2 Create shared game layout wrapper
    - Write `src/components/miniGames/MiniGameLayout.tsx`
    - Provides: current balance display (from `useGameStore` / `useAuthStore`), selected bet display, bet input with +/- controls, action button slot, result display area, `MiniGameHistoryPanel` at bottom
    - Validates bet against config min/max and balance; shows inline errors ("Minimum bet is KES {min}", "Maximum bet is KES {max}", "Insufficient balance")
    - Disables bet input and action button when `roundPhase === 'processing'`
    - Shows processing indicator while `roundPhase === 'processing'`
    - Displays result message on `roundPhase === 'result'`
    - Shows account-restricted message if `profile.account_status` is 'banned' or 'suspended'
    - _Requirements: 3.4, 3.5, 10.2, 10.3, 12.3, 12.4, 12.5, 12.8_

- [x] 6. Mystery Multiplier game (first playable game — single-phase, simplest)
  - [x] 6.1 Implement `MysteryMultiplierGame` component
    - Write `src/components/miniGames/games/MysteryMultiplierGame.tsx`
    - Use `MiniGameLayout` wrapper
    - Rules panel shown before bet: display multiplier range, prize tier probabilities sourced from `config.prize_tiers`, payout formula (`multiplier × stake = payout`)
    - On submit: call `useMiniGameStore.submitRound(userId, stake)`
    - Result display: final multiplier, stake, gross payout as `{multiplier}x × KES {stake} = KES {payout}` (observable calculation per Requirement 8.5)
    - Wire into `MiniGameModal` for `gameId === 'mystery-multiplier'`
    - _Requirements: 8.1–8.6_

  - [x] 6.2 Write property test for Mystery Multiplier payout formula
    - **Property 4: Round-Trip Net Change** applied to multiplier games
    - For any (stake: float min=1, multiplier: float min=0.01), `payout = round(stake * multiplier, 2)` and `netResult = payout - stake`
    - **Validates: Requirements 14.4, 8.5**
    - _Requirements: 14.4, 8.5_

- [x] 7. Neon Lucky Wheel game (single-phase)
  - [x] 7.1 Implement `LuckyWheelGame` component
    - Write `src/components/miniGames/games/LuckyWheelGame.tsx`
    - Use `MiniGameLayout` wrapper
    - Render wheel SVG/CSS with 2–20 segments from `config.prize_tiers`; segment count from `config.game_specific_rules.segment_count`
    - Each segment labelled with tier label and colored distinctly
    - On submit: call `useMiniGameStore.submitRound(userId, stake)`; disable spin button while `roundPhase === 'processing'`
    - Animate wheel rotation using CSS `transform: rotate()` transition; calculate target angle from `outcome.segment_index` and segment count; animation ends at correct segment
    - Show result overlay after animation: segment label, payout amount
    - Wire into `MiniGameModal` for `gameId === 'lucky-wheel'`
    - _Requirements: 4.1–4.8_

  - [ ]* 7.2 Write property test for Lucky Wheel segment angle calculation
    - For any (segmentCount: integer 2–20, segmentIndex: integer 0..segmentCount-1), computed angle lands within the correct segment arc
    - **Property 4: Round-Trip** — server-returned segment_index maps to the correct displayed segment without off-by-one
    - **Validates: Requirements 4.3, 14.4**
    - _Requirements: 4.3, 14.4_

- [x] 8. Mini Slot Jackpot game (single-phase)
  - [x] 8.1 Implement `MiniSlotGame` component
    - Write `src/components/miniGames/games/MiniSlotGame.tsx`
    - Use `MiniGameLayout` wrapper
    - 3-reel layout using same CSS reel-strip animation pattern from `src/pixi/GameCanvas.tsx` (`reelSpin` keyframes, staggered stop timers)
    - Symbols sourced from `config.game_specific_rules.reel_symbols`
    - After RPC resolves, animate reels stopping at `outcome.reels` positions
    - Display payline, win key, and payout for winning outcomes; "No win" indication for non-matching
    - Respect `wild_enabled` and `bonus_enabled` from `config.game_specific_rules`
    - Wire into `MiniGameModal` for `gameId === 'mini-slot'`
    - _Requirements: 7.1–7.9_

  - [ ]* 8.2 Write unit tests for MiniSlotGame reel animation stagger
    - Test that each reel stops at the correct symbol index from `outcome.reels`
    - Test wild-substitution display logic when `wild_enabled = true`
    - _Requirements: 7.3, 7.4_

- [x] 9. Crystal Match game (single-phase)
  - [x] 9.1 Implement `CrystalMatchGame` component
    - Write `src/components/miniGames/games/CrystalMatchGame.tsx`
    - Use `MiniGameLayout` wrapper
    - Rules panel shown before bet: grid size, minimum match count, prize tier table sourced from `config`
    - Grid size from `config.game_specific_rules.grid_size` (e.g. `[3,3]`)
    - After RPC resolves: render `outcome.grid`, highlight `outcome.matched_combos` positions
    - Display: Round ID, final grid arrangement, matched combinations, tier label, payout — all for verifiability per Requirement 9.6
    - Wire into `MiniGameModal` for `gameId === 'crystal-match'`
    - _Requirements: 9.1–9.7_

  - [ ]* 9.2 Write property test for Crystal Match idempotency
    - **Property 2: Idempotency** — mocked `play_mini_game` that returns duplicate=true on second call; assert no additional balance change and returned round_id matches first call
    - **Validates: Requirements 14.2, 10.9, 10.15**
    - _Requirements: 14.2, 10.9_

- [ ] 10. Checkpoint — Single-phase games
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Neon Scratch Cards game (two-phase)
  - [x] 11.1 Implement `ScratchCardGame` component
    - Write `src/components/miniGames/games/ScratchCardGame.tsx`
    - Use `MiniGameLayout` wrapper
    - Card designs sourced from `config.game_specific_rules.card_design` (index 0–1)
    - On bet submit: call `useMiniGameStore.initiateRound(userId, stake)` (Phase 1 — debit + server outcome stored)
    - Scratch surface: HTML Canvas 2D overlay drawn in gray; pointer/touch events erase pixels using `destination-out` composite; compute coverage as ratio of transparent pixels to total
    - When coverage > 50%: call `useMiniGameStore.claimResult(userId)` (Phase 2 — reveal + credit payout)
    - Block Phase 2 if `roundPhase !== 'betting'` (already claimed or not initiated)
    - Show prize amount and result after claim resolves
    - Wire into `MiniGameModal` for `gameId === 'scratch-cards'`
    - _Requirements: 5.1–5.7_

  - [ ]* 11.2 Write property test for Scratch Card two-phase idempotency
    - **Property 2: Idempotency** — calling `claim_mini_game_result` twice with same round_id returns original result; no additional credit; phase stays 'complete'
    - **Validates: Requirements 14.2, 5.5, 10.9_**
    - _Requirements: 14.2, 5.5_

- [x] 12. Cyber Treasure Chest game (two-phase)
  - [x] 12.1 Implement `TreasureChestGame` component
    - Write `src/components/miniGames/games/TreasureChestGame.tsx`
    - Use `MiniGameLayout` wrapper
    - Chest count from `config.game_specific_rules.chest_count` (2–10); render N clickable chest icons
    - On bet submit: call `useMiniGameStore.initiateRound(userId, stake)` (Phase 1 — debit, server stores which chest has the prize)
    - Only enable chest selection after Phase 1 completes (roundPhase === 'betting')
    - On chest click: call `useMiniGameStore.claimResult(userId)` passing `{ selected_index }` in `p_selection`
    - After one chest selected: disable all other chests (prevent multi-select per Requirement 6.6)
    - Reveal animation: animate selected chest opening; show prize or "No prize"
    - Error case (Requirement 6.8): if claim RPC fails, show retry option using same round_id without new debit
    - Wire into `MiniGameModal` for `gameId === 'treasure-chest'`
    - _Requirements: 6.1–6.8_

  - [ ]* 12.2 Write property test for Treasure Chest bet rejection
    - **Property 6: Insufficient Balance Rejection** and **Property 7: Out-of-Bounds Bet Rejection**
    - For any stake < 0 or > balance or outside [min_bet, max_bet]: `initiateRound` rejects without any balance change
    - **Validates: Requirements 14.6, 14.7, 6.2, 6.3**
    - _Requirements: 14.6, 14.7_

- [x] 13. Admin configuration panel
  - [x] 13.1 Implement `MiniGameConfigPanel` component
    - Write `src/components/admin/MiniGameConfigPanel.tsx`
    - Per-game form (one accordion row per MiniGameId) covering: Enabled toggle, Min Bet / Max Bet numeric inputs, Prize Tiers table editor (label, multiplier %, probability % — add/remove rows, max 20), running probability sum indicator (turns red if ≠ 100%), Maintenance Mode toggle, Game-Specific Rules JSON editor (collapsible textarea), Save button
    - On Save: call `update_mini_game_config` RPC; show field-level inline errors mapped from RPC exception messages; show success toast on save
    - Display RPC validation errors inline: min_bet, max_bet, probability sum, multiplier, prize_tiers count
    - Role guard: only render for `adminProfile.admin_role` of 'super_admin' or 'game_manager'
    - _Requirements: 11.1–11.7_

  - [x] 13.2 Wire `MiniGameConfigPanel` into `GamesPage`
    - Modify `src/pages/admin/GamesPage.tsx` to import and render `<MiniGameConfigPanel />` as a new section below the existing game config table
    - Add section heading "Mini Jackpot Games" consistent with existing admin panel style
    - _Requirements: 11.1, 13.2_

  - [ ]* 13.3 Write property test for `update_mini_game_config` validation
    - **Property 7: Out-of-Bounds Bet Rejection** applied to admin config
    - For any (minBet: float, maxBet: float) where minBet ≥ maxBet: `update_mini_game_config` must reject
    - For any probabilities array that does not sum to 1.00 (±0.0001): must reject
    - For any multiplier ≤ 0 in prize_tiers: must reject
    - **Validates: Requirements 11.2, 11.3**
    - _Requirements: 11.2, 11.3_

- [x] 14. Checkpoint — All games and admin panel
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Property-based tests — idempotency and no-duplicate-history
  - [x]* 15.1 Write property test for Property 2 (Idempotency) — `play_mini_game` path
    - Mock `play_mini_game` RPC to return `{ duplicate: true, round_id, outcome, payout }` on second call with same key
    - Assert: `useMiniGameStore` balance unchanged after second call; `currentRound.roundId` matches first call; no second history entry appended
    - **Property 2: Idempotency**
    - **Validates: Requirements 14.2, 10.9, 10.11, 10.15**
    - _Requirements: 14.2, 10.9_

  - [x]* 15.2 Write property test for Property 8 (No Duplicate History)
    - For any sequence of N calls with the same idempotency key, `useMiniGameStore.gameHistory[gameId]` contains exactly 1 entry for that round
    - **Property 8: No Duplicate Round History Entries**
    - **Validates: Requirements 14.8, 10.10**
    - _Requirements: 14.8, 10.10_

- [x] 16. Responsive layout and accessibility polish
  - [x] 16.1 Verify and fix responsive behavior across breakpoints
    - Confirm MiniGameCard grid: 1 col (≤767px), 2 col (768–1023px), 3 col (≥1024px) — matches Requirement 2.9
    - Confirm MiniGameModal: full-screen on ≤390px (no horizontal overflow); centered max-w-2xl on desktop
    - Confirm all game controls fit within 390px viewport without horizontal scroll
    - Confirm ProgressiveJackpots section unchanged with no horizontal overflow
    - _Requirements: 1.9, 2.9, 3.5_

  - [x] 16.2 Add ARIA roles, labels, and keyboard navigation
    - `MiniGameModal`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to game title
    - Close button: `aria-label="Close game"`
    - PLAY NOW / COMING SOON buttons: `aria-disabled="true"` when disabled
    - Scratch card canvas: `role="application"`, `aria-label="Scratch card — scratch to reveal prize"`
    - Treasure chest buttons: `aria-label="Select chest {n}"`, `aria-pressed` state
    - Wheel spin button: `aria-live="polite"` region for result announcement
    - _Requirements: 3.2, 13.2_

- [ ] 17. Final checkpoint — Full integration
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- The migration phase order matters: 1.1 → 1.2 → 1.3 must run in sequence in Supabase
- Games remain COMING SOON until `enabled = true` is set in `mini_game_config` via the admin panel — no frontend code change needed to activate a game
- Property tests use `fast-check` (already a dev dependency at `^3.19.0`)
- The existing `guard_balance_update` trigger is bypassed legitimately by the SECURITY DEFINER RPCs, matching the existing `apply_spin_result` pattern
- Two-phase games (Scratch Cards, Treasure Chest) should be enabled after single-phase games are validated in production
- `MiniSlotGame` re-uses the reel-strip CSS animation (`reelSpin` / `reelSpinFast` keyframes) already defined for `GameCanvas.tsx` — do not duplicate CSS keyframes; import or co-locate them
- Each task references specific requirements for full traceability; all 14 requirements are covered

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2"] },
    { "id": 4, "tasks": ["2.3", "3.1", "3.2"] },
    { "id": 5, "tasks": ["3.3"] },
    { "id": 6, "tasks": ["5.1", "5.2"] },
    { "id": 7, "tasks": ["6.1", "8.1", "9.1"] },
    { "id": 8, "tasks": ["6.2", "7.1", "8.2", "9.2"] },
    { "id": 9, "tasks": ["7.2", "11.1", "12.1", "13.1"] },
    { "id": 10, "tasks": ["11.2", "12.2", "13.2"] },
    { "id": 11, "tasks": ["13.3", "15.1", "15.2"] },
    { "id": 12, "tasks": ["16.1", "16.2"] }
  ]
}
```
