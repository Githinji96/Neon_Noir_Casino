import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface GameCardProps {
  id: string;
  title: string;
  thumbnail: string;
  /** Slideshow pool — card cycles through these every 3 s with a crossfade */
  thumbnails?: string[];
  badge: 'HOT' | 'NEW';
  onClick: () => void;
}

const SLIDE_INTERVAL_MS = 3000;
const FADE_MS           = 600;

export default function GameCard({ title, thumbnail, thumbnails, badge, onClick }: GameCardProps) {
  const pool = thumbnails && thumbnails.length > 1 ? thumbnails : [thumbnail];

  // Index of the currently VISIBLE slide
  const [current, setCurrent]   = useState(0);
  // Index of the slide FADING IN on top
  const [next, setNext]         = useState<number | null>(null);
  const [nextOpacity, setNextOpacity] = useState(0);

  const [hovered, setHovered]   = useState(false);
  const intervalRef             = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeTimerRef            = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-load all images so the crossfade is smooth
  useEffect(() => {
    pool.forEach((src) => { const img = new Image(); img.src = src; });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Kick off the slideshow
  useEffect(() => {
    if (pool.length <= 1) return;

    intervalRef.current = setInterval(() => {
      setCurrent((prev) => {
        const nextIdx = (prev + 1) % pool.length;
        // Start the fade-in of the next slide
        setNext(nextIdx);
        setNextOpacity(0);
        // Trigger opacity transition on next tick
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setNextOpacity(1));
        });
        // After fade completes, promote next → current and clear overlay
        fadeTimerRef.current = setTimeout(() => {
          setCurrent(nextIdx);
          setNext(null);
          setNextOpacity(0);
        }, FADE_MS);
        return prev; // current stays until fade completes
      });
    }, SLIDE_INTERVAL_MS);

    return () => {
      if (intervalRef.current)  clearInterval(intervalRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [pool.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
        height: 110,
        background: 'linear-gradient(135deg, #0a0a1e 0%, #1a0a2e 40%, #0a1a1e 100%)',
        boxShadow: hovered
          ? '0 0 12px #FFD700, 0 0 24px #FFD70060'
          : '0 4px 16px rgba(0,0,0,0.5)',
        transition: 'box-shadow 0.2s ease',
      }}
    >
      {/* Base slide — currently visible */}
      <img
        key={`base-${current}`}
        src={pool[current]}
        alt={title}
        loading="eager"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 1 }}
        onError={() => {/* keep gradient fallback */}}
      />

      {/* Overlay slide — fades in over the base */}
      {next !== null && (
        <img
          key={`next-${next}`}
          src={pool[next]}
          alt=""
          aria-hidden="true"
          loading="eager"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: nextOpacity,
            transition: `opacity ${FADE_MS}ms ease-in-out`,
          }}
        />
      )}

      {/* Dark gradient overlay — legibility for text */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />

      {/* Badge */}
      <span
        className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold font-orbitron tracking-wider z-10 ${badgeStyles}`}
      >
        {badge}
      </span>

      {/* Title */}
      <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2 z-10">
        <p className="text-white font-orbitron text-xs font-semibold truncate drop-shadow-lg leading-tight">
          {title}
        </p>
      </div>

      {/* Dot indicators — only shown on hover when pool > 1 */}
      {pool.length > 1 && hovered && (
        <div className="absolute bottom-6 right-2 flex gap-1 z-10">
          {pool.map((_, i) => (
            <span
              key={i}
              className="rounded-full transition-all duration-200"
              style={{
                width:  i === current ? 10 : 5,
                height: 5,
                background: i === current ? '#FFD700' : 'rgba(255,255,255,0.4)',
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
