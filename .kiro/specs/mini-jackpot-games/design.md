# Design Document

## Overview

This document describes the technical design for integrating Mini Jackpot Games into the existing Neon Noir Casino application. The feature adds six mini games (Neon Lucky Wheel, Neon Scratch Cards, Cyber Treasure Chest, Mini Slot Jackpot, Mystery Multiplier, and Crystal Match) to the existing `/jackpots` page. All games reuse the existing secure wallet architecture, server-side RNG pattern, and Supabase infrastructure — no new frontend framework or parallel system is introduced.

All six games launch as COMING SOON initially. A game transitions to PLAY NOW only when its `mini_game_config` row has `enabled = true` AND a server-side game engine RPC exists for it AND the wallet integration is wired up.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (React)                       │
│                                                              │
│  JackpotsPage                                                │
│  ├── ProgressiveJackpotsSection  (existing, unchanged)       │
│  └── MiniJackpotGamesSection                                 │
│       ├── MiniGameCard × 6  (config-driven)                  │
│       └── MiniGameModal                                      │
│            ├── LuckyWheelGame                                │
│            ├── ScratchCardGame                               │
│            ├── TreasureChestGame                             │
│            ├── MiniSlotGame                                  │
│            ├── MysteryMultiplierGame                         │
│            └── CrystalMatchGame                              │
│                                                              │
│  useMiniGameStore (Zustand)                                  │
│  ├── config (loaded from mini_game_config via Realtime)      │
│  ├── activeGame / roundState / currentRound                  │
│  └── gameHistory (last 20 rounds per game, in-memory)        │
└───────────────────┬─────────────────────────────────────────┘
                    │ Supabase JS client (src/lib/supabase.ts)
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                   Supabase (PostgreSQL + Auth)                │
│                                                              │
│  Tables                                                      │
│  ├── mini_game_config       (new)                            │
│  ├── mini_game_rounds       (new)                            │
│  ├── profiles               (existing — balance)             │
│  ├── transactions           (existing — ledger)              │
│  └── admin_audit_log        (existing — admin changes)       │
│                                                              │
│  SECURITY DEFINER RPCs                                       │
│  ├── play_mini_game()       (new — single-phase games)       │
│  ├── initiate_mini_game()   (new — two-phase games)          │
│  ├── claim_mini_game_result() (new — two-phase reveal)       │
│  ├── get_mini_game_history() (new — read history)            │
│  ├── update_mini_game_config() (new — admin saves config)    │
│  └── apply_spin_result()   (existing — reused internally)    │
│                                                              │
│  Realtime                                                    │
│  └── mini_game_config channel → useMiniGameStore.loadConfig  │
└─────────────────────────────────────────────────────────────┘
```

---

## Components and Interfaces

### Component Hierarchy

### JackpotsPage Restructure

The existing `src/pages/JackpotsPage.tsx` is extended — not replaced. The page renders two sections sequentially:

```
JackpotsPage
├── <ProgressiveJackpotsSection />   ← existing markup preserved exactly
└── <MiniJackpotGamesSection />      ← new section appended below
     ├── Section heading: "MINI JACKPOT GAMES"
     ├── Subtitle: "Quick games. Instant reveals. Exciting prizes."
     ├── <MiniGameCard gameId="lucky-wheel" />
     ├── <MiniGameCard gameId="scratch-cards" />
     ├── <MiniGameCard gameId="treasure-chest" />
     ├── <MiniGameCard gameId="mini-slot" />
     ├── <MiniGameCard gameId="mystery-multiplier" />
     ├── <MiniGameCard gameId="crystal-match" />
     └── <MiniGameModal />           ← single modal instance, shown when activeGame != null
