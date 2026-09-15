# Requirements Document

## Introduction

This feature migrates the visual rendering layer of the Neon Noir Casino slot machine from React/framer-motion DOM rendering to PixiJS WebGL rendering. The goal is to replace only the reel grid, symbol display, and win/jackpot animations with GPU-accelerated WebGL graphics while leaving all game logic, state management (Zustand), wallet updates, API calls, and React UI controls entirely unchanged.

The PixiJS canvas replaces the `ReelGrid` component and its children (`ReelColumn`, `SymbolCell`). Everything outside the reel viewport — `SpinControls`, `BettingControls`, `FreeSpinsBanner`, `WinDisplay`, modals, Navbar — remains as React/Tailwind. All new PixiJS code lives under `src/pixi/`.

## Glossary

- **PixiJS_App**: The `PIXI.Application` instance that owns the WebGL renderer, stage, and ticker.
- **PixiJS_Canvas**: The `<canvas>` element created and managed by `PixiJS_App`, embedded inside the React component tree via a `ref`.
- **Reel**: A single vertical strip of symbols, one of five reels numbered 0–4 (left to right).
- **Symbol_Sprite**: A `PIXI.Sprite` or `PIXI.Text` object representing one symbol within a Reel.
- **Reel_Strip**: The full array of Symbol_Sprites on one Reel, including off-screen buffer rows used during spin animation.
- **Spin_Phase**: One of four sequential phases of a Reel's animation cycle: `IDLE`, `ACCELERATE`, `SPIN`, `DECELERATE`.
- **Stop_Sequence**: The ordered stopping of Reels 0 → 1 → 2 → 3 → 4, each delayed by a configurable interval.
- **Bounce**: A brief overshoot-and-return animation at the end of `DECELERATE` that simulates physical reel inertia.
- **Win_Line**: The set of cells identified by a `WinResult` from `evaluatePaylines()` that form a winning combination.
- **Win_Line_Overlay**: A graphical line drawn over the PixiJS_Canvas connecting winning cells on a Win_Line.
- **Particle_Emitter**: A PixiJS-managed system that spawns, updates, and removes particle sprites (coins, sparks, neon bursts).
- **Asset_Loader**: The module in `src/pixi/assets/` responsible for preloading all textures and reporting progress.
- **PixiSlotBridge**: The React component at `src/pixi/PixiSlotBridge.tsx` that mounts the PixiJS_App into the DOM and subscribes to the Zustand `gameStore`.
- **GlowFilter**: A `@pixi/filter-glow` filter that adds a coloured neon halo around a sprite.
- **BlurFilter**: A `PIXI.BlurFilter` used to simulate depth-of-field or transition softening.
- **MotionBlurFilter**: A `@pixi/filter-motion-blur` filter applied to spinning Reels to convey velocity.
- **ColorMatrixFilter**: A `PIXI.ColorMatrixFilter` used for brightness, saturation, and greyscale effects.
- **Neon_Noir_Palette**: The visual theme: `#000000` background, `#fde047` (neon yellow), `#a855f7` (purple), `#22d3ee` (cyan) accents.
- **SpinGrid**: The `SpinGrid` type from `src/logic/rng.ts` — a 5×3 matrix of `SymbolId` values representing the outcome of a spin.
- **WinResult**: The `WinResult` type from `src/logic/paylines.ts` containing `paylineIndex`, `matchedSymbol`, `matchCount`, `cells`, `payout`, and `isWild`.
- **gameStore**: The Zustand store at `src/store/gameStore.ts` that owns `reels`, `isSpinning`, `winResults`, `turboMode`, and `lastWin`.
- **jackpotStore**: The Zustand store at `src/store/jackpotStore.ts` that owns `pendingWin`.

---

## Requirements

### Requirement 1: PixiJS Application Bootstrap

**User Story:** As a developer, I want a PixiJS WebGL application to initialise inside the React component tree, so that all subsequent WebGL rendering targets a single managed canvas.

#### Acceptance Criteria

1. THE PixiJS_App SHALL initialise with `antialias: true`, `backgroundAlpha: 0`, `resolution: window.devicePixelRatio`, and `autoDensity: true`.
2. WHEN the PixiSlotBridge component mounts, THE PixiJS_App SHALL attach the PixiJS_Canvas to the designated DOM container within 500ms.
3. WHEN the PixiSlotBridge component unmounts, THE PixiJS_App SHALL call `destroy(true)` to release all WebGL resources and remove the PixiJS_Canvas from the DOM.
4. THE PixiJS_App SHALL target 60 frames per second using the PixiJS ticker.
5. IF WebGL is unavailable in the user's browser, THEN THE PixiSlotBridge SHALL render a fallback message informing the user that WebGL is required and the React-based ReelGrid SHALL remain visible.

