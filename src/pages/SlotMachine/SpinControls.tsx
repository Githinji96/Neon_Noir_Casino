import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { setMusicVolume, getMusicVolume } from '../../utils/jamendo';

export default function SpinControls() {
  const { isSpinning, balance, bet, autoplay, turboMode, soundEnabled, spin, toggleAutoplay, toggleTurboMode, toggleSound } = useGameStore();
  const [showVolume, setShowVolume] = useState(false);
  const [volume, setVolume] = useState(() => getMusicVolume());
  const popupRef = useRef<HTMLDivElement>(null);

  const isDisabled = isSpinning || balance <= 0 || balance < bet;

  // Close popup when clicking outside
  useEffect(() => {
    if (!showVolume) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowVolume(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showVolume]);

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    setMusicVolume(val);
  };

  const handleSoundToggle = () => {
    if (soundEnabled) {
      // Turning off — close volume popup too
      setShowVolume(false);
    }
    toggleSound();
  };

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
          className={`px-3 py-1 rounded-full text-xs font-orbitron border transition-all duration-200
            ${turboMode
              ? 'border-cyan-400 text-cyan-400 bg-cyan-400/10 shadow-[0_0_12px_rgba(34,211,238,0.4)]'
              : 'border-white/20 text-gray-400 hover:border-white/40'
            }`}
          style={turboMode ? { textShadow: '0 0 8px rgba(34,211,238,0.8)' } : undefined}
        >
          {turboMode ? '⚡ TURBO' : 'TURBO'}
        </button>

        {/* SOUND toggle + volume popup */}
        <div className="relative" ref={popupRef}>
          <button
            onClick={() => {
              if (!soundEnabled) {
                handleSoundToggle();
              } else {
                setShowVolume((v) => !v);
              }
            }}
            className={`px-3 py-1 rounded-full text-xs font-orbitron border transition-colors
              ${soundEnabled
                ? 'border-neon-yellow text-neon-yellow bg-neon-yellow/10'
                : 'border-white/20 text-gray-400'
              }`}
          >
            {soundEnabled ? (volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊') : '🔇'}
          </button>

          <AnimatePresence>
            {showVolume && soundEnabled && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 px-4 py-3 rounded-2xl"
                style={{
                  background: 'linear-gradient(160deg, #0d0020 0%, #050010 100%)',
                  border: '1px solid rgba(255,215,0,0.25)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 20px rgba(255,215,0,0.1)',
                  minWidth: '44px',
                }}
              >
                {/* Volume percentage */}
                <span className="font-orbitron text-xs text-yellow-400 tracking-wider">
                  {Math.round(volume * 100)}%
                </span>

                {/* Vertical slider */}
                <div className="relative flex items-center justify-center" style={{ height: '100px' }}>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="volume-slider-vertical"
                    style={{
                      writingMode: 'vertical-lr' as React.CSSProperties['writingMode'],
                      direction: 'rtl',
                      width: '6px',
                      height: '100px',
                      cursor: 'pointer',
                      appearance: 'slider-vertical' as React.CSSProperties['appearance'],
                      WebkitAppearance: 'slider-vertical' as React.CSSProperties['WebkitAppearance'],
                      accentColor: '#FFD700',
                    }}
                  />
                </div>

                {/* Mute toggle at bottom */}
                <button
                  onClick={handleSoundToggle}
                  className="font-orbitron text-xs text-red-400 hover:text-red-300 tracking-wider transition-colors"
                >
                  MUTE
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
