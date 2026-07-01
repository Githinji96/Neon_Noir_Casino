# Neon Noir Casino

Neon Noir Casino is a React + TypeScript casino experience with slot gameplay, progressive jackpots, live tables, VIP content, and an admin portal. The app uses Supabase for authentication and persistence, Zustand for state management, and Vite for local development and production builds.

## What this project includes

- Public experience: casino lobby, jackpots, VIP page, and live tables
- Protected slot gameplay with balance tracking, autoplay, turbo mode, and paytable support
- Progressive jackpot integration and jackpot win handling
- Auth flows for sign-in, sign-up, password reset, and OAuth callbacks
- Admin dashboard with role-based access for finance, support, game, and super-admin actions
- Analytics-oriented spin and balance persistence through Supabase

## Tech stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- React Router
- Supabase JS client
- Vitest + Testing Library

## Quick start

1. Install dependencies
   ```bash
   npm install
   ```
2. Create a local environment file with the Supabase values your app expects:
   ```bash
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
3. Start the dev server
   ```bash
   npm run dev
   ```

## Available scripts

- `npm run dev` – start the Vite development server
- `npm run build` – run TypeScript checks and build the production bundle
- `npm run preview` – preview the production build locally
- `npm run test` – run the Vitest test suite

## Application structure

```text
src/
  App.tsx                 # router + route composition
  components/             # shared UI, modals, auth, admin UI
  config/                 # game config, symbols, bets, VIP data
  hooks/                  # reusable hooks
  lib/                    # Supabase client and shared integrations
  logic/                  # game engine and payout logic
  pages/                  # route-level pages and admin pages
  store/                  # Zustand stores for auth, game, admin, jackpot, etc.
  utils/                  # audio and media helpers
```

## Architecture overview

### Routing

The app shell in `src/App.tsx` defines the main public routes, the protected slot route, and the admin routes. Admin pages use lazy loading and a role-based guard to control access.

### State management

- `useAuthStore` manages authentication state, profile loading, sign-in/sign-out, and balance sync.
- `useGameStore` handles slot state, payouts, autoplay, turbo mode, and free-spin progression.
- Dedicated stores cover jackpot flow, VIP points, live tables, settings, fraud detection, and admin state.

### Game logic

The slot experience is centered around the logic in `src/logic/`:

- `rng.ts` generates reel outcomes
- `paylines.ts` evaluates symbol matches and free-spin triggers
- `payout.ts` calculates line and scatter payouts
- `rtpController.ts` tracks session RTP and spin stats
- `jackpot/` contains the progressive jackpot engine and contribution logic

### Data and persistence

Supabase powers:

- authentication and user sessions
- profile and balance persistence
- leaderboard and win recording
- spin analytics and admin-related data

## Development notes

- The app uses strict TypeScript settings and expects clean builds before shipping changes.
- Admin and finance routes are protected by role-based guards, but sensitive operations should continue to be validated server-side where possible.
- The slot page uses a small loading state before the game UI is fully mounted and initializes game-specific symbols on entry.

## Suggested next steps

- Add a root-level environment example file for contributors
- Expand automated coverage around the slot engine and admin guards
- Document Supabase schema usage and admin role expectations
