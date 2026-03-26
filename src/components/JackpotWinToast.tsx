import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useJackpotStore } from '../store/jackpotStore';

/**
 * Global jackpot win toast — shows whenever ANY player wins a jackpot.
 * Listens to jackpotStore.globalWinEvent which is populated by Supabase Realtime.
 * Auto-dismisses after 8 seconds.
 */
export default function JackpotWinToast() {
  const globalWinEvent = useJackpotStore((s) => s.globalWinEvent);
  const clearGlobalWinEvent = useJackpotStore((s) => s.clearGlobalWinEvent);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!globalWinEvent) { setVisible(false); return; }
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(clearGlobalWinEvent, 400); // clear after exit animation
    }, 8000);
    return () => clearTimeout(t);
  }, [globalWinEvent, clearGlobalWinEvent]);

  return (
    <AnimatePresence>
      {visible && globalWinEvent && (
        <motion.div
          key={globalWinEvent.timestamp}
          initial={{ y: -120, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -120, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="fixed top-4 left-1/2 z-[9999] -translate-x-1/2 w-[min(480px,92vw)]"
        >
          <div
            className="relative overflow-hidden rounded-2xl px-6 py-4 flex flex-col items-center gap-2 text-center"
            style={{
              background: 'linear-gradient(135deg, #1a0a00 0%, #0d0020 100%)',
              border: '1px solid rgba(255,215,0,0.5)',
              boxShadow: '0 0 40px rgba(255,215,0,0.4), 0 0 80px rgba(255,165,0,0.2)',
            }}
          >
            {/* Shimmer overlay */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(105deg, transparent 40%, rgba(255,215,0,0.08) 50%, transparent 60%)',
              }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1.5 }}
            />

            <div className="text-2xl">🎰</div>

            <p className="font-orbitron font-black text-[#FFD700] text-sm tracking-widest uppercase"
              style={{ textShadow: '0 0 12px rgba(255,215,0,0.8)' }}>
              JACKPOT WON!
            </p>

            <p className="font-orbitron font-bold text-white text-xl"
              style={{ textShadow: '0 0 8px rgba(255,255,255,0.4)' }}>
              {globalWinEvent.jackpotName}
            </p>

            <motion.p
              className="font-orbitron font-black text-3xl"
              style={{
                color: '#FFD700',
                textShadow: '0 0 20px rgba(255,215,0,1), 0 0 40px rgba(255,165,0,0.6)',
              }}
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1 }}
            >
              KES {globalWinEvent.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </motion.p>

            {globalWinEvent.winnerUsername && (
              <p className="text-white/50 text-xs tracking-widest">
                Won by <span className="text-white/80 font-semibold">{globalWinEvent.winnerUsername}</span>
              </p>
            )}

            {/* Progress bar countdown */}
            <motion.div
              className="absolute bottom-0 left-0 h-0.5 rounded-full"
              style={{ background: 'linear-gradient(90deg, #FFD700, #FF6B00)' }}
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 8, ease: 'linear' }}
            />

            <button
              onClick={() => { setVisible(false); setTimeout(clearGlobalWinEvent, 400); }}
              className="absolute top-2 right-3 text-white/30 hover:text-white/70 text-lg leading-none transition-colors"
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
