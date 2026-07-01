# Architecture Summary

This document summarizes the main responsibility boundaries in the codebase and how the major systems connect.

## 1. Application shell

The entry point is `src/App.tsx`.

Responsibilities:
- Defines the top-level router and route hierarchy
- Wraps the app in an error boundary
- Protects the slot experience behind a session-based guard
- Uses lazy-loaded admin pages and a role-aware admin guard

## 2. UI layer

The UI is organized into a few clear areas:

- `src/pages/` contains route-level pages such as the lobby, slot machine, jackpots, VIP, live tables, auth, and admin screens
- `src/components/` contains shared UI pieces such as modals, navigation, auth views, and admin widgets
- `src/components/admin/` contains the admin-specific layout and panels

This split keeps page composition focused on routing while isolating reusable UI into components.

## 3. State layer

State is handled with Zustand stores under `src/store/`.

### Auth
- `useAuthStore` owns user session state, profile loading, sign in/out, and balance synchronization.

### Game
- `useGameStore` owns slot-machine state such as balance, active game, reels, win result history, autoplay, and free spins.

### Other domain stores
- `useJackpotStore` handles jackpot state and win notifications
- `useVIPStore` manages VIP points and related behavior
- `useAdminStore` manages admin authentication and admin UI state
- `useLiveTablesStore` handles live-table state
- `useNearMissStore` manages near-miss notifications

## 4. Game engine

The casino game core lives under `src/logic/`.

Key modules:
- `rng.ts` – generates expected reel outcomes
- `paylines.ts` – evaluates wins and free-spin triggers
- `payout.ts` – computes payout values
- `rtpController.ts` – tracks RTP and spin-session statistics
- `jackpot/` – progressive jackpot contribution and resolution logic

The game store calls these modules to build the gameplay loop: deduct stake, create outcomes, evaluate results, apply payout, and update state.

## 5. Data and backend integration

The Supabase client is created in `src/lib/supabase.ts`.

It is used for:
- auth session handling
- profile and balance persistence
- leaderboard and win history
- spin analytics and admin data access

## 6. Admin experience

The admin experience is structured as a separate route tree with role-gated access.

Flow:
1. The admin guard checks the current admin profile and required roles
2. The guard redirects unauthenticated or unauthorized users away from protected routes
3. The admin layout and nested pages load lazily for performance

## 7. Performance and UX patterns

The project already uses a few good patterns for maintainability and performance:
- Lazy-loaded admin pages to keep the main bundle smaller
- Zustand stores for centralized state without prop-drilling overhead
- Splitting the slot page into smaller UI subcomponents
- Defensive loading and timeout handling around auth and admin initialization

## 8. Practical guidance for future changes

When extending the app, preserve the current separation:
- Keep route-level composition in pages
- Keep reusable UI in components
- Keep domain logic in stores and logic modules
- Keep backend-facing integration in the Supabase layer or service helpers

That structure makes it easier to add new games, admin tools, or analytics without creating tightly coupled components.
