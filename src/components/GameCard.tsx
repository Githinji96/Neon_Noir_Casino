import { useState } from 'react';
import { motion } from 'framer-motion';

interface GameCardProps {
  id: string;
  title: string;
  thumbnail: string;
  badge: 'HOT' | 'NEW';
  onClick: () => void;
}

export default function GameCard({ title, thumbnail, badge, onClick }: GameCardProps) {
  const [hovered, setHovered] = useState(false);

  const badgeStyles =
    badge === 'HOT'
      ? 'bg-orange-600 text-white shadow-[0_0_8px_#f97316]'
      : 'bg-cyan-500 text-black shadow-[0_0_8px_#00FFFF]';

  return (
    <motion.div
      className="relative rounded-xl overflow-hidden cursor-pointer aspect-video bg-casino-dark border border-glass-border"
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.25 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={onClick}
      style={{
        boxShadow: hovered
          ? '0 0 10px #FFD700, 0 0 20px #FFD70080, 0 0 40px #FFD70040'
          : '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        transition: 'box-shadow 0.25s ease',
      }}
    >
      {/* Thumbnail */}
      <img
        src={thumbnail}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Badge */}
      <span
        className={`absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-bold font-orbitron tracking-wider ${badgeStyles}`}
      >
        {badge}
      </span>

      {/* Title */}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-2">
        <p className="text-white font-orbitron text-sm font-semibold truncate drop-shadow-lg">
          {title}
        </p>
      </div>
    </motion.div>
  );
}
