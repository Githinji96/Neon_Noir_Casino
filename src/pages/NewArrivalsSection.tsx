import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import GameCard from '../components/GameCard';
import { NEW_ARRIVAL_GAMES } from '../config/mockData';

interface NewArrivalsSectionProps {
  onGameClick: (id: string, title: string) => void;
}

export default function NewArrivalsSection({ onGameClick }: NewArrivalsSectionProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="px-6 md:px-10 py-4">
      <div className="mb-3 flex items-center gap-3">
        <div>
          <h2 className="font-orbitron text-lg font-bold text-white tracking-widest uppercase">
            New Arrivals
          </h2>
          <div className="mt-1 h-0.5 w-10 bg-cyan-400" style={{ boxShadow: '0 0 6px #00FFFF' }} />
        </div>
        <span className="text-white/20 text-xs font-orbitron">Pure slots · No jackpot</span>
      </div>

      {/* Compact horizontal row */}
      <div className="flex gap-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {loading
          ? NEW_ARRIVAL_GAMES.map((_, i) => (
              <div key={i} className="relative rounded-xl overflow-hidden shrink-0 bg-white/5" style={{ width: 160, height: 100 }}>
                <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  animate={{ x: ['-100%', '100%'] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} />
              </div>
            ))
          : NEW_ARRIVAL_GAMES.map((game) => (
              <div key={game.id} className="shrink-0" style={{ width: 200 }}>
                <GameCard
                  id={game.id}
                  title={game.title}
                  thumbnail={game.thumbnail}
                  badge={game.badge}
                  onClick={() => onGameClick(game.id, game.title)}
                />
              </div>
            ))}
      </div>
    </section>
  );
}