---

### Requirement 2: Asset Loading and Preloading Progress

**User Story:** As a player, I want the slot machine to display a loading indicator while assets are being fetched, so that I never see a blank or broken canvas.

#### Acceptance Criteria

1. THE Asset_Loader SHALL preload all Symbol_Sprite textures before the first frame is rendered on the PixiJS_Canvas.
2. WHEN asset loading begins, THE PixiSlotBridge SHALL display a loading overlay with a numeric progress percentage computed as `(loaded / total) * 100`, rounded to the nearest integer.
3. WHEN all assets have loaded successfully, THE PixiSlotBridge SHALL hide the loading overlay and display the PixiJS_Canvas within one animation frame.
4. IF any asset fails to load, THEN THE Asset_Loader SHALL log the failed URL and substitute a procedurally generated placeholder texture so that the game remains playable.
5. THE Asset_Loader SHALL expose a `preload(): Promise<void>` function that resolves when all assets are ready or have been substituted with placeholders.

---

### Requirement 3: Reel Strip Composition

**User Story:** As a player, I want each reel to display three visible symbols at all times, so that the 5×3 game grid is always fully populated.

#### Acceptance Criteria

1. THE PixiJS_App SHALL render exactly five Reels arranged horizontally, each Reel containing exactly three visible Symbol_Sprites in a vertical column.
2. WHEN the gameStore `reels` state changes and `isSpinning` is `false`, THE Reel_Strip SHALL update each Symbol_Sprite to reflect the `SymbolId` values from the SpinGrid without triggering a spin animation.
3. THE PixiJS_App SHALL maintain a minimum of two off-screen buffer Symbol_Sprites above the visible window per Reel to enable seamless scroll animation during `SPIN` phase.
4. WHILE `isSpinning` is `false`, THE PixiJS_App SHALL render each Reel in `IDLE` phase with no positional animation and no MotionBlurFilter applied.
5. THE Symbol_Sprite for a Wild symbol SHALL use the `#a855f7` (purple) tint channel and a GlowFilter with colour `0xa855f7` at intensity `0.5`.
6. THE Symbol_Sprite for a Scatter symbol SHALL use the `#fde047` (neon yellow) tint channel and a GlowFilter with colour `0xfde047` at intensity `0.5`.

---

### Requirement 4: Reel Spin Physics Animation

**User Story:** As a player, I want each reel to animate through a realistic physics sequence — accelerate, spin at full speed, decelerate, then snap to a stop with a bounce — so that the spinning feels mechanical and satisfying.

#### Acceptance Criteria

1. WHEN `isSpinning` transitions from `false` to `true` in gameStore, THE PixiJS_App SHALL begin the `ACCELERATE` phase for all five Reels simultaneously.
2. WHILE in `ACCELERATE` phase, THE Reel SHALL increase its scroll velocity from `0` to the configured peak velocity over a duration of 120ms in normal mode or 60ms in turboMode.
3. WHILE in `SPIN` phase, THE Reel SHALL scroll at constant peak velocity and THE MotionBlurFilter SHALL be applied with a velocity-proportional blur vector.
4. WHEN `isSpinning` transitions from `true` to `false` in gameStore, THE PixiJS_App SHALL begin the `DECELERATE` phase for Reel 0 first, then trigger each subsequent Reel's `DECELERATE` phase after an interval of 150ms in normal mode or 80ms in turboMode.
5. WHILE in `DECELERATE` phase, THE Reel SHALL reduce scroll velocity from peak to `0` over a duration of 400ms in normal mode or 180ms in turboMode, using an ease-out curve.
6. WHEN a Reel reaches velocity `0` at the end of `DECELERATE`, THE Reel SHALL execute the Bounce animation: overshoot by 12px downward over 80ms then spring back to the resting position over 120ms.
7. WHEN a Reel completes the Bounce, THE MotionBlurFilter SHALL be removed from that Reel and the final Symbol_Sprites SHALL snap to their grid-aligned positions.
8. WHILE in `SPIN` phase, THE PixiJS_App SHALL recycle Symbol_Sprites by moving those that scroll off the bottom of the visible window to the top of the Reel_Strip with a randomly assigned SymbolId from the active game's symbol set.

