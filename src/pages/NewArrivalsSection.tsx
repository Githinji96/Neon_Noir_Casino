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

      {/* Mobile: 2-col grid | Desktop: horizontal scroll */}
      {loading ? (
        <div className="grid grid-cols-2 sm:hidden gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="relative rounded-xl overflow-hidden bg-white/5 aspect-video">
              <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                animate={{ x: ['-100%', '100%'] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Mobile 2-column grid */}
          <div className="grid grid-cols-2 sm:hidden gap-3">
            {NEW_ARRIVAL_GAMES.map((game) => (
              <GameCard key={game.id} id={game.id} title={game.title} thumbnail={game.thumbnail}
                badge={game.badge} onClick={() => onGameClick(game.id, game.title)} />
            ))}
          </div>

          {/* Tablet/Desktop horizontal scroll */}
          <div className="hidden sm:flex gap-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {NEW_ARRIVAL_GAMES.map((game) => (
              <div key={game.id} className="shrink-0" style={{ width: 'min(200px, 70vw)' }}>
                <GameCard id={game.id} title={game.title} thumbnail={game.thumbnail}
                  badge={game.badge} onClick={() => onGameClick(game.id, game.title)} />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
