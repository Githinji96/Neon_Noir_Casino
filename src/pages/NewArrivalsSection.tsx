import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import GameCard from '../components/GameCard';
import { GAME_LISTINGS } from '../config/mockData';

interface NewArrivalsSectionProps {
  onGameClick: (id: string, title: string) => void;
}

function ShimmerCard() {
  return (
    <div className="relative rounded-xl overflow-hidden aspect-video bg-white/5">
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

export default function NewArrivalsSection({ onGameClick }: NewArrivalsSectionProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="px-6 md:px-10 py-8">
      {/* Title */}
      <div className="mb-6">
        <h2 className="font-orbitron text-2xl font-bold text-white tracking-widest uppercase">
          New Arrivals
        </h2>
        <div className="mt-2 h-0.5 w-16 bg-yellow-400 shadow-[0_0_8px_#FFD700]" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {loading
          ? GAME_LISTINGS.map((_, i) => <ShimmerCard key={i} />)
          : GAME_LISTINGS.map((game) => (
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
    </section>
  );
}
