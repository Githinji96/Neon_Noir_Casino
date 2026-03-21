import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface PaytableModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STANDARD_SYMBOLS = [
  { emoji: '💎', name: 'DIAMOND', payout5: 500, payout4: 200, payout3: 50 },
  { emoji: '🪙', name: 'TOKEN',   payout5: 250, payout4: 100, payout3: 25 },
  { emoji: '🎰', name: 'CHIP',    payout5: 150, payout4: 75,  payout3: 15 },
  { emoji: '7️⃣', name: 'SEVEN',   payout5: 100, payout4: 50,  payout3: 10 },
  { emoji: '🍒', name: 'CHERRY',  payout5: 80,  payout4: 30,  payout3: 8  },
];

function PremiumCard({
  tag, tagColor, title, description, payouts, gradient, icon,
}: {
  tag: string;
  tagColor: string;
  title: string;
  description: string[];
  payouts: { label: string; value: string }[];
  gradient: string;
  icon: string;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="relative rounded-2xl p-5 overflow-hidden flex flex-col gap-3"
      style={{
        background: gradient,
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Watermark icon */}
      <div className="absolute right-3 bottom-3 text-6xl opacity-10 select-none pointer-events-none">
        {icon}
      </div>

      {/* Tag */}
      <span
        className="self-start px-2.5 py-0.5 rounded-full font-orbitron text-xs font-bold tracking-widest"
        style={{ background: tagColor, color: '#000' }}
      >
        {tag}
      </span>

      {/* Title */}
      <h3 className="font-orbitron text-lg font-bold text-white tracking-wider">{title}</h3>

      {/* Description */}
      <ul className="flex flex-col gap-1">
        {description.map((d, i) => (
          <li key={i} className="text-white/70 text-xs flex items-start gap-1.5">
            <span className="text-yellow-300 mt-0.5">▸</span> {d}
          </li>
        ))}
      </ul>

      {/* Payouts */}
      <div className="flex flex-col gap-1 mt-1">
        {payouts.map((p) => (
          <div key={p.label} className="flex items-center justify-between">
            <span className="font-orbitron text-xs text-white/50 tracking-wider">{p.label}</span>
            <span className="font-orbitron text-sm font-bold text-white">{p.value}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function SymbolCard({ emoji, name, payout5, payout4, payout3 }: typeof STANDARD_SYMBOLS[0]) {
  return (
    <motion.div
      whileHover={{ scale: 1.06, y: -3 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className="flex flex-col items-center gap-2 rounded-xl p-3 cursor-default"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}
    >
      <span className="text-3xl">{emoji}</span>
      <span className="font-orbitron text-xs font-bold text-white/80 tracking-wider">{name}</span>
      <div className="w-full flex flex-col gap-0.5 mt-1">
        {[
          { label: '5×', value: `x${payout5}`, color: '#FFD700' },
          { label: '4×', value: `x${payout4}`, color: '#a78bfa' },
          { label: '3×', value: `x${payout3}`, color: '#67e8f9' },
        ].map((row) => (
          <div key={row.label} className="flex justify-between items-center">
            <span className="text-white/40 text-xs font-orbitron">{row.label}</span>
            <span className="font-orbitron text-xs font-bold" style={{ color: row.color }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function PaytableModal({ isOpen, onClose }: PaytableModalProps) {
  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl flex flex-col"
            style={{
              background: 'linear-gradient(160deg, #0d0020 0%, #0a0018 60%, #050010 100%)',
              border: '1px solid rgba(255,215,0,0.15)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 32px 80px rgba(0,0,0,0.8), 0 0 60px rgba(124,58,237,0.15)',
            }}
          >
            {/* ── HEADER ── */}
            <div className="relative px-6 pt-6 pb-4">
              <p className="font-orbitron text-xs text-white/30 tracking-[0.3em] uppercase mb-1">
                Machine Mechanics
              </p>
              <h2
                className="font-orbitron text-2xl font-bold tracking-widest"
                style={{ color: '#FFD700', textShadow: '0 0 20px rgba(255,215,0,0.5)' }}
              >
                PAYTABLE & RULES
              </h2>
              <div
                className="mt-3 h-px w-full"
                style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.6), rgba(124,58,237,0.4), transparent)' }}
              />
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="px-6 pb-6 flex flex-col gap-6">
              {/* ── PREMIUM SYMBOLS ── */}
              <section>
                <p className="font-orbitron text-xs text-white/40 tracking-widest uppercase mb-3">
                  ⭐ Premium Symbols
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <PremiumCard
                    tag="SPECIAL"
                    tagColor="#FFD700"
                    title="THE WILD NOIR"
                    icon="🃏"
                    description={[
                      'Substitutes for all symbols except Scatter',
                      'Doubles all winning combinations',
                    ]}
                    payouts={[
                      { label: '5×', value: 'x5000' },
                      { label: '4×', value: 'x1000' },
                    ]}
                    gradient="linear-gradient(135deg, rgba(180,120,0,0.35) 0%, rgba(80,40,0,0.5) 100%)"
                  />
                  <PremiumCard
                    tag="FEATURE"
                    tagColor="#00FFFF"
                    title="CYBER VOLT"
                    icon="⚡"
                    description={[
                      '3+ symbols trigger Free Spins',
                      'Wins multiplied by total bet',
                    ]}
                    payouts={[
                      { label: '3×', value: 'FREE SPINS' },
                      { label: '5×', value: 'x100 TOTAL' },
                    ]}
                    gradient="linear-gradient(135deg, rgba(0,180,180,0.2) 0%, rgba(80,0,160,0.4) 100%)"
                  />
                </div>
              </section>

              {/* ── STANDARD PAYOUTS ── */}
              <section>
                <p className="font-orbitron text-xs text-white/40 tracking-widest uppercase mb-3">
                  💰 Standard Payouts
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {STANDARD_SYMBOLS.map((sym) => (
                    <SymbolCard key={sym.name} {...sym} />
                  ))}
                </div>
              </section>

              {/* ── PAYLINES INFO ── */}
              <section
                className="rounded-2xl p-4"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <p className="font-orbitron text-xs text-white/40 tracking-widest uppercase mb-3">
                  📐 Paylines
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  {[
                    { label: 'Active Lines', value: '5' },
                    { label: 'Reels', value: '5 × 3' },
                    { label: 'Min Match', value: '3 of a kind' },
                  ].map((item) => (
                    <div key={item.label} className="flex flex-col gap-1">
                      <span className="font-orbitron text-lg font-bold text-white">{item.value}</span>
                      <span className="text-white/40 text-xs">{item.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── FOOTER ── */}
              <div
                className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="font-orbitron text-xs text-white/30 tracking-widest">RTP</p>
                    <p className="font-orbitron text-lg font-bold" style={{ color: '#FFD700' }}>96.5%</p>
                  </div>
                  <div className="text-center">
                    <p className="font-orbitron text-xs text-white/30 tracking-widest">VOLATILITY</p>
                    <p className="font-orbitron text-lg font-bold text-red-400">HIGH</p>
                  </div>
                  <div className="text-center">
                    <p className="font-orbitron text-xs text-white/30 tracking-widest">MAX WIN</p>
                    <p className="font-orbitron text-lg font-bold text-cyan-400">x5000</p>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.04, boxShadow: '0 0 24px rgba(255,215,0,0.5)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onClose}
                  className="px-8 py-3 rounded-xl font-orbitron text-sm font-bold tracking-widest text-black"
                  style={{
                    background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                    boxShadow: '0 0 16px rgba(255,215,0,0.3)',
                  }}
                >
                  BACK TO GAME
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