```

### MiniGameCard

File: `src/components/miniGames/MiniGameCard.tsx`

Props:
```typescript
interface MiniGameCardProps {
  gameId: MiniGameId;
  config: MiniGameConfig | null;
  configError: boolean;
  onPlay: (gameId: MiniGameId) => void;
}
```

Renders: icon/artwork, title, description (≤100 chars), category badge, min/max bet from config, PLAY NOW or COMING SOON button. Config error state shows "Configuration unavailable" and hides bet amounts and play button.

### MiniGameModal

File: `src/components/miniGames/MiniGameModal.tsx`

A full-screen overlay (or large centered modal) that renders the active game component. Provides a visible close/back button that calls `useMiniGameStore.closeGame()`. Manages focus trap for accessibility.

### Per-Game Components

| Component | File |
|---|---|
| `LuckyWheelGame` | `src/components/miniGames/games/LuckyWheelGame.tsx` |
| `ScratchCardGame` | `src/components/miniGames/games/ScratchCardGame.tsx` |
| `TreasureChestGame` | `src/components/miniGames/games/TreasureChestGame.tsx` |
| `MiniSlotGame` | `src/components/miniGames/games/MiniSlotGame.tsx` |
| `MysteryMultiplierGame` | `src/components/miniGames/games/MysteryMultiplierGame.tsx` |
| `CrystalMatchGame` | `src/components/miniGames/games/CrystalMatchGame.tsx` |

Each game component receives `gameId` and `config` from the modal and reads/writes round state via `useMiniGameStore`.

### Admin Panel Component

File: `src/components/admin/MiniGameConfigPanel.tsx`

Added as a new tab or section in the existing `/admin/games` admin panel. Renders a form for each `MiniGameId` covering: enabled toggle, min/max bet inputs, prize tiers editor (up to 20 rows), outcome probabilities editor, maintenance toggle, game-specific rules JSON editor.

---

## State Management — useMiniGameStore

File: `src/store/miniGameStore.ts`

### State Shape

```typescript
type MiniGameId =
  | 'lucky-wheel'
  | 'scratch-cards'
  | 'treasure-chest'
  | 'mini-slot'
  | 'mystery-multiplier'
  | 'crystal-match';

type RoundPhase = 'idle' | 'betting' | 'processing' | 'result' | 'error';

interface CurrentRound {
  roundId: string;          // uuid — set before RPC call (idempotency key)
  gameId: MiniGameId;
  stake: number;
  outcome: unknown | null;  // server-returned outcome payload
  payout: number | null;
  idempotencyKey: string;   // same as roundId for single-phase; separate for two-phase
}

interface MiniGameHistoryEntry {
  roundId: string;
  gameId: MiniGameId;
  stake: number;
  grossPayout: number;
  netResult: number;        // grossPayout - stake
  timestamp: string;
}

interface MiniGameState {
  // Config
  configs: Record<MiniGameId, MiniGameConfig | null>;
  configErrors: Record<MiniGameId, boolean>;
  configLoading: boolean;

  // Active game
  activeGame: MiniGameId | null;
  roundPhase: RoundPhase;
  currentRound: CurrentRound | null;
  roundError: string | null;

  // History (in-memory, loaded per game on open)
  gameHistory: Record<MiniGameId, MiniGameHistoryEntry[]>;