---

### Requirement 5: Win Line Animations

**User Story:** As a player, I want winning symbol cells to flash and glow after a spin resolves, and win lines to be drawn across the grid, so that I can immediately identify my winning combinations.

#### Acceptance Criteria

1. WHEN `isSpinning` is `false` and `winResults` in gameStore is non-empty, THE PixiJS_App SHALL apply a GlowFilter with colour `0xfde047` and intensity `1.0` to each Symbol_Sprite whose `[col, row]` coordinates appear in any `WinResult.cells` array.
2. WHEN `isSpinning` is `false` and `winResults` is non-empty, THE PixiJS_App SHALL scale each winning Symbol_Sprite from `1.0` to `1.15` and back to `1.0` in a continuous loop with period 800ms using a sine-wave easing.
3. WHEN `isSpinning` is `false` and `winResults` is non-empty, THE PixiJS_App SHALL draw a Win_Line_Overlay for each `WinResult` connecting the centre points of its winning cells using a neon yellow line with width `3px`, opacity `0.8`, and a pulsing alpha animation cycling between `0.5` and `1.0` every 600ms.
4. WHEN `isSpinning` transitions from `false` to `true`, THE PixiJS_App SHALL immediately remove all Win_Line_Overlays and reset all Symbol_Sprite scales to `1.0` and remove all win GlowFilters.
5. WHERE `WinResult.isWild` is `true`, THE PixiJS_App SHALL apply a ColorMatrixFilter with a rainbow-cycle hue rotation to the winning Symbol_Sprites in addition to the standard GlowFilter.

---

### Requirement 6: Jackpot and Big Win Particle Effects

**User Story:** As a player, I want an explosive particle celebration when a jackpot or large win is triggered, so that the magnitude of the win is communicated visually.

#### Acceptance Criteria

1. WHEN `isJackpot` in gameStore transitions to `true`, THE PixiJS_App SHALL activate a Particle_Emitter that spawns at least 200 particles consisting of coin sprites, spark sprites, and neon burst sprites within 100ms.
2. WHILE the jackpot Particle_Emitter is active, THE PixiJS_App SHALL animate each particle with an initial upward velocity between 300px/s and 600px/s, a gravity of 200px/s², and a lifespan between 1.5s and 3.0s.
3. WHEN `lastWin` in gameStore is greater than or equal to 10× the current `bet` and `isJackpot` is `false`, THE PixiJS_App SHALL activate a Particle_Emitter that spawns at least 80 spark and neon burst particles.
4. WHEN a Particle_Emitter has no remaining live particles, THE PixiJS_App SHALL deactivate the emitter and remove all associated display objects from the stage.
5. THE Particle_Emitter SHALL use sprites that match the Neon_Noir_Palette: yellow coins (`0xfde047`), purple sparks (`0xa855f7`), and cyan bursts (`0x22d3ee`).

---

### Requirement 7: Idle Symbol Animations

**User Story:** As a player, I want premium symbols to subtly animate while the reels are idle, so that the game feels alive even when not spinning.

#### Acceptance Criteria

1. WHILE `isSpinning` is `false`, THE PixiJS_App SHALL apply a slow breathing scale animation to Wild Symbol_Sprites, cycling between scale `0.95` and `1.05` with a period of 2000ms.
2. WHILE `isSpinning` is `false`, THE PixiJS_App SHALL apply a pulsing GlowFilter to Scatter Symbol_Sprites, cycling the glow intensity between `0.3` and `0.7` with a period of 1500ms.
3. THE idle animations in AC 7.1 and 7.2 SHALL NOT be applied to Symbol_Sprites that are currently in a win state as defined by Requirement 5.
4. WHILE `isSpinning` is `true`, THE PixiJS_App SHALL suspend all idle animations described in AC 7.1 and 7.2 to avoid visual conflicts with spin physics.

---

### Requirement 8: Responsive Canvas Layout

**User Story:** As a player on any device, I want the reel grid canvas to scale correctly across desktop, tablet, and mobile screen sizes while maintaining its aspect ratio, so that symbols are never cropped or distorted.

#### Acceptance Criteria

