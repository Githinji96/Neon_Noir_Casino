/**
 * NearMissToast — shown after a genuine near-jackpot spin result.
 *
 * FAIRNESS NOTE: This notification is triggered exclusively by the actual
 * reel outcome. It never implies that a jackpot is "due" or more likely.
 * It auto-dismisses and never interrupts gameplay.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useNearMissStore } from '../store/nearMissStore';

export default function NearMissToast() {
  const activeMessage  = useNearMissStore((s) => s.activeMessage);
  const activeGameName = useNearMissStore((s) => s.activeGameName);
  const duration       = useNearMissStore((s) => s.config.notificationDuration);
  const dismiss        = useNearMissStore((s) => s.dismissNotification);
  const navigate       = useNavigate();

  // Auto-dismiss after configured duration
  useEffect(() => {
    if (!activeMessage) return;
    const timer = setTimeout(dismiss, duration);
    return () => clearTimeout(timer);
  }, [activeMessage, duration]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {activeMessage && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          // Bottom-center toast — above BottomNav on mobile, clear of spin button
          className="fixed bottom-28 md:bottom-8 left-1/2 -translate-x-1/2 z-[150] pointer-events-none"
          style={{ width: 'min(360px, calc(100vw - 32px))' }}
        >
          <div
            className="flex flex-col gap-2 px-4 py-3.5 rounded-2xl pointer-events-auto"
            style={{
              background: 'linear-gradient(135deg, #0d0020 0%, #070015 100%)',
              border: '1px solid rgba(255,215,0,0.35)',
              boxShadow: '0 0 24px rgba(255,215,0,0.12), 0 8px 32px rgba(0,0,0,0.7)',
            }}
          >
            {/* Header row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <span
                  className="font-orbitron text-xs font-bold tracking-widest uppercase"
                  style={{ color: '#FFD700', textShadow: '0 0 8px rgba(255,215,0,0.5)' }}
                >
                  Near {activeGameName ?? 'Jackpot'}
                </span>
              </div>
              <button
                onClick={dismiss}
                className="text-white/25 hover:text-white/60 transition-colors text-sm leading-none"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>

            {/* Message */}
            <p className="text-white/75 text-[12px] leading-relaxed">
              {activeMessage}
            </p>

            {/* Footer row */}
            <div className="flex items-center justify-between gap-3 mt-0.5">
              {/* Progress bar — shows time remaining */}
              <div className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/10">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'rgba(255,215,0,0.6)' }}
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: duration / 1000, ease: 'linear' }}
                />
              </div>

              {/* View Jackpot Rules link */}
              <button
                onClick={() => { dismiss(); navigate('/jackpots'); }}
                className="font-orbitron text-[10px] tracking-wider transition-colors shrink-0"
                style={{ color: 'rgba(255,215,0,0.6)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#FFD700')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,215,0,0.6)')}
              >
                View Jackpot →
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