  // Actions
  loadConfigs: () => Promise<void>;
  subscribeToConfigUpdates: () => () => void;  // returns unsubscribe fn
  openGame: (gameId: MiniGameId) => void;
  closeGame: () => void;
  setBet: (stake: number) => void;
  submitRound: (userId: string, stake: number) => Promise<void>;
  // Two-phase only (scratch, treasure chest):
  initiateRound: (userId: string, stake: number) => Promise<void>;
  claimResult: (userId: string) => Promise<void>;
  loadHistory: (gameId: MiniGameId, userId: string) => Promise<void>;
  resetRound: () => void;
}
```

### Idempotency Flow

Before calling any RPC, the store generates a `roundId` using `crypto.randomUUID()` and persists it in `currentRound.idempotencyKey`. On network retry, the same key is re-sent. The server checks for an existing `mini_game_rounds` row with that idempotency key and returns the original result without a second debit.

### Config Subscription

On app mount (or when JackpotsPage mounts), `subscribeToConfigUpdates()` opens a Supabase Realtime channel on `mini_game_config`. Any INSERT or UPDATE row event triggers `loadConfigs()` to re-fetch all configs. This ensures card display reflects admin changes within 5 seconds.

---

## Data Models

### Database Schema

### Table: `mini_game_config`

Migration file: `supabase/migrations/create_mini_game_config.sql`

```sql
CREATE TABLE IF NOT EXISTS public.mini_game_config (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id             text        NOT NULL UNIQUE,
  enabled             boolean     NOT NULL DEFAULT false,
  min_bet             numeric(10,2) NOT NULL DEFAULT 10,
  max_bet             numeric(10,2) NOT NULL DEFAULT 1000,
  prize_tiers         jsonb       NOT NULL DEFAULT '[]',
  -- e.g. [{"label":"2x","multiplier":2,"probability":0.30}, ...]
  outcome_probabilities jsonb     NOT NULL DEFAULT '{}',
  -- probabilities must sum to 1.00 (100%); validated server-side
  maintenance         boolean     NOT NULL DEFAULT false,
  game_specific_rules jsonb       NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mini_game_config_game_id_idx ON public.mini_game_config (game_id);

ALTER TABLE public.mini_game_config ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read enabled configs
CREATE POLICY "Players can read mini game configs"
  ON public.mini_game_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only service role and admins can write
CREATE POLICY "Service role manages mini game configs"
  ON public.mini_game_config FOR ALL
  USING (auth.role() = 'service_role');
```

Prize tiers JSONB schema (per element):
```jsonc
{
  "label": "2x",          // display label
  "multiplier": 2.0,      // payout = stake * multiplier
  "probability": 0.30,    // fraction (0–1); all must sum to 1.00
  "symbol": "💎"          // optional display symbol
}
```

### Table: `mini_game_rounds`

Migration file: `supabase/migrations/create_mini_game_rounds.sql`

```sql
CREATE TABLE IF NOT EXISTS public.mini_game_rounds (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key   uuid        NOT NULL UNIQUE,   -- same as id for single-phase
  user_id           uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  game_id           text        NOT NULL,
  stake             numeric(10,2) NOT NULL,
  outcome           jsonb       NOT NULL DEFAULT '{}',
  payout            numeric(10,2) NOT NULL DEFAULT 0,
  phase             text        NOT NULL DEFAULT 'complete',
  -- 'pending' during two-phase initiation; 'complete' once payout credited
  created_at        timestamptz NOT NULL DEFAULT now(),
  settled_at        timestamptz
);

CREATE INDEX IF NOT EXISTS mini_game_rounds_user_id_idx    ON public.mini_game_rounds (user_id);
CREATE INDEX IF NOT EXISTS mini_game_rounds_game_id_idx    ON public.mini_game_rounds (game_id);
CREATE INDEX IF NOT EXISTS mini_game_rounds_created_at_idx ON public.mini_game_rounds (created_at);

ALTER TABLE public.mini_game_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players read own rounds"
  ON public.mini_game_rounds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages rounds"
  ON public.mini_game_rounds FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins read all rounds"
  ON public.mini_game_rounds FOR SELECT
  USING (
    public.get_my_admin_role() IN ('super_admin','finance_admin','support_agent','game_manager')
  );
```

### Admin Audit Log

Admin config changes use the existing `admin_audit_log` table (or equivalent). Each save records: `admin_id`, `table_name = 'mini_game_config'`, `record_id = game_id`, `changed_fields` (jsonb diff), `timestamp`.

---

## Server-Side Game Engine (Supabase RPCs)

All RPCs use `SECURITY DEFINER` and `SET search_path = public`. All financial operations happen inside a single transaction with `FOR UPDATE` on the `profiles` row.

### Single-Phase RPC: `play_mini_game`

Used by: Neon Lucky Wheel, Mini Slot Jackpot, Mystery Multiplier, Crystal Match

```sql
CREATE OR REPLACE FUNCTION public.play_mini_game(
  p_user_id         uuid,
  p_game_id         text,
  p_stake           numeric,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config          mini_game_config%ROWTYPE;
  v_balance         numeric;
  v_new_balance     numeric;
  v_outcome         jsonb;
  v_payout          numeric;
  v_round_id        uuid;
  v_existing_round  mini_game_rounds%ROWTYPE;
BEGIN
  -- 1. Auth check
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- 2. Idempotency: return existing result if key already used
  SELECT * INTO v_existing_round
    FROM mini_game_rounds
   WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'round_id',    v_existing_round.id,
      'outcome',     v_existing_round.outcome,
      'payout',      v_existing_round.payout,
      'duplicate',   true
    );
  END IF;

  -- 3. Load and validate config
  SELECT * INTO v_config FROM mini_game_config WHERE game_id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF NOT v_config.enabled THEN RAISE EXCEPTION 'Game not available'; END IF;
  IF v_config.maintenance THEN RAISE EXCEPTION 'Game under maintenance'; END IF;
  IF p_stake < v_config.min_bet THEN RAISE EXCEPTION 'Stake below minimum'; END IF;
  IF p_stake > v_config.max_bet THEN RAISE EXCEPTION 'Stake above maximum'; END IF;

  -- 4. Lock balance and validate funds
  SELECT balance INTO v_balance
    FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_balance < p_stake THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  -- 5. Generate outcome server-side (weighted random from prize_tiers)
  v_outcome := generate_mini_game_outcome(v_config.prize_tiers, p_game_id);
  v_payout  := ROUND(p_stake * (v_outcome->>'multiplier')::numeric, 2);

  -- 6. Atomic balance update: debit stake, credit payout
  v_new_balance := ROUND((v_balance - p_stake + v_payout)::numeric, 2);
  IF v_new_balance < 0 THEN v_new_balance := 0; END IF;
  UPDATE profiles SET balance = v_new_balance, updated_at = now()
   WHERE id = p_user_id;

  -- 7. Insert round record
  v_round_id := gen_random_uuid();
  INSERT INTO mini_game_rounds
    (id, idempotency_key, user_id, game_id, stake, outcome, payout, phase, settled_at)
  VALUES
    (v_round_id, p_idempotency_key, p_user_id, p_game_id, p_stake,
     v_outcome, v_payout, 'complete', now());

  RETURN jsonb_build_object(
    'round_id',    v_round_id,
    'outcome',     v_outcome,
    'payout',      v_payout,
    'new_balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.play_mini_game(uuid, text, numeric, uuid) TO authenticated;
```

### Two-Phase RPCs: `initiate_mini_game` and `claim_mini_game_result`

Used by: Neon Scratch Cards, Cyber Treasure Chest

**Phase 1 — `initiate_mini_game`**: debits stake, generates outcome (stored in `mini_game_rounds` with `phase = 'pending'`), returns `round_id`. Outcome is server-determined but not yet revealed to the client.

**Phase 2 — `claim_mini_game_result`**: validates the round is pending and owned by the caller, credits payout, updates `phase = 'complete'`, returns outcome payload and new balance.

The two-phase approach prevents the client from knowing the outcome before committing to the reveal interaction. Idempotency is enforced at both phases via `idempotency_key`.

### Helper Function: `generate_mini_game_outcome`

```sql
CREATE OR REPLACE FUNCTION public.generate_mini_game_outcome(
  p_prize_tiers jsonb,
  p_game_id     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_roll      numeric;
  v_cumul     numeric := 0;
  v_tier      jsonb;
BEGIN
  -- Cryptographically secure random number in [0, 1)
  v_roll := (gen_random_bytes(4)::bytea::bigint & x'7fffffff'::bigint)::numeric
            / 2147483648.0;

  FOR v_tier IN SELECT * FROM jsonb_array_elements(p_prize_tiers)
  LOOP
    v_cumul := v_cumul + (v_tier->>'probability')::numeric;
    IF v_roll < v_cumul THEN
      RETURN v_tier;
    END IF;
  END LOOP;

  -- Fallback: return last tier (handles floating-point rounding)
  RETURN p_prize_tiers -> (jsonb_array_length(p_prize_tiers) - 1);
END;
$$;
```

### History RPC: `get_mini_game_history`

```sql
CREATE OR REPLACE FUNCTION public.get_mini_game_history(
  p_user_id uuid,
  p_game_id text,
  p_limit   int DEFAULT 20
)
RETURNS TABLE (
  round_id   uuid,
  game_id    text,
  stake      numeric,
  payout     numeric,
  net_result numeric,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, game_id, stake, payout, (payout - stake) AS net_result, created_at
    FROM mini_game_rounds
   WHERE user_id = p_user_id
     AND (p_game_id = '' OR game_id = p_game_id)
     AND phase = 'complete'
   ORDER BY created_at DESC
   LIMIT LEAST(p_limit, 20);
$$;

GRANT EXECUTE ON FUNCTION public.get_mini_game_history(uuid, text, int) TO authenticated;
```

### Admin Config RPC: `update_mini_game_config`

```sql
CREATE OR REPLACE FUNCTION public.update_mini_game_config(
  p_game_id text,
  p_config  jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role  text;
  v_min_bet     numeric;
  v_max_bet     numeric;
  v_tiers       jsonb;
  v_prob_sum    numeric := 0;
  v_tier        jsonb;
  v_tier_count  int;
BEGIN
  -- Admin auth
  v_admin_role := public.get_my_admin_role();
  IF v_admin_role NOT IN ('super_admin','game_manager') THEN
    RAISE EXCEPTION 'Insufficient admin role';
  END IF;

  -- Extract and validate fields
  v_min_bet := (p_config->>'min_bet')::numeric;
  v_max_bet := (p_config->>'max_bet')::numeric;
  v_tiers   := p_config->'prize_tiers';

  IF v_min_bet IS NULL OR v_min_bet <= 0 THEN
    RAISE EXCEPTION 'min_bet must be greater than 0';
  END IF;
  IF v_max_bet IS NULL OR v_max_bet <= v_min_bet THEN
    RAISE EXCEPTION 'max_bet must be greater than min_bet';
  END IF;

  v_tier_count := jsonb_array_length(v_tiers);
  IF v_tier_count > 20 THEN
    RAISE EXCEPTION 'prize_tiers cannot exceed 20 entries';
  END IF;

  FOR v_tier IN SELECT * FROM jsonb_array_elements(v_tiers)
  LOOP
    IF (v_tier->>'multiplier')::numeric <= 0 THEN
      RAISE EXCEPTION 'All multipliers must be greater than 0';
    END IF;
    v_prob_sum := v_prob_sum + (v_tier->>'probability')::numeric;
  END LOOP;

  IF ROUND(v_prob_sum::numeric, 4) <> 1.0000 THEN
    RAISE EXCEPTION 'Outcome probabilities must sum to 1.00 (100%%), got %', v_prob_sum;
  END IF;

  -- Upsert config
  INSERT INTO mini_game_config (game_id, enabled, min_bet, max_bet, prize_tiers,
    outcome_probabilities, maintenance, game_specific_rules, updated_at)
  VALUES (
    p_game_id,
    COALESCE((p_config->>'enabled')::boolean, false),
    v_min_bet, v_max_bet, v_tiers,
    COALESCE(p_config->'outcome_probabilities', '{}'::jsonb),
    COALESCE((p_config->>'maintenance')::boolean, false),
    COALESCE(p_config->'game_specific_rules', '{}'::jsonb),
    now()
  )
  ON CONFLICT (game_id) DO UPDATE SET
    enabled               = EXCLUDED.enabled,
    min_bet               = EXCLUDED.min_bet,
    max_bet               = EXCLUDED.max_bet,
    prize_tiers           = EXCLUDED.prize_tiers,
    outcome_probabilities = EXCLUDED.outcome_probabilities,
    maintenance           = EXCLUDED.maintenance,
    game_specific_rules   = EXCLUDED.game_specific_rules,
    updated_at            = now();

  -- Audit log
  INSERT INTO admin_audit_log (admin_id, table_name, record_id, changed_fields, created_at)
  VALUES (auth.uid(), 'mini_game_config', p_game_id, p_config, now());

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_mini_game_config(text, jsonb) TO authenticated;
```

---

## Per-Game Design Details

### Neon Lucky Wheel

- Single-phase (`play_mini_game`)
- `outcome` payload: `{ "segment_index": 3, "label": "2x", "multiplier": 2.0 }`
- Frontend receives `segment_index` after RPC resolves; CSS rotation animation stops at that segment
- Animation: CSS `transform: rotate()` transition; angle computed from segment index and segment count
- Config: `game_specific_rules.segment_count` (2–20), `prize_tiers` array one-to-one with segments

### Neon Scratch Cards

- Two-phase (`initiate_mini_game` → `claim_mini_game_result`)
- Phase 1 outcome stored server-side; client gets only `round_id`
- Scratch interaction: Canvas 2D API draws a gray overlay; pointer/touch events erase it using `destination-out` composite operation; coverage computed as ratio of transparent pixels
- Phase 2 triggered when coverage > 50%; server returns reveal payload
- Config: `game_specific_rules.card_design` (index 0–1), prize tiers

### Cyber Treasure Chest

- Two-phase (`initiate_mini_game` → `claim_mini_game_result`)
- Phase 1: debit stake, generate which chest contains the prize; client gets `round_id` only
- Phase 2: player selects a chest; `claim_mini_game_result(round_id, selected_index)` returns the outcome
- Config: `game_specific_rules.chest_count` (2–10), prize tiers
- After one chest selected, all other chests disabled (prevent multi-select)

### Mini Slot Jackpot

- Single-phase (`play_mini_game`)
- `outcome` payload: `{ "reels": ["🍒","🍒","🍒"], "payline": "top", "win_key": "three_cherries", "multiplier": 5.0 }`
- 3-reel layout using same CSS reel-strip animation pattern as existing `GameCanvas.tsx`
- Config: `game_specific_rules.reel_symbols`, `game_specific_rules.wild_enabled`, `game_specific_rules.bonus_enabled`
- Wild symbol substitutes for non-bonus symbols when `wild_enabled = true`
- Bonus symbol triggers bonus outcome when `bonus_enabled = true`

### Mystery Multiplier

- Single-phase (`play_mini_game`)
- Game view shows rules panel (multiplier range, formula) before bet input
- `outcome` payload: `{ "multiplier": 3.5 }`
- Result display: `{multiplier}x × KES {stake} = KES {payout}` — formula shown explicitly per Requirement 8.5
- Config: prize_tiers encode multiplier distribution

### Crystal Match

- Single-phase (`play_mini_game`)
- `outcome` payload: `{ "grid": [["💎","💎","⭐"],["💎","🔮","⭐"]], "matched_combos": ["three_diamonds"], "tier_label": "Bronze", "multiplier": 3.0 }`
- Round ID, symbol grid, matched combos, and payout displayed post-round for verifiability (Requirement 9.6)
- Config: `game_specific_rules.grid_size` (e.g. `[3,3]`), `game_specific_rules.min_match_count`, prize tiers per combo type

---

## Routing and Navigation

Mini games do **not** introduce a new route. The modal is managed purely by `useMiniGameStore.activeGame`:

```typescript
// In JackpotsPage
const activeGame = useMiniGameStore((s) => s.activeGame);

// MiniGameModal renders when activeGame != null
// Uses a portal to render at document.body level, above all page content
```

- Clicking PLAY NOW: calls `useMiniGameStore.openGame(gameId)` → sets `activeGame`
- Close button / Escape key: calls `useMiniGameStore.closeGame()` → clears `activeGame`, cancels pending rounds
- Browser back button: event listener on `popstate` closes the modal; `pushState` is called on open to create a history entry, so back button produces a natural close rather than leaving the page

### Round Cancellation on Close

If `roundPhase === 'betting'` (stake set but not submitted): reset silently — no RPC call, no balance change.

If `roundPhase === 'processing'`: wait for the in-flight RPC to resolve before clearing state. The in-progress round completes or errors; either way the wallet settles before the modal unmounts.

If `roundPhase === 'result'`: safe to close immediately.

---

## Admin Configuration UI

File: `src/components/admin/MiniGameConfigPanel.tsx`

Located within the existing admin layout. Accessible to `super_admin` and `game_manager` roles.

Fields per game:
- **Enabled** toggle
- **Min Bet** / **Max Bet** numeric inputs
- **Prize Tiers** table editor: label, multiplier, probability (%) — add/remove rows, max 20
- **Probability sum indicator** — shows running total; turns red if ≠ 100%
- **Maintenance Mode** toggle
- **Game-Specific Rules** — JSON editor (collapsible)
- **Save** button → calls `update_mini_game_config` RPC → shows success or field-level error

Validation errors from the RPC are mapped to the appropriate field and displayed inline.

---

## Responsive Design

### MiniGameCard Grid

```css
/* Tailwind classes */
.mini-game-grid {
  display: grid;
  grid-template-columns: 1fr;               /* ≤767px: 1 column */
}
@media (min-width: 768px) {
  .mini-game-grid { grid-template-columns: repeat(2, 1fr); }  /* 768–1023px */
}
@media (min-width: 1024px) {
  .mini-game-grid { grid-template-columns: repeat(3, 1fr); }  /* ≥1024px */
}
```

All cards in a row share the same height via CSS Grid auto-rows.

### MiniGameModal

- Desktop: max-width 640px, centered, with backdrop
- Mobile (≤390px): full-screen, 100vw × 100dvh, no border-radius
- All game controls use fluid sizing (percentages or min/max constraints) to prevent horizontal overflow

---

## Game History Display

Each game view includes a collapsible "Recent Rounds" panel at the bottom. On game open, `loadHistory(gameId, userId)` is called once. The panel shows a table:

| Round ID (first 8 chars) | Stake | Payout | Net | Time |
|---|---|---|---|---|
| `a1b2c3d4` | KES 50 | KES 100 | +KES 50 | 2 min ago |

Net result column: green for positive, red for negative, grey for zero.

---

## Wallet Integration

The frontend never sends a payout amount. The full flow is:

1. Frontend generates `idempotency_key = crypto.randomUUID()`
2. Frontend calls `play_mini_game(userId, gameId, stake, idempotencyKey)` via Supabase RPC
3. Server deducts stake, generates outcome, calculates payout, credits payout — all in one transaction
4. Server returns `{ round_id, outcome, payout, new_balance }`
5. Frontend updates `useMiniGameStore.currentRound` and dispatches `useGameStore.setState({ balance: new_balance })`
6. `useAuthStore.refreshBalance()` is called after round completion to sync the profile balance

The `guard_balance_update` trigger on `profiles` blocks any direct client-side balance increase; the SECURITY DEFINER RPC bypasses it legitimately (same pattern as `apply_spin_result`).

---

## Testing Strategy

### Property-Based Testing Plan

File: `src/store/__tests__/miniGame.property.test.ts`

Using `fast-check` (already a dev dependency):

### P1 — Balance Invariant
```typescript
fc.property(
  fc.record({ balanceBefore: fc.float({ min: 0 }), stake: fc.float({ min: 1 }), payout: fc.float({ min: 0 }) }),
  ({ balanceBefore, stake, payout }) => {
    // Assumes balanceBefore >= stake (valid round)
    const expected = Math.round((balanceBefore - stake + payout) * 100) / 100;
    const actual = computeNewBalance(balanceBefore, stake, payout);
    return Math.abs(actual - expected) < 0.01;
  }
)
```

### P2 — Idempotency
Submit the same `idempotencyKey` twice. Assert: second call returns identical `round_id`, `outcome`, `payout`; no additional row in `mini_game_rounds`; balance unchanged after second call.

### P3 — Zero Balance Change on Rejection
For any rejected bet (stake < min_bet OR stake > max_bet OR stake > balance), assert balance before === balance after.

### P4 — Bet Bounds Enforcement
`fc.property(fc.float(), fc.float(), (stake, minBet) => stake < minBet → rejects)` — test that `play_mini_game` raises exception and makes no DB writes.

### P5 — No Duplicate Round Entries
Assert `SELECT COUNT(*) FROM mini_game_rounds WHERE idempotency_key = $key` is always ≤ 1.

### P6 — Net Result Identity
`netResult = payout - stake`; verify the value stored in `mini_game_rounds` and returned by `get_mini_game_history` matches.

---

## Error Handling

### Frontend Error States

| Scenario | User-facing message | Action |
|---|---|---|
| Config load failure | "Configuration unavailable" on card; hides bet amounts and PLAY NOW | Card shows error state; retry on next Realtime update |
| Insufficient balance | "Insufficient balance" inline error | Bet rejected; no RPC call; balance unchanged |
| Bet below minimum | "Minimum bet is KES {min}" | Bet rejected client-side before RPC |
| Bet above maximum | "Maximum bet is KES {max}" | Bet rejected client-side before RPC |
| RPC network error | "Round could not be started. Please try again." | Idempotency key preserved; retry re-sends same key |
| Duplicate idempotency key | (silent) | Server returns original result; frontend shows it as normal |
| Game under maintenance | "This game is currently under maintenance." | PLAY NOW replaced with MAINTENANCE; no round starts |
| Account restricted | "Your account is restricted." | Round initiation blocked; matches existing auth store behavior |
| Payout credit failure | Transaction rolled back; balance restored | Error displayed; round marked failed in history |
| Two-phase: claim fails | "Could not retrieve outcome. Tap to retry." | `claim_mini_game_result` retried with same round_id; no new debit |

### Backend Error Handling

All RPCs raise named exceptions caught by the Supabase JS client and surfaced as `PostgrestError`. The frontend maps the `message` field to user-facing copy. All exceptions are raised **before** any `UPDATE` or `INSERT` commits, except the payout credit failure path which rolls back the entire transaction.

---

## Correctness Properties

Mapping to Requirement 14:

### Property 1: Balance Invariant

For any completed round where the Game_Engine has generated an outcome and the Wallet_Service has atomically settled the stake debit and payout credit:

`balance_after = balance_before - stake + payout`

Enforced by: `play_mini_game` RPC — single `UPDATE profiles SET balance = v_new_balance` inside one transaction.

**Validates: Requirements 14.1, 10.4, 10.7, 10.8**

### Property 2: Idempotency

Submitting the same `idempotency_key` twice produces no additional debit or credit on the second call, and returns the original round result.

Enforced by: RPC step 2 — `SELECT FROM mini_game_rounds WHERE idempotency_key = p_idempotency_key` before any write; early return if found.

**Validates: Requirements 14.2, 10.9, 10.11, 10.15**

### Property 3: Atomicity (Confluence)

Both the stake debit and payout credit succeed or neither persists. The order of the two operations does not affect the final balance — they are applied atomically in a single transaction.

Enforced by: single PostgreSQL transaction wrapping the `UPDATE profiles` and `INSERT mini_game_rounds`; any exception rolls back both.

**Validates: Requirements 14.3, 10.8, 10.14**

### Property 4: Round-Trip Net Change

For any bet that passes validation and any server-generated outcome:

`net_balance_change = payout - stake`

Enforced by: computed inside the RPC as `v_new_balance = v_balance - p_stake + v_payout`; stored in `mini_game_rounds.payout` and returned to client.

**Validates: Requirements 14.4, 10.10**

### Property 5: Zero Balance Change on Rejection

If a round is rejected before settlement (validation failure or error before the atomic transaction commits), the player's balance is unchanged.

Enforced by: all RAISE EXCEPTION statements occur before any `UPDATE` or `INSERT`; PostgreSQL rolls back on exception automatically.

**Validates: Requirements 14.5, 10.3**

### Property 6: Insufficient Balance Rejection

If a player attempts to place a bet exceeding their available balance, the bet is rejected without any debit.

Enforced by: `IF v_balance < p_stake THEN RAISE EXCEPTION 'Insufficient balance'` — fires before the `UPDATE profiles`.

**Validates: Requirements 14.6, 10.3**

### Property 7: Out-of-Bounds Bet Rejection

If a player attempts to place a bet outside the configured min/max bounds from `mini_game_config`, the bet is rejected without any debit.

Enforced by: config bounds check in RPC — `IF p_stake < v_config.min_bet ... IF p_stake > v_config.max_bet` — fires before the `UPDATE profiles`.

**Validates: Requirements 14.7, 10.3**

### Property 8: No Duplicate Round History Entries

The same `round_id` or `idempotency_key` produces exactly one row in `mini_game_rounds`.

Enforced by: `UNIQUE` constraint on `mini_game_rounds.idempotency_key`; idempotency early-return prevents a second INSERT.

**Validates: Requirements 14.8, 10.10**

---

## Migration Plan

### Phase 0 — Infrastructure (all games COMING SOON)
1. `create_mini_game_config.sql` — creates table, RLS, seeds 6 rows with `enabled = false`
2. `create_mini_game_rounds.sql` — creates table, indexes, RLS
3. `create_mini_game_rpcs.sql` — creates `play_mini_game`, `initiate_mini_game`, `claim_mini_game_result`, `get_mini_game_history`, `generate_mini_game_outcome`, `update_mini_game_config`
4. Frontend: JackpotsPage restructure, MiniGameCard (COMING SOON for all), MiniGameModal scaffold, useMiniGameStore, MiniGameConfigPanel in admin

### Phase 1 — First Playable Game
- Choose one game (recommended: Mystery Multiplier — simplest single-phase)
- Set `enabled = true` in `mini_game_config` for that game via admin panel
- Wire game component to `play_mini_game` RPC
- End-to-end test before proceeding

### Phase 2–6 — Remaining Games
- Each game enabled independently as its component and RPC integration are tested
- Two-phase games (Scratch Cards, Treasure Chest) enabled after single-phase games validated

---

## File Structure

```
src/
├── components/
│   ├── miniGames/
│   │   ├── MiniGameCard.tsx
│   │   ├── MiniGameModal.tsx
│   │   ├── MiniGameHistoryPanel.tsx
│   │   └── games/
│   │       ├── LuckyWheelGame.tsx
│   │       ├── ScratchCardGame.tsx
│   │       ├── TreasureChestGame.tsx
│   │       ├── MiniSlotGame.tsx
│   │       ├── MysteryMultiplierGame.tsx
│   │       └── CrystalMatchGame.tsx
│   └── admin/
│       └── MiniGameConfigPanel.tsx
├── store/
│   ├── miniGameStore.ts
│   └── __tests__/
│       └── miniGame.property.test.ts
└── types/
    └── miniGames.ts         ← MiniGameId, MiniGameConfig, CurrentRound, etc.

supabase/
└── migrations/
    ├── create_mini_game_config.sql
    ├── create_mini_game_rounds.sql
    └── create_mini_game_rpcs.sql
```
