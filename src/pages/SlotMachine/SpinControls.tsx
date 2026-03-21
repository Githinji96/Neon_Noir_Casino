import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';

export default function SpinControls() {
  const { isSpinning, balance, bet, autoplay, turboMode, soundEnabled, spin, toggleAutoplay, toggleTurboMode, toggleSound } = useGameStore();

  const isDisabled = isSpinning || balance <= 0 || balance < bet;

  return (
    <div className="flex flex-col items-center">
      {/* SPIN button */}
      <motion.button
        onClick={spin}
        disabled={isDisabled}
        animate={
          isDisabled
            ? { boxShadow: 'none' }
            : {
                boxShadow: [
                  '0 0 20px #FFD700, 0 0 40px #FFD70080',
                  '0 0 30px #FFD700, 0 0 60px #FFD700B0',
                  '0 0 20px #FFD700, 0 0 40px #FFD70080',
                ],
              }
        }
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        className={`w-24 h-24 rounded-full bg-neon-yellow text-black font-orbitron font-bold text-xl
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {isSpinning ? 'SPINNING...' : 'SPIN'}
      </motion.button>

      {/* Toggle row */}
      <div className="flex gap-4 justify-center mt-4">
        {/* AUTOPLAY toggle */}
        <button
          onClick={toggleAutoplay}
          className={`px-3 py-1 rounded-full text-xs font-orbitron border transition-colors
            ${autoplay
              ? 'border-neon-yellow text-neon-yellow bg-neon-yellow/10'
              : 'border-white/20 text-gray-400'
            }`}
        >
          AUTO
        </button>

        {/* TURBO toggle */}
        <button
          onClick={toggleTurboMode}
          className={`px-3 py-1 rounded-full text-xs font-orbitron border transition-colors
            ${turboMode
              ? 'border-cyan-400 text-cyan-400 bg-cyan-400/10'
              : 'border-white/20 text-gray-400'
            }`}
        >
          TURBO
        </button>

        {/* SOUND toggle */}
        <button
          onClick={toggleSound}
          className={`px-3 py-1 rounded-full text-xs font-orbitron border transition-colors
            ${soundEnabled
              ? 'border-neon-yellow text-neon-yellow bg-neon-yellow/10'
              : 'border-white/20 text-gray-400'
            }`}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>
      </div>
    </div>
  );
}
