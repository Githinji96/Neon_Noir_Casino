import { useState } from 'react';
import { motion } from 'framer-motion';
import { POPULAR_GAMES } from '../config/mockData';

interface PopularChoicesSectionProps {
  onGameClick: (id: string, title: string) => void;
  sectionRef?: React.RefObject<HTMLElement>;
}

const volatilityColor: Record<string, string> = {
  Low: 'text-green-400 border-green-400/40',
  Medium: 'text-yellow-400 border-yellow-400/40',
  High: 'text-red-400 border-red-400/40',
};

export default function PopularChoicesSection({ onGameClick, sectionRef }: PopularChoicesSectionProps) {
  const [highlighted, setHighlighted] = useState(false);

  // Called externally via ref to trigger the brief heading glow
  const highlight = () => {
    setHighlighted(true);
    setTimeout(() => setHighlighted(false), 1500);
  };

  // Expose highlight so CasinoLobby can call it after scrolling
  if (sectionRef && (sectionRef as React.MutableRefObject<{ highlight?: () => void } | null>).current !== null) {
    (sectionRef as unknown as React.MutableRefObject<{ highlight: () => void }>).current = { highlight };
  }

  return (
    <section
      id="popular-choices"
      ref={sectionRef as React.RefObject<HTMLElement>}
      className="px-6 md:px-10 py-8"
    >
      {/* Title */}
      <div className="mb-6">
        <h2
          className="font-orbitron text-2xl font-bold tracking-widest uppercase transition-colors duration-300"
          style={{ color: highlighted ? '#FFD700' : '#fff', textShadow: highlighted ? '0 0 20px rgba(255,215,0,0.6)' : 'none' }}
        >
          Popular Choices
        </h2>
        <div
          className="mt-2 h-0.5 w-16 transition-all duration-300"
          style={{
            background: '#FFD700',
            boxShadow: highlighted ? '0 0 16px #FFD700' : '0 0 8px #FFD700',
          }}
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {POPULAR_GAMES.map((game) => (
          <motion.button
            key={game.id}
            onClick={() => onGameClick(game.id, game.title)}
            className="bg-black/40 backdrop-blur border border-white/10 rounded-xl p-4 flex flex-col items-center gap-2 text-left w-full"
            whileHover={{
              scale: 1.05,
              borderColor: 'rgba(250, 204, 21, 0.6)',
              boxShadow: '0 0 16px rgba(250, 204, 21, 0.3)',
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            {/* Icon */}
            <span className="text-4xl">{game.icon}</span>

            {/* Title */}
            <span className="font-orbitron text-xs text-white font-semibold tracking-wide truncate w-full text-center">
              {game.title}
            </span>

            {/* RTP badge */}
            <span className="text-xs text-cyan-400 border border-cyan-400/40 rounded px-1.5 py-0.5">
              RTP: {game.rtp}%
            </span>

            {/* Volatility badge */}
            <span
              className={`text-xs border rounded px-1.5 py-0.5 ${volatilityColor[game.volatility]}`}
            >
              {game.volatility}
            </span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