1. THE PixiJS_Canvas SHALL maintain an intrinsic aspect ratio of 5:3 (width:height, matching the 5-column × 3-row grid) at all viewport sizes.
2. WHEN the browser viewport width is greater than or equal to 768px, THE PixiJS_Canvas SHALL render at a maximum width of 560px.
3. WHEN the browser viewport width is less than 768px, THE PixiJS_Canvas SHALL fill 100% of its parent container width.
4. WHEN the browser window is resized, THE PixiJS_App SHALL call its `resize()` method within one animation frame to update the renderer dimensions, preserving the aspect ratio defined in AC 8.1.
5. THE PixiJS_Canvas CSS SHALL use `object-fit: contain` so that the canvas never overflows its container.
6. THE PixiJS_App SHALL set `renderer.resolution` to `window.devicePixelRatio` on initialisation and after every resize event to ensure crisp rendering on high-DPI displays.

---

### Requirement 9: PixiJS Filter Usage

**User Story:** As a developer, I want a defined set of PixiJS filters used consistently across effects, so that the visual style is coherent and performance is predictable.

#### Acceptance Criteria

1. THE PixiJS_App SHALL use GlowFilter exclusively for: Wild Symbol_Sprites (AC 3.5), Scatter Symbol_Sprites (AC 3.6), winning Symbol_Sprites (AC 5.1), and idle Scatter pulsing (AC 7.2).
2. THE PixiJS_App SHALL use MotionBlurFilter exclusively during `SPIN` and early `DECELERATE` phases as defined in AC 4.3, and SHALL remove it as defined in AC 4.7.
3. THE PixiJS_App SHALL use BlurFilter for the asset loading overlay fade-in transition when the PixiJS_Canvas first becomes visible.
4. THE PixiJS_App SHALL use ColorMatrixFilter exclusively for the wild win rainbow-cycle effect defined in AC 5.5.
5. THE PixiJS_App SHALL NOT apply more than three simultaneous filters to any single display object to maintain GPU performance.
6. WHEN `turboMode` is `true` in gameStore, THE PixiJS_App SHALL reduce all animation durations by 60% and SHALL reduce particle counts by 50% relative to normal mode values.

---

### Requirement 10: React–PixiJS Integration Bridge

**User Story:** As a developer, I want a clean boundary between React state and PixiJS rendering, so that game logic and UI controls remain in React while only visual output crosses into PixiJS.

#### Acceptance Criteria

1. THE PixiSlotBridge SHALL subscribe to `reels`, `isSpinning`, `winResults`, `turboMode`, `lastWin`, and `isJackpot` from gameStore using Zustand selectors, and SHALL propagate state changes to the PixiJS_App imperatively via a stable API.
2. THE PixiSlotBridge SHALL NOT call any gameStore action (`spin`, `setBet`, `toggleAutoplay`, etc.) — it is a read-only consumer of game state.
3. THE SlotMachinePage SHALL replace the `<ReelGrid>` JSX element with `<PixiSlotBridge>` while keeping all other child components (`SpinControls`, `BettingControls`, `FreeSpinsBanner`, `WinDisplay`) and modal components unchanged.
4. THE PixiSlotBridge SHALL accept the same `gameId` prop that the current `ReelGrid` uses for theme-specific symbol sets, and SHALL pass it to the Asset_Loader to select the correct textures.
5. WHEN `isSpinning` changes from `false` to `true` in gameStore, THE PixiSlotBridge SHALL call `pixiApp.startSpin()` within the same JavaScript event loop tick to avoid a one-frame delay.
6. THE PixiSlotBridge SHALL be organised as a React functional component using `useRef` for the canvas container and `useEffect` for PixiJS_App lifecycle management.

---

### Requirement 11: Code Organisation Under src/pixi/

**User Story:** As a developer, I want all PixiJS-related code isolated in a dedicated directory, so that the boundary between React and PixiJS is unambiguous and the code is easy to navigate.

#### Acceptance Criteria

1. THE PixiJS_App SHALL be implemented in files located exclusively under `src/pixi/`, with no PixiJS imports appearing outside that directory except in `PixiSlotBridge.tsx`.
2. THE `src/pixi/` directory SHALL contain at minimum the following sub-modules: `app/` (PixiJS_App initialisation), `reels/` (Reel_Strip and Spin_Phase logic), `effects/` (filters, win lines, particles), `assets/` (Asset_Loader), and `bridge/` (PixiSlotBridge integration utilities).
3. THE Asset_Loader SHALL be implemented in `src/pixi/assets/AssetLoader.ts` and SHALL export `preload(gameId: string): Promise<void>` and `getTexture(symbolId: SymbolId): PIXI.Texture`.
4. THE Reel animation logic SHALL be implemented in `src/pixi/reels/ReelController.ts` and SHALL export a `ReelController` class with methods `startSpin()`, `stopSpin(finalSymbols: SymbolId[])`, and `update(delta: number)`.
5. THE Particle_Emitter logic SHALL be implemented in `src/pixi/effects/ParticleEmitter.ts` and SHALL export a `ParticleEmitter` class with methods `emit(type: 'jackpot' | 'bigWin')` and `update(delta: number)`.

