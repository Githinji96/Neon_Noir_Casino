import { useState } from 'react';
import { motion } from 'framer-motion';
import JackpotDetailsModal from '../components/JackpotDetailsModal';
import { useJackpotStore } from '../store/jackpotStore';
import { useAuthStore } from '../store/authStore';

interface HeroSectionProps {
  onPlayNow: () => void;
}

const formatJackpot = (value: number): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function HeroSection({ onPlayNow }: HeroSectionProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { user: _user } = useAuthStore();

  // Use live jackpot amount from store (grows in real time)
  const jackpots = useJackpotStore((s) => s.jackpots);
  const mega = jackpots.find((j) => j.id === 'mega-moolah-noir');
  const jackpot = mega?.currentAmount ?? 3_429_102.55;

  return (
    <section
      className="relative w-full flex items-center justify-center overflow-hidden py-12 md:py-16"
      style={{ minHeight: 'clamp(320px, 45vh, 600px)' }}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-950/90 via-black/80 to-black" />

      {/* Cyberpunk grid overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,215,0,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,215,0,0.15) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <h1
            className="font-orbitron font-bold text-3xl sm:text-4xl md:text-5xl text-white uppercase tracking-wider mb-3"
            style={{ textShadow: '0 0 20px #FFD700, 0 0 40px #FFD70080, 0 0 80px #FFD70040' }}
          >
            UNLEASH THE NEON WIN
          </h1>
          <p className="text-gray-300 text-base md:text-lg mb-6 tracking-wide">
            The ultimate cyberpunk casino experience
          </p>
        </motion.div>

        {/* Jackpot counter */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
          className="mb-6"
        >
          <p
            className="text-xs font-orbitron tracking-[0.3em] text-gray-400 uppercase mb-2"
            style={{ fontVariant: 'small-caps' }}
          >
            MEGA JACKPOT
          </p>
          <span
            className="font-orbitron font-bold text-3xl md:text-4xl text-neon-yellow"
            style={{ textShadow: '0 0 16px #FFD700, 0 0 32px #FFD70080' }}
          >
            KES {formatJackpot(jackpot)}
          </span>
        </motion.div>

        {/* CTA Buttons — full width on mobile, side by side on sm+ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: 'easeOut' }}
          className="flex flex-col items-center gap-3 w-full max-w-xs mx-auto sm:max-w-none sm:flex-row sm:justify-center"
        >
          <button
            onClick={onPlayNow}
            className="btn-neon w-full sm:w-auto px-8 py-3 rounded-full font-orbitron font-bold text-sm tracking-widest uppercase"
          >
            PLAY NOW
          </button>
          <button
            onClick={() => setDetailsOpen(true)}
            className="w-full sm:w-auto px-8 py-3 rounded-full font-orbitron font-bold text-sm tracking-widest uppercase border border-white text-white hover:bg-white/10 transition-colors duration-250"
          >
            DETAILS
          </button>
        </motion.div>

      </div>

      <JackpotDetailsModal
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        onPlayNow={onPlayNow}
      />
    </section>
  );
}
