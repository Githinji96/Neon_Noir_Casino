import { motion } from 'framer-motion';

interface JackpotCardProps {
  name: string;
  gameTitle: string;
  amount: number;
  type?: string;
  tags: string[];
  state?: 'BUILDING' | 'ACTIVE' | 'WON';
  progressPct?: number;
  minimumThreshold?: number;
  contributionRate?: number;
  onSpinNow: () => void;
}

// ── Per-type visual identity ───────────────────────────────────────────────
const TYPE_THEME: Record<string, {
  icon: string;
  accentColor: string;
  glowColor: string;
  badgeLabel: string;
  borderColor: string;
}> = {
  mega: {
    icon: '👑',
    accentColor: '#FFD700',
    glowColor: 'rgba(255,215,0,0.45)',
    badgeLabel: 'MEGA',
    borderColor: 'rgba(255,215,0,0.35)',
  },
  daily: {
    icon: '💎',
    accentColor: '#c084fc',
    glowColor: 'rgba(192,132,252,0.4)',
    badgeLabel: 'GRAND',
    borderColor: 'rgba(192,132,252,0.35)',
  },
  hourly: {
    icon: '⚡',
    accentColor: '#22d3ee',
    glowColor: 'rgba(34,211,238,0.4)',
    badgeLabel: 'RAPID',
    borderColor: 'rgba(34,211,238,0.3)',
  },
  weekly: {
    icon: '🔥',
    accentColor: '#f97316',
    glowColor: 'rgba(249,115,22,0.4)',
    badgeLabel: 'EPIC',
    borderColor: 'rgba(249,115,22,0.3)',
  },
};

const DEFAULT_THEME = {
  icon: '🎰',
  accentColor: '#FFD700',
  glowColor: 'rgba(255,215,0,0.3)',
  badgeLabel: 'JACKPOT',
  borderColor: 'rgba(255,255,255,0.12)',
};

const TAG_STYLES: Record<string, string> = {
  Daily:       'bg-purple-600/25 text-purple-300 border border-purple-500/40',
  Hourly:      'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40',
  Weekly:      'bg-orange-500/20 text-orange-300 border border-orange-500/35',
  Progressive: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/35',
};
const DEFAULT_TAG = 'bg-white/10 text-white/60 border border-white/20';

export default function JackpotCard({
  name,
  amount,
  type = 'daily',
  tags,
  state = 'ACTIVE',
  onSpinNow,
}: JackpotCardProps) {
  const theme = TYPE_THEME[type] ?? DEFAULT_THEME;
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // WON state — show a brief "resetting" indicator instead of spin button
  const isWon = state === 'WON';

  return (
    <motion.div
      whileHover={isWon ? {} : { boxShadow: `0 0 36px ${theme.glowColor}` }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="relative flex flex-col rounded-2xl overflow-hidden w-full min-w-0"
      style={{
        background: 'linear-gradient(160deg, #0e0020 0%, #04000f 100%)',
        border: `1px solid ${theme.borderColor}`,
        boxShadow: `0 8px 28px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)`,
        gap: 0,
      }}
      aria-label={`${name} jackpot card`}
    >
      {/* ── Top accent stripe ─────────────────────────────────────────────── */}
      <div
        style={{
          height: '3px',
          background: `linear-gradient(90deg, transparent, ${theme.accentColor}, transparent)`,
          opacity: 0.85,
        }}
      />

      {/* ── Card body ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 px-2.5 pt-2 pb-2.5 flex-1">

        {/* Row 1 — icon badge + type label */}
        <div className="flex items-center gap-1.5">
          <span
            className="flex items-center justify-center w-6 h-6 rounded-md text-sm shrink-0"
            style={{
              background: `${theme.glowColor.replace('0.4', '0.15').replace('0.45', '0.15')}`,
              border: `1px solid ${theme.borderColor}`,
            }}
            aria-hidden="true"
          >
            {theme.icon}
          </span>
          <span
            className="font-orbitron font-black uppercase tracking-wider text-[9px] sm:text-[8px]"
            style={{ color: theme.accentColor }}
          >
            {theme.badgeLabel}
          </span>
        </div>

        {/* Row 2 — jackpot name */}
        <h3
          className="font-orbitron font-bold text-white leading-tight text-[11px] sm:text-[10px] md:text-xs"
          style={{ letterSpacing: '0.03em' }}
        >
          {name}
        </h3>

        {/* Row 3 — live amount */}
        <motion.p
          className="font-orbitron font-black leading-tight w-full text-[11px] sm:text-[10px] md:text-sm"
          style={{
            color: '#FFD700',
            textShadow: '0 0 12px rgba(255,215,0,0.7)',
            wordBreak: 'break-all',
            overflowWrap: 'anywhere',
            minWidth: 0,
          }}
          animate={{
            textShadow: [
              '0 0 8px rgba(255,215,0,0.5)',
              '0 0 20px rgba(255,215,0,0.95)',
              '0 0 8px rgba(255,215,0,0.5)',
            ],
          }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          aria-label={`Current jackpot amount: KES ${formatted}`}
        >
          KES {formatted}
        </motion.p>

        {/* Row 4 — tags */}
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className={`text-[8px] sm:text-[7px] font-semibold px-1.5 py-px rounded-full ${TAG_STYLES[tag] ?? DEFAULT_TAG}`}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Row 5 — CTA / WON state */}
        {isWon ? (
          <div
            className="mt-auto w-full py-2 rounded-lg font-orbitron font-bold text-[9px] tracking-widest text-center uppercase"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.35)',
            }}
          >
            Resetting…
          </div>
        ) : (
          <motion.button
            onClick={onSpinNow}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="mt-auto w-full py-2.5 rounded-lg font-orbitron font-bold text-[11px] sm:text-[10px] tracking-widest text-black transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
            style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
              boxShadow: '0 0 14px rgba(255,215,0,0.45)',
            }}
          >
            SPIN NOW
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
