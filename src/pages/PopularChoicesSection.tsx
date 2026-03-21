import { motion } from 'framer-motion';
import { POPULAR_GAMES } from '../config/mockData';

interface PopularChoicesSectionProps {
  onGameClick: (id: string, title: string) => void;
}

const volatilityColor: Record<string, string> = {
  Low: 'text-green-400 border-green-400/40',
  Medium: 'text-yellow-400 border-yellow-400/40',
  High: 'text-red-400 border-red-400/40',
};

export default function PopularChoicesSection({ onGameClick }: PopularChoicesSectionProps) {
  return (
    <section className="px-4 py-8">
      {/* Title */}
      <div className="mb-6">
        <h2 className="font-orbitron text-2xl font-bold text-white tracking-widest uppercase">
          Popular Choices
        </h2>
        <div className="mt-2 h-0.5 w-16 bg-yellow-400 shadow-[0_0_8px_#FFD700]" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
