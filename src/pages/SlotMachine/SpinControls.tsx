import { useRef, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { setMusicVolume, getMusicVolume } from '../../utils/jamendo';
import { useTranslation } from '../../i18n/useTranslation';

export default function SpinControls() {
  const t = useTranslation();
  const { isSpinning, balance, bet, autoplay, turboMode, soundEnabled, spin, toggleAutoplay, toggleTurboMode, toggleSound } = useGameStore();
  const [showVolume, setShowVolume] = useState(false);
  const [volume, setVolume] = useState(() => getMusicVolume());
  const popupRef = useRef<HTMLDivElement>(null);

  // Ref-based guard prevents double-click from firing two spins before
  // React re-renders with isSpinning=true (Framer Motion can buffer clicks
  // during the animation frame gap between click and state update).
  const spinFiredRef = useRef(false);

  const isDisabled = isSpinning || balance <= 0 || balance < bet;

  function handleSpin() {
    if (isDisabled) return;
    if (spinFiredRef.current) return; // double-click guard
    spinFiredRef.current = true;
    spin();
    // Reset after a short delay — long enough to cover the React render cycle
    setTimeout(() => { spinFiredRef.current = false; }, 300);
  }

  // Also reset the ref whenever isSpinning changes back to false
  useEffect(() => {
    if (!isSpinning) spinFiredRef.current = false;
  }, [isSpinning]);

  // Stable animate objects — defined outside render so framer-motion doesn't
  // restart the glow animation on every balance/state re-render.
  const glowAnimate = useMemo(() => ({
    boxShadow: [
      '0 0 20px #FFD700, 0 0 40px #FFD70080',
      '0 0 30px #FFD700, 0 0 60px #FFD700B0',
      '0 0 20px #FFD700, 0 0 40px #FFD70080',
    ],
  }), []);
  const disabledAnimate = useMemo(() => ({ boxShadow: 'none' }), []);

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
    <div className="flex flex-col items-center shrink-0">
      {/* SPIN button — scales with viewport, min 72px on tiny screens */}
      <motion.button
        onClick={handleSpin}
        disabled={isDisabled}
        aria-label="SPIN"
        animate={isDisabled ? disabledAnimate : glowAnimate}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        className={`rounded-full bg-yellow-400 text-black font-orbitron font-bold transition-opacity
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{
          width:    'clamp(72px, 20vw, 96px)',
          height:   'clamp(72px, 20vw, 96px)',
          fontSize: 'clamp(14px, 4vw, 20px)',
        }}
      >
        {isSpinning ? '...' : t.slot_spin}
      </motion.button>

      {/* Toggle row — compact on small screens */}
      <div className="flex gap-2 xs:gap-4 justify-center mt-1.5 xs:mt-3">
        {/* AUTOPLAY toggle */}
        <button
          onClick={toggleAutoplay}
          className={`border rounded-full px-2.5 xs:px-4 py-1 xs:py-1.5 font-orbitron transition-colors
            ${autoplay
              ? 'border-neon-yellow text-neon-yellow bg-neon-yellow/10'
              : 'border-white/20 text-gray-400 hover:border-white/40'
            }`}
          style={{ fontSize: 'clamp(9px, 2.5vw, 12px)' }}
        >
          {t.slot_auto}
        </button>

        {/* TURBO toggle */}
        <button
          onClick={toggleTurboMode}
          className={`border rounded-full px-2.5 xs:px-4 py-1 xs:py-1.5 font-orbitron transition-all duration-200
            ${turboMode
              ? 'border-cyan-400 text-cyan-400 bg-cyan-400/10 shadow-[0_0_12px_rgba(34,211,238,0.4)]'
              : 'border-white/20 text-gray-400 hover:border-white/40'
            }`}
          style={{
            fontSize: 'clamp(9px, 2.5vw, 12px)',
            ...(turboMode ? { textShadow: '0 0 8px rgba(34,211,238,0.8)' } : {}),
          }}
        >
          {turboMode ? `⚡ ${t.slot_turbo}` : t.slot_turbo}
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
            className={`rounded-full px-2.5 xs:px-3 py-1 xs:py-1.5 border font-orbitron transition-colors
              ${soundEnabled
                ? 'border-neon-yellow text-neon-yellow bg-neon-yellow/10'
                : 'border-white/20 text-gray-400 hover:border-white/40'
              }`}
            style={{ fontSize: 'clamp(9px, 2.5vw, 12px)' }}
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
