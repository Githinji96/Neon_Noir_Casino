import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import GameCard from '../components/GameCard';
import { NEW_ARRIVAL_GAMES } from '../config/mockData';

interface NewArrivalsSectionProps {
  onGameClick: (id: string, title: string) => void;
  onSeeAll?: () => void;
}

export default function NewArrivalsSection({ onGameClick, onSeeAll }: NewArrivalsSectionProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="px-4 sm:px-6 md:px-10 py-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        <div>
          <h2 className="font-orbitron text-base sm:text-lg font-bold text-white tracking-widest uppercase">
            New Arrivals
          </h2>
          <div className="mt-1 h-0.5 w-10 bg-cyan-400" style={{ boxShadow: '0 0 6px #00FFFF' }} />
        </div>
        <span className="text-white/20 text-xs font-orbitron">Pure odds · No jackpot</span>
        <button
          onClick={onSeeAll}
          className="ml-auto text-xs font-orbitron text-white/40 hover:text-white border border-white/20 rounded-full px-3 py-1 transition-colors"
        >
          SEE ALL ›
        </button>
      </div>

      {/*
       * Responsive grid:
       *  mobile  (<480px) → 2 cols
       *  ≥480px           → 3 cols
       *  ≥768px           → 4 cols
       *  ≥1024px          → 6 cols  ← all 6 fill the row with no gap on right
       */}
      <style>{`
        .na-grid {
          display: grid;
          gap: 10px;
          width: 100%;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        @media (min-width: 480px)  { .na-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (min-width: 768px)  { .na-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
        @media (min-width: 1024px) { .na-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
      `}</style>

      {loading ? (
        <div className="na-grid">
          {NEW_ARRIVAL_GAMES.map((_, i) => (
            <div
              key={i}
              className="relative rounded-xl overflow-hidden bg-white/5"
              style={{ height: 110 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="na-grid">
          {NEW_ARRIVAL_GAMES.map((game) => (
            <GameCard
              key={game.id}
              id={game.id}
              title={game.title}
              thumbnail={game.thumbnail}
              badge={game.badge}
              onClick={() => onGameClick(game.id, game.title)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
