import { motion } from 'framer-motion';

interface JackpotCardProps {
  name: string;
  amount: number;
  tags: string[];
  onSpinNow: () => void;
}

const TAG_STYLES: Record<string, string> = {
  Daily: 'bg-electric-purple/30 text-electric-purple border border-electric-purple/40',
  Hourly: 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40',
  Progressive: 'bg-neon-pink/20 text-neon-pink border border-neon-pink/40',
  Weekly: 'bg-electric-purple/20 text-neon-cyan border border-neon-cyan/30',
};

const DEFAULT_TAG_STYLE = 'bg-white/10 text-white/70 border border-white/20';

export default function JackpotCard({ name, amount, tags, onSpinNow }: JackpotCardProps) {
  const formattedAmount = `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <div
      className="flex flex-col gap-4 p-5 rounded-xl bg-black/40 backdrop-blur border border-white/10 shrink-0"
      style={{
        minWidth: '260px',
        maxWidth: '280px',
        scrollSnapAlign: 'start',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
      }}
    >
      {/* Name */}
      <h3 className="font-orbitron font-bold text-white text-base tracking-wide truncate">
        {name}
      </h3>

      {/* Amount */}
      <motion.p
        className="font-orbitron font-bold text-2xl text-neon-yellow"
        style={{ textShadow: '0 0 10px #FFD700, 0 0 20px #FFD70080' }}
        animate={{ opacity: [1, 0.7, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {formattedAmount}
      </motion.p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TAG_STYLES[tag] ?? DEFAULT_TAG_STYLE}`}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Spin Now button */}
      <button
        onClick={onSpinNow}
        className="mt-auto w-full py-2 rounded-lg font-orbitron font-bold text-sm tracking-widest text-casino-black bg-neon-yellow hover:brightness-110 active:scale-95 transition-all duration-150"
        style={{ boxShadow: '0 0 10px #FFD700, 0 0 20px #FFD70080' }}
      >
        SPIN NOW
      </button>
    </div>
  );
}
