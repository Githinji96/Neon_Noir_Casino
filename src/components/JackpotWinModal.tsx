import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useJackpotStore, type JackpotWin } from '../store/jackpotStore';

interface Props {
  win: JackpotWin;
  onClose: () => void;
}

function Confetti() {
  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#A855F7', '#06B6D4', '#F97316'];
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {Array.from({ length: 60 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-sm"
          style={{
            background: colors[i % colors.length],
            left: `${Math.random() * 100}%`,
            top: '-8px',
          }}
          animate={{
            y: ['0vh', '110vh'],
            x: [0, (Math.random() - 0.5) * 200],
            rotate: [0, Math.random() * 720],
            opacity: [1, 0.8, 0],
          }}
          transition={{
            duration: 2.5 + Math.random() * 2,
            delay: Math.random() * 1.5,
            ease: 'easeIn',
          }}
        />
      ))}
    </div>
  );
}

export default function JackpotWinModal({ win, onClose }: Props) {
  const formatted = win.amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <AnimatePresence>
      <Confetti />
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex flex-col items-center gap-6 p-10 rounded-3xl text-center max-w-md w-full"
          style={{
            background: 'linear-gradient(160deg, #1a0040 0%, #050010 100%)',
            border: '2px solid rgba(255,215,0,0.6)',
            boxShadow: '0 0 60px rgba(255,215,0,0.4), 0 0 120px rgba(255,215,0,0.15)',
          }}
        >
          {/* Trophy */}
          <motion.div
            className="text-7xl"
            animate={{ scale: [1, 1.15, 1], rotate: [-5, 5, -5, 0] }}
            transition={{ duration: 1.2, repeat: 3 }}
          >
            🏆
          </motion.div>

          <div>
            <p className="font-orbitron text-xs text-white/40 tracking-[0.4em] uppercase mb-2">
              JACKPOT WIN
            </p>
            <h2
              className="font-orbitron text-2xl font-bold text-white tracking-widest mb-1"
            >
              {win.jackpotName}
            </h2>
          </div>

          {/* Amount */}
          <motion.p
            className="font-orbitron font-bold text-5xl"
            style={{ color: '#FFD700', textShadow: '0 0 30px rgba(255,215,0,0.9)' }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            ${formatted}
          </motion.p>

          <p className="font-orbitron text-sm text-cyan-400 tracking-widest">
            ADDED TO YOUR BALANCE
          </p>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl font-orbitron font-bold text-sm tracking-widest text-black transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #FFD700, #FFA500)',
              boxShadow: '0 0 20px rgba(255,215,0,0.5)',
            }}
          >
            COLLECT & CONTINUE
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
