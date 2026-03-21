import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface HeroSectionProps {
  onPlayNow: () => void;
}

const INITIAL_JACKPOT = 3_429_102.55;

const formatJackpot = (value: number): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function HeroSection({ onPlayNow }: HeroSectionProps) {
  const [jackpot, setJackpot] = useState(INITIAL_JACKPOT);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const increment = Math.random() * (2.0 - 0.01) + 0.01;
      setJackpot((prev) => Math.round((prev + increment) * 100) / 100);
    }, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <section
      className="relative w-full flex items-center justify-center overflow-hidden"
      style={{ minHeight: '70vh' }}
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
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          {/* Headline */}
          <h1
            className="font-orbitron font-bold text-5xl md:text-7xl text-white uppercase tracking-wider mb-4"
            style={{ textShadow: '0 0 20px #FFD700, 0 0 40px #FFD70080, 0 0 80px #FFD70040' }}
          >
            UNLEASH THE NEON WIN
          </h1>

          {/* Subtext */}
          <p className="text-gray-300 text-lg md:text-xl mb-10 tracking-wide">
            The ultimate cyberpunk casino experience
          </p>
        </motion.div>

        {/* Jackpot counter */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
          className="mb-10"
        >
          <p
            className="text-xs font-orbitron tracking-[0.3em] text-gray-400 uppercase mb-2"
            style={{ fontVariant: 'small-caps' }}
          >
            MEGA JACKPOT
          </p>
          <span
            className="font-orbitron font-bold text-4xl md:text-5xl text-neon-yellow"
            style={{ textShadow: '0 0 16px #FFD700, 0 0 32px #FFD70080' }}
          >
            ${formatJackpot(jackpot)}
          </span>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: 'easeOut' }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            onClick={onPlayNow}
            className="btn-neon px-10 py-4 rounded-full font-orbitron font-bold text-base tracking-widest uppercase"
          >
            PLAY NOW
          </button>
          <button
            className="px-10 py-4 rounded-full font-orbitron font-bold text-base tracking-widest uppercase border border-white text-white hover:bg-white/10 transition-colors duration-250"
          >
            DETAILS
          </button>
        </motion.div>
      </div>
    </section>
  );
}
