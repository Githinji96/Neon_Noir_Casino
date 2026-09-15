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
  const [imgError, setImgError] = useState(false);

  const badgeStyles =
    badge === 'HOT'
      ? 'bg-orange-600 text-white shadow-[0_0_8px_#f97316]'
      : 'bg-cyan-500 text-black shadow-[0_0_8px_#00FFFF]';

  return (
    <motion.div
      className="relative rounded-xl overflow-hidden cursor-pointer border border-white/10"
      whileHover={{ scale: 1.04 }}
      transition={{ duration: 0.2 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={onClick}
      style={{
        /* Fixed height card — image fills it entirely.
           On desktop 6-col grid a ~220px wide column → 124px tall (16:9).
           We fix at 110px so cards are compact like the reference image. */
        height: 110,
        background: '#0d0d1a',
        boxShadow: hovered
          ? '0 0 12px #FFD700, 0 0 24px #FFD70060'
          : '0 4px 16px rgba(0,0,0,0.5)',
        transition: 'box-shadow 0.2s ease',
      }}
    >
      {/* Thumbnail — absolutely fills the card */}
      {!imgError ? (
        <img
          src={thumbnail}
          alt={title}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        /* Themed fallback gradient when image fails — keeps Neon Noir palette */
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #0a0a1e 0%, #1a0a2e 40%, #0a1a1e 100%)',
          }}
        />
      )}

      {/* Dark gradient overlay — stronger at bottom for title legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />

      {/* Badge — top left */}
      <span
        className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold font-orbitron tracking-wider z-10 ${badgeStyles}`}
      >
        {badge}
      </span>

      {/* Title — bottom left */}
      <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2 z-10">
        <p className="text-white font-orbitron text-xs font-semibold truncate drop-shadow-lg leading-tight">
          {title}
        </p>
      </div>
    </motion.div>
  );
}
