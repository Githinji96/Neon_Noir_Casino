/**
 * Near-Miss Toast
 * Non-intrusive notification shown after genuine near-miss jackpot outcomes.
 * Auto-dismisses after 5 seconds. Does not interrupt gameplay.
 */

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNearMissStore } from '../store/nearMissStore';

export default function NearMissToast() {
  const activeMessage = useNearMissStore((s) => s.activeMessage);
  const dismissNotification = useNearMissStore((s) => s.dismissNotification);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (!activeMessage) return;
    const timer = setTimeout(dismissNotification, 5000);
    return () => clearTimeout(timer);
  }, [activeMessage]);

  return (
    <AnimatePresence>
      {activeMessage && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          style={{ maxWidth: '360px', width: 'calc(100vw - 32px)' }}
        >
          <div
            className="flex items-start gap-3 px-4 py-3 rounded-xl"
            style={{
              background: 'rgba(10,10,20,0.95)',
              border: '1px solid rgba(255,215,0,0.3)',
              boxShadow: '0 0 20px rgba(255,215,0,0.15)',
            }}
          >
            <span className="text-xl shrink-0 mt-0.5">⚡</span>
            <div className="flex-1 min-w-0">
              <p className="font-orbitron text-xs font-bold text-yellow-400 tracking-wider mb-0.5">
                NEAR MISS
              </p>
              <p className="text-white/70 text-xs leading-relaxed">{activeMessage}</p>
            </div>
            {/* Progress bar showing auto-dismiss */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl overflow-hidden">
              <motion.div
                className="h-full bg-yellow-400/50"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 5, ease: 'linear' }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
