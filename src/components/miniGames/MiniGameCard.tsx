/**
 * MiniGameCard — redesigned to match the JackpotCard visual language.
 * Same structure: top accent stripe, icon+badge row, name, description/bet, CTA.
 * Task 3.1 — Mini Jackpot Games spec
 * Requirements: 2.1–2.10, 13.7
 */

import { motion } from 'framer-motion';
import type { MiniGameId, MiniGameConfig } from '../../types/miniGames';

// ── Per-game metadata ────────────────────────────────────────────────────────
const GAME_METADATA: Record<
  MiniGameId,
  { title: string; description: string; icon: string }
> = {
  'lucky-wheel':        { title: 'Neon Lucky Wheel',     description: 'Spin the neon wheel for instant multipliers.',   icon: '🎡' },
  'scratch-cards':      { title: 'Neon Scratch Cards',   description: 'Scratch to reveal hidden prizes instantly.',     icon: '🎴' },
  'treasure-chest':     { title: 'Cyber Treasure Chest', description: 'Pick a chest and discover your instant prize.',  icon: '💎' },
  'mini-slot':          { title: 'Mini Slot Jackpot',    description: 'Classic 3-reel slot with jackpot combos.',       icon: '🎰' },
  'mystery-multiplier': { title: 'Mystery Multiplier',   description: 'Reveal your mystery multiplier and win big.',    icon: '✨' },
  'crystal-match':      { title: 'Crystal Match',        description: 'Match crystal patterns for prize combos.',       icon: '🔮' },
};

// ── Category → accent color (mirrors JackpotCard TYPE_THEME palette) ────────
type CategoryType = 'INSTANT WIN' | 'MINI SLOTS' | 'MULTIPLIER';

const CATEGORY_MAP: Record<MiniGameId, CategoryType> = {
  'lucky-wheel':        'INSTANT WIN',
  'scratch-cards':      'INSTANT WIN',
  'treasure-chest':     'INSTANT WIN',
  'mini-slot':          'MINI SLOTS',
  'mystery-multiplier': 'MULTIPLIER',
  'crystal-match':      'INSTANT WIN',
};

const CATEGORY_THEME: Record<CategoryType, {
  accentColor: string;
  glowColor:   string;
  borderColor: string;
}> = {
  'INSTANT WIN': {
    accentColor: '#22d3ee',
    glowColor:   'rgba(34,211,238,0.35)',
    borderColor: 'rgba(34,211,238,0.28)',
  },
  'MINI SLOTS': {
    accentColor: '#a855f7',
    glowColor:   'rgba(168,85,247,0.38)',
    borderColor: 'rgba(168,85,247,0.32)',
  },
  'MULTIPLIER': {
    accentColor: '#FFD700',
    glowColor:   'rgba(255,215,0,0.38)',
    borderColor: 'rgba(255,215,0,0.28)',
  },
};

// ── Props ────────────────────────────────────────────────────────────────────
export interface MiniGameCardProps {
  gameId:      MiniGameId;
  config:      MiniGameConfig | null;
  configError: boolean;
  onPlay:      (gameId: MiniGameId) => void;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function MiniGameCard({
  gameId,
  config,
  configError,
  onPlay,
}: MiniGameCardProps) {
  const { title, description, icon } = GAME_METADATA[gameId];
  const category = CATEGORY_MAP[gameId];
  const theme    = CATEGORY_THEME[category];

  // Always clickable — even on config error or missing config.
  // The modal will handle showing appropriate content.
  const isPlayable    = true;
  const showBetLimits = !configError && config !== null;

  return (
    <motion.div
      whileHover={isPlayable ? { boxShadow: `0 0 28px ${theme.glowColor}` } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="relative flex flex-col rounded-2xl overflow-hidden w-full h-full min-w-0"
      style={{
        background:  'linear-gradient(160deg, #0e0020 0%, #04000f 100%)',
        border:      `1px solid ${theme.borderColor}`,
        boxShadow:   '0 8px 28px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
      role="article"
      aria-label={`${title} mini game card`}
    >
      {/* ── Top accent stripe (matches JackpotCard) ─────────────────────── */}
      <div
        style={{
          height:     '3px',
          background: `linear-gradient(90deg, transparent, ${theme.accentColor}, transparent)`,
          opacity:    0.85,
          flexShrink: 0,
        }}
      />

      {/* ── Card body ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 px-2.5 pt-2 pb-2.5 flex-1">

        {/* Row 1 — icon + category badge */}
        <div className="flex items-center gap-1.5">
          <span
            className="flex items-center justify-center w-6 h-6 rounded-md text-sm shrink-0"
            style={{
              background:  `${theme.glowColor.replace('0.35', '0.12').replace('0.38', '0.12')}`,
              border:      `1px solid ${theme.borderColor}`,
            }}
            aria-hidden="true"
          >
            {icon}
          </span>
          <span
            className="font-orbitron font-black uppercase tracking-wider text-[9px] sm:text-[8px] truncate"
            style={{ color: theme.accentColor }}
          >
            {category}
          </span>
        </div>

        {/* Row 2 — game title */}
        <h3
          className="font-orbitron font-bold text-white leading-tight text-[11px] sm:text-[10px]"
          style={{ letterSpacing: '0.03em' }}
        >
          {title}
        </h3>

        {/* Row 3 — description */}
        <p
          className="leading-snug flex-1 text-[10px] sm:text-[9px]"
          style={{
            color: 'rgba(156,163,175,0.75)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {description}
        </p>

        {/* Row 4 — bet limits */}
        {showBetLimits ? (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[9px] sm:text-[8px]" style={{ color: 'rgba(156,163,175,0.5)' }}>Bet</span>
            <span
              className="font-orbitron font-bold text-[9px] sm:text-[8px]"
              style={{ color: '#FFD700' }}
            >
              KES {config!.min_bet.toLocaleString()}–{config!.max_bet.toLocaleString()}
            </span>
          </div>
        ) : null}

        {/* Row 5 — CTA button */}
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onPlay(gameId)}
          className="mt-auto w-full py-2.5 rounded-lg font-orbitron font-bold text-[11px] sm:text-[10px] tracking-widest text-black transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
          style={{
            background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
            boxShadow:  '0 0 14px rgba(255,215,0,0.45)',
          }}
          aria-label={`Play ${title}`}
        >
          PLAY NOW
        </motion.button>
      </div>
    </motion.div>
  );
}