---

### Requirement 12: Neon Noir Theme Fidelity

**User Story:** As a player, I want the PixiJS-rendered reel grid to visually match the existing Neon Noir Casino aesthetic, so that migrating from DOM rendering produces no perceptible theme regression.

#### Acceptance Criteria

1. THE PixiJS_Canvas background colour SHALL be `0x000000` with alpha `0` so that the existing CSS `bg-gray-950` body background shows through.
2. THE PixiJS_App SHALL render a neon border rectangle around each Symbol_Sprite cell using `PIXI.Graphics` with a `0x1a1a2e` fill and a `0xffffff` (10% opacity) stroke, matching the `border-white/10` CSS class used by the existing SymbolCell component.
3. THE PixiJS_App SHALL render the reel container background as a rounded rectangle using `PIXI.Graphics` with fill `0x000000` at 60% alpha and a `0xfde047` stroke at 60% opacity when `winResults` is non-empty, and a `0xffffff` stroke at 10% opacity when `winResults` is empty — matching the existing `ReelGrid` CSS border logic.
4. THE font for symbol labels rendered via `PIXI.Text` (when texture fallback is used) SHALL use `font-family: 'Orbitron', monospace` with `fill: '#ffffff'` and font size `28px`.
5. THE neon glow colours SHALL use exclusively Neon_Noir_Palette values: `0xfde047` for yellow, `0xa855f7` for purple, and `0x22d3ee` for cyan.

---

### Requirement 13: Symbol Texture Generation (Fallback and Programmatic)

**User Story:** As a developer, I want symbols to render correctly even before dedicated image assets are created, so that the PixiJS migration can be developed and tested independently of art production.

#### Acceptance Criteria

1. WHEN a symbol texture file is not available, THE Asset_Loader SHALL generate a procedural `PIXI.RenderTexture` for that symbol using the symbol's `emoji` string rendered via `PIXI.Text` centred on a rounded rectangle background.
2. THE procedural texture background colour SHALL reflect the symbol tier: `0x1a0a2e` for `isPremium: true` symbols and `0x0a0a1a` for `isPremium: false` symbols.
3. THE Asset_Loader SHALL generate one texture per unique `SymbolId` per game theme, and SHALL cache all generated textures in a `Map<SymbolId, PIXI.Texture>` keyed by `SymbolId`.
4. THE Asset_Loader SHALL expose a `getTexture(symbolId: SymbolId): PIXI.Texture` function that returns the cached texture, or generates it on demand if not yet cached.
5. FOR ALL SymbolId values in a game's symbol set, calling `getTexture(symbolId)` SHALL return a valid non-null `PIXI.Texture` (round-trip property: every symbol always has a renderable texture).

---

### Requirement 14: Performance Targets

**User Story:** As a player, I want the slot machine to run smoothly at all times without frame drops, so that the experience feels premium and responsive.

#### Acceptance Criteria

1. THE PixiJS_App SHALL sustain a minimum of 60 frames per second during `IDLE` phase on devices with a GPU that supports WebGL 1.0 or higher.
2. THE PixiJS_App SHALL sustain a minimum of 60 frames per second during `SPIN` phase with all five Reels spinning and MotionBlurFilter active.
3. THE PixiJS_App SHALL sustain a minimum of 30 frames per second during jackpot Particle_Emitter activity with 200 live particles on devices with WebGL 1.0 support.
4. THE PixiJS_App SHALL use `PIXI.ParticleContainer` for Particle_Emitter rendering instead of `PIXI.Container` to reduce draw calls during particle bursts.
5. THE PixiJS_App SHALL reuse Symbol_Sprite instances via object pooling rather than destroying and recreating sprites on each spin to minimise garbage collection pauses.
6. THE PixiJS_App SHALL batch all `PIXI.Graphics` draw calls for Win_Line_Overlays into a single `PIXI.Graphics` object per frame update.
