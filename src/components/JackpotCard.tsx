import { motion } from 'framer-motion';

interface JackpotCardProps {
  name: string;
  amount: number;
  tags: string[];
  onSpinNow: () => void;
}

const TAG_STYLES: Record<string, string> = {
  Daily:       'bg-purple-600/30 text-purple-300 border border-purple-500/50',
  Hourly:      'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50',
  Weekly:      'bg-purple-600/20 text-purple-300 border border-purple-500/40',
  Progressive: 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50',
};

const DEFAULT_TAG = 'bg-white/10 text-white/60 border border-white/20';

export default function JackpotCard({ name, amount, tags, onSpinNow }: JackpotCardProps) {
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <motion.div
      whileHover={{ scale: 1.03, boxShadow: '0 0 32px rgba(255,215,0,0.25)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="flex flex-col gap-4 p-5 rounded-2xl shrink-0"
      style={{
        minWidth: 'min(200px, 60vw)',
        maxWidth: '220px',
        scrollSnapAlign: 'start',
        background: 'linear-gradient(160deg, #0d0020 0%, #050010 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {/* Name */}
      <h3 className="font-orbitron font-bold text-white text-sm tracking-wide leading-tight">
        {name}
      </h3>

      {/* Amount — large glowing yellow */}
      <motion.p
        className="font-orbitron font-bold text-xl leading-none"
        style={{
          color: '#FFD700',
          textShadow: '0 0 12px rgba(255,215,0,0.8), 0 0 24px rgba(255,215,0,0.4)',
        }}
        animate={{ textShadow: [
          '0 0 10px rgba(255,215,0,0.6), 0 0 20px rgba(255,215,0,0.3)',
          '0 0 18px rgba(255,215,0,1),   0 0 36px rgba(255,215,0,0.6)',
          '0 0 10px rgba(255,215,0,0.6), 0 0 20px rgba(255,215,0,0.3)',
        ]}}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        ${formatted}
      </motion.p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TAG_STYLES[tag] ?? DEFAULT_TAG}`}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* SPIN NOW */}
      <button
        onClick={onSpinNow}
        className="mt-auto w-full py-2.5 rounded-xl font-orbitron font-bold text-xs tracking-widest text-black transition-all duration-150 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #FFD700, #FFA500)',
          boxShadow: '0 0 14px rgba(255,215,0,0.5), 0 0 28px rgba(255,215,0,0.2)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            '0 0 20px rgba(255,215,0,0.8), 0 0 40px rgba(255,215,0,0.4)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            '0 0 14px rgba(255,215,0,0.5), 0 0 28px rgba(255,215,0,0.2)';
        }}
      >
        SPIN NOW
      </button>
    </motion.div>
  );
}
