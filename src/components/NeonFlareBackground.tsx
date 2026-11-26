/**
 * NeonFlareBackground — decorative background layer for the Jackpot page.
 *
 * Renders pure-CSS animated neon flare dots and soft glows using deterministic
 * pseudo-random placement so no JS runs per frame. All animations are CSS
 * keyframes, respecting prefers-reduced-motion. pointer-events: none throughout.
 */

// ---------------------------------------------------------------------------
// Particle definition
// ---------------------------------------------------------------------------
interface Particle {
  x: number;      // % from left
  y: number;      // % from top
  size: number;   // px
  color: string;  // neon color
  glow: string;   // box-shadow glow color
  opacity: number;
  duration: number;  // animation seconds
  delay: number;     // animation delay seconds
  driftX: number;    // drift distance px
  driftY: number;    // drift distance px
  type: 'dot' | 'flare';
}

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — same values every render, no state needed
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Build particle list
// ---------------------------------------------------------------------------
const NEON_COLORS = [
  { color: '#FFD700', glow: 'rgba(255,215,0,0.8)'   },   // gold
  { color: '#a855f7', glow: 'rgba(168,85,247,0.8)'  },   // purple
  { color: '#06b6d4', glow: 'rgba(6,182,212,0.8)'   },   // cyan
  { color: '#ec4899', glow: 'rgba(236,72,153,0.7)'  },   // magenta
  { color: '#22d3ee', glow: 'rgba(34,211,238,0.75)' },   // sky cyan
  { color: '#f97316', glow: 'rgba(249,115,22,0.65)' },   // orange (rare)
];

function buildParticles(count: number): Particle[] {
  const rand = mulberry32(0xDEADBEEF);
  return Array.from({ length: count }, (_, i): Particle => {
    const r = rand;
    const c = NEON_COLORS[Math.floor(r() * NEON_COLORS.length)];
    const isFlare = i % 12 === 0;   // every 12th particle is a soft flare
    return {
      x:        Math.floor(r() * 96) + 2,    // 2–98%
      y:        Math.floor(r() * 96) + 2,
      size:     isFlare
        ? Math.floor(r() * 60) + 40           // flare: 40–100px
        : Math.floor(r() * 3)  + 1,           // dot: 1–3px
      color:    c.color,
      glow:     c.glow,
      opacity:  isFlare
        ? parseFloat((r() * 0.06 + 0.03).toFixed(3))   // flare: 0.03–0.09
        : parseFloat((r() * 0.55 + 0.15).toFixed(3)),  // dot: 0.15–0.70
      duration: parseFloat((r() * 18 + 8).toFixed(1)),   // 8–26s
      delay:    parseFloat((r() * 20).toFixed(2)),        // 0–20s
      driftX:   Math.floor(r() * 80) - 40,               // ±40px
      driftY:   Math.floor(r() * 120) - 20,              // -20 to +100px (mostly upward)
      type:     isFlare ? 'flare' : 'dot',
    };
  });
}

const PARTICLES = buildParticles(60);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function NeonFlareBackground() {
  return (
    <>
      {/* Keyframes injected once via a <style> tag — avoids adding to global CSS */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes neon-float {
            0%   { transform: translate(0, 0) scale(1);   opacity: var(--p-op); }
            30%  { transform: translate(calc(var(--dx) * 0.4px), calc(var(--dy) * -0.3px)) scale(1.05); }
            60%  { transform: translate(calc(var(--dx) * 0.8px), calc(var(--dy) * -0.7px)) scale(0.95); opacity: calc(var(--p-op) * 0.6); }
            100% { transform: translate(calc(var(--dx) * 1px), calc(var(--dy) * -1px)) scale(1); opacity: 0; }
          }
          @keyframes neon-pulse {
            0%, 100% { opacity: var(--p-op); transform: scale(1); }
            50%       { opacity: calc(var(--p-op) * 1.6); transform: scale(1.15); }
          }
          @keyframes neon-flare-pulse {
            0%, 100% { opacity: var(--p-op); transform: scale(1); }
            50%       { opacity: calc(var(--p-op) * 2.5); transform: scale(1.3); }
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .neon-flare-particle { animation: none !important; }
        }
      `}</style>

      {/* Container — fixed behind all content, clipped to viewport, no interaction */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        {PARTICLES.map((p, i) => {
          const isFlare = p.type === 'flare';
          const animName = isFlare ? 'neon-flare-pulse' : (i % 3 === 0 ? 'neon-pulse' : 'neon-float');

          return (
            <div
              key={i}
              className="neon-flare-particle"
              style={{
                position: 'absolute',
                left: `${p.x}%`,
                top:  `${p.y}%`,
                width:  p.size,
                height: p.size,
                borderRadius: '50%',
                backgroundColor: p.color,
                opacity: p.opacity,
                boxShadow: isFlare
                  ? `0 0 ${p.size * 2}px ${p.size}px ${p.glow.replace('0.8', '0.18').replace('0.75', '0.18').replace('0.7', '0.18').replace('0.65', '0.15')}`
                  : `0 0 ${p.size * 3 + 2}px ${p.size + 1}px ${p.glow}`,
                animation: `${animName} ${p.duration}s ${p.delay}s infinite ${isFlare ? 'ease-in-out' : 'linear'}`,
                // CSS custom properties used inside keyframes
                ['--p-op' as string]: p.opacity,
                ['--dx' as string]: p.driftX,
                ['--dy' as string]: p.driftY,
                // Flares use blur for softness
                filter: isFlare ? `blur(${p.size * 0.4}px)` : undefined,
                willChange: 'transform, opacity',
              }}
            />
          );
        })}
      </div>
    </>
  );
}
