/**
 * MiniGameModal component — portal-based modal overlay for active mini games.
 * Task 3.2 — Mini Jackpot Games spec
 * Requirements: 3.1–3.8
 * Updated task 6.1 — wired MysteryMultiplierGame
 * Updated task 7.1 — wired LuckyWheelGame
 * Updated task 8.1 — wired MiniSlotGame
 * Updated task 12.1 — wired TreasureChestGame
 * Updated task 11.1 — wired ScratchCardGame
 */

import React, { useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { createPortal } from 'react-dom';
import { useMiniGameStore } from '../../store/miniGameStore';
import { useAuthStore } from '../../store/authStore';
import type { MiniGameId } from '../../types/miniGames';

// Lazy-load game components to keep initial bundle small
const MysteryMultiplierGame = lazy(
  () => import('./games/MysteryMultiplierGame')
);
const LuckyWheelGame = lazy(
  () => import('./games/LuckyWheelGame')
);
const MiniSlotGame = lazy(
  () => import('./games/MiniSlotGame')
);
const CrystalMatchGame = lazy(
  () => import('./games/CrystalMatchGame')
);
const TreasureChestGame = lazy(
  () => import('./games/TreasureChestGame')
);
const ScratchCardGame = lazy(
  () => import('./games/ScratchCardGame')
);

// ---------------------------------------------------------------------------
// Display names per game ID
// ---------------------------------------------------------------------------
const GAME_DISPLAY_NAMES: Record<MiniGameId, string> = {
  'lucky-wheel':        'Neon Lucky Wheel',
  'scratch-cards':      'Neon Scratch Cards',
  'treasure-chest':     'Cyber Treasure Chest',
  'mini-slot':          'Mini Slot Jackpot',
  'mystery-multiplier': 'Mystery Multiplier',
  'crystal-match':      'Crystal Match',
};

// Focusable elements selector — used for focus trap
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// ---------------------------------------------------------------------------
// Fallback configs — used when mini_game_config table is not yet seeded.
// These allow games to render and be playable. Admins override via the panel.
// ---------------------------------------------------------------------------
import type { MiniGameConfig } from '../../types/miniGames';

const FALLBACK_CONFIGS: Record<string, MiniGameConfig> = {
  'lucky-wheel': {
    id: 'fallback-lucky-wheel', game_id: 'lucky-wheel', enabled: true,
    min_bet: 10, max_bet: 1000, maintenance: false,
    prize_tiers: [
      { label: 'No Win', multiplier: 0.0,  probability: 0.30, symbol: '💫' },
      { label: '0.5x',   multiplier: 0.5,  probability: 0.25, symbol: '⭐' },
      { label: '1x',     multiplier: 1.0,  probability: 0.20, symbol: '🌟' },
      { label: '2x',     multiplier: 2.0,  probability: 0.14, symbol: '✨' },
      { label: '5x',     multiplier: 5.0,  probability: 0.07, symbol: '💎' },
      { label: '10x',    multiplier: 10.0, probability: 0.03, symbol: '👑' },
      { label: '25x',    multiplier: 25.0, probability: 0.01, symbol: '🏆' },
    ],
    outcome_probabilities: {}, game_specific_rules: {},
    created_at: '', updated_at: '',
  },
  'scratch-cards': {
    id: 'fallback-scratch-cards', game_id: 'scratch-cards', enabled: true,
    min_bet: 10, max_bet: 500, maintenance: false,
    prize_tiers: [
      { label: 'No Prize', multiplier: 0,   probability: 0.50, symbol: '💔' },
      { label: '0.5x',     multiplier: 0.5, probability: 0.25, symbol: '🎴' },
      { label: '2x',       multiplier: 2.0, probability: 0.15, symbol: '🎰' },
      { label: '5x',       multiplier: 5.0, probability: 0.08, symbol: '💰' },
      { label: '10x',      multiplier: 10,  probability: 0.02, symbol: '💎' },
    ],
    outcome_probabilities: {}, game_specific_rules: { card_design: 0 },
    created_at: '', updated_at: '',
  },
  'treasure-chest': {
    id: 'fallback-treasure-chest', game_id: 'treasure-chest', enabled: true,
    min_bet: 10, max_bet: 1000, maintenance: false,
    prize_tiers: [
      { label: 'Empty',  multiplier: 0,   probability: 0.60, symbol: '📦' },
      { label: '1x',     multiplier: 1.0, probability: 0.20, symbol: '💰' },
      { label: '3x',     multiplier: 3.0, probability: 0.12, symbol: '💎' },
      { label: '10x',    multiplier: 10,  probability: 0.08, symbol: '👑' },
    ],
    outcome_probabilities: {}, game_specific_rules: { chest_count: 3 },
    created_at: '', updated_at: '',
  },
  'mini-slot': {
    id: 'fallback-mini-slot', game_id: 'mini-slot', enabled: true,
    min_bet: 10, max_bet: 1000, maintenance: false,
    prize_tiers: [
      { label: 'No Win',     multiplier: 0,   probability: 0.55 },
      { label: 'Pair',       multiplier: 1.5, probability: 0.25 },
      { label: 'Two Pair',   multiplier: 3.0, probability: 0.12 },
      { label: 'Three of a Kind', multiplier: 10, probability: 0.07 },
      { label: 'Jackpot',    multiplier: 50,  probability: 0.01 },
    ],
    outcome_probabilities: {},
    game_specific_rules: {
      reel_symbols: ['🍒', '🍋', '🍊', '🔔', '⭐', '💎'],
      wild_enabled: false, bonus_enabled: false,
    },
    created_at: '', updated_at: '',
  },
  'mystery-multiplier': {
    id: 'fallback-mystery-multiplier', game_id: 'mystery-multiplier', enabled: true,
    min_bet: 10, max_bet: 1000, maintenance: false,
    prize_tiers: [
      { label: '0.5x',  multiplier: 0.5,  probability: 0.35 },
      { label: '1x',    multiplier: 1.0,  probability: 0.30 },
      { label: '2x',    multiplier: 2.0,  probability: 0.20 },
      { label: '5x',    multiplier: 5.0,  probability: 0.10 },
      { label: '10x',   multiplier: 10.0, probability: 0.04 },
      { label: '20x',   multiplier: 20.0, probability: 0.01 },
    ],
    outcome_probabilities: {}, game_specific_rules: {},
    created_at: '', updated_at: '',
  },
  'crystal-match': {
    id: 'fallback-crystal-match', game_id: 'crystal-match', enabled: true,
    min_bet: 10, max_bet: 1000, maintenance: false,
    prize_tiers: [
      { label: 'No Match',  multiplier: 0,   probability: 0.50 },
      { label: 'Bronze',    multiplier: 1.5, probability: 0.25 },
      { label: 'Silver',    multiplier: 3.0, probability: 0.15 },
      { label: 'Gold',      multiplier: 8.0, probability: 0.08 },
      { label: 'Diamond',   multiplier: 25,  probability: 0.02 },
    ],
    outcome_probabilities: {},
    game_specific_rules: { grid_size: [3, 3], min_match_count: 3 },
    created_at: '', updated_at: '',
  },
};

// ---------------------------------------------------------------------------
// GameContent — renders the correct game component based on activeGame
// ---------------------------------------------------------------------------
function GameContent({ activeGame }: { activeGame: MiniGameId }) {
  const configs  = useMiniGameStore((s) => s.configs);
  const profile  = useAuthStore((s) => s.profile);
  const loading  = useAuthStore((s) => s.loading);
  const refreshBalance = useAuthStore((s) => s.refreshBalance);
  const userId   = profile?.id ?? '';

  // If profile isn't loaded yet, kick off a refresh and wait
  const [waited, setWaited] = React.useState(false);
  React.useEffect(() => {
    if (userId) return; // already have it
    // Trigger a profile refresh so the auth store populates profile.id
    void refreshBalance();
    const t = setTimeout(() => setWaited(true), 3000);
    return () => clearTimeout(t);
  }, [userId, refreshBalance]);

  const config = configs[activeGame] ?? (FALLBACK_CONFIGS[activeGame] as MiniGameConfig);

  // Suspense fallback while lazy chunks load
  const loadingFallback = (
    <div
      className="flex items-center justify-center min-h-[300px] text-sm font-orbitron"
      style={{ color: 'rgba(168,85,247,0.6)' }}
    >
      Loading game…
    </div>
  );

  // Profile still loading — show spinner
  if (!userId && (loading || !waited)) {
    return (
      <div className="flex items-center justify-center min-h-[300px] gap-3">
        <div
          className="w-5 h-5 rounded-full border-2 animate-spin shrink-0"
          style={{ borderColor: 'rgba(168,85,247,0.3)', borderTopColor: '#a855f7' }}
        />
        <span className="font-orbitron text-sm" style={{ color: 'rgba(168,85,247,0.6)' }}>
          Loading…
        </span>
      </div>
    );
  }

  // Timed out and still no profile
  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-sm font-orbitron"
        style={{ color: 'rgba(239,68,68,0.7)' }}>
        Please sign in to play.
      </div>
    );
  }

  // Route to the correct per-game component
  switch (activeGame) {
    case 'mystery-multiplier':
      return (
        <Suspense fallback={loadingFallback}>
          <MysteryMultiplierGame
            gameId="mystery-multiplier"
            config={config}
            userId={userId}
          />
        </Suspense>
      );

    case 'lucky-wheel':
      return (
        <Suspense fallback={loadingFallback}>
          <LuckyWheelGame
            gameId="lucky-wheel"
            config={config}
            userId={userId}
          />
        </Suspense>
      );

    case 'mini-slot':
      return (
        <Suspense fallback={loadingFallback}>
          <MiniSlotGame
            gameId="mini-slot"
            config={config}
            userId={userId}
          />
        </Suspense>
      );

    case 'crystal-match':
      return (
        <Suspense fallback={loadingFallback}>
          <CrystalMatchGame
            gameId="crystal-match"
            config={config}
            userId={userId}
          />
        </Suspense>
      );

    case 'treasure-chest':
      return (
        <Suspense fallback={loadingFallback}>
          <TreasureChestGame
            gameId="treasure-chest"
            config={config}
            userId={userId}
          />
        </Suspense>
      );

    case 'scratch-cards':
      return (
        <Suspense fallback={loadingFallback}>
          <ScratchCardGame
            gameId="scratch-cards"
            config={config}
            userId={userId}
          />
        </Suspense>
      );

    default:
      // Other games not yet implemented — COMING SOON placeholder
      return (
        <div className="p-6 flex items-center justify-center min-h-[300px] text-gray-500 text-sm">
          Game content coming soon
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function MiniGameModal() {
  const activeGame = useMiniGameStore((s) => s.activeGame);
  const closeGame  = useMiniGameStore((s) => s.closeGame);

  const modalRef = useRef<HTMLDivElement>(null);

  // ── Focus trap ─────────────────────────────────────────────────────────────
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!modalRef.current) return [];
    return Array.from(
      modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((el) => !el.hasAttribute('disabled'));
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeGame();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = getFocusableElements();
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last  = focusable[focusable.length - 1];

        if (e.shiftKey) {
          // Shift+Tab — wrap backward
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          // Tab — wrap forward
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [closeGame, getFocusableElements]
  );

  // ── popstate listener (browser back button) ────────────────────────────────
  const handlePopState = useCallback(() => {
    closeGame();
  }, [closeGame]);

  // ── Mount/unmount effects ──────────────────────────────────────────────────
  useEffect(() => {
    if (!activeGame) return;

    // Focus first focusable element on mount
    const focusable = getFocusableElements();
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      // Fallback: focus the modal panel itself
      modalRef.current?.focus();
    }

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeGame, handleKeyDown, handlePopState, getFocusableElements]);

  // Don't render when no active game
  if (!activeGame) return null;

  const displayName = GAME_DISPLAY_NAMES[activeGame];

  // ── Modal panel — full-screen on mobile, centered sheet on desktop ──────────
  const panelClasses = [
    'bg-[#0a0a0a] border border-purple-700/50 relative flex flex-col overflow-x-hidden',
    // Mobile: full height, no rounding — use 100% not 100vw to avoid scrollbar overflow
    'w-full h-[100dvh] rounded-none',
    // Desktop (≥ sm): centered, max-width, max-height, rounded
    'sm:w-full sm:max-w-2xl sm:mx-4 sm:h-auto sm:max-h-[92vh] sm:rounded-2xl',
  ].join(' ');

  // ── Render via portal ──────────────────────────────────────────────────────
  return createPortal(
    /* Backdrop */
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
      aria-hidden="false"
      onClick={(e) => {
        // Close when clicking outside the modal panel
        if (e.target === e.currentTarget) closeGame();
      }}
    >
      {/* Modal panel */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mini-game-modal-title"
        className={panelClasses}
        tabIndex={-1}
        // Prevent backdrop click from firing when clicking inside panel
        onClick={(e) => e.stopPropagation()}
      >
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-purple-800/30 shrink-0">
          <h2
            id="mini-game-modal-title"
            className="font-orbitron text-white uppercase tracking-wider text-base sm:text-lg"
          >
            {displayName}
          </h2>
          <button
            onClick={closeGame}
            aria-label="Close game"
            className="text-gray-400 hover:text-white text-2xl leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded"
          >
            ✕
          </button>
        </div>

        {/* ---- Game content — scrollable on mobile ---- */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <GameContent activeGame={activeGame} />
        </div>
      </div>
    </div>,
    document.body
  );
}
