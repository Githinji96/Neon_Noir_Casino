import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';

export default function FreeSpinsBanner() {
  const freeSpinsRemaining = useGameStore((s) => s.freeSpinsRemaining);
  const freeSpinsTotalWin = useGameStore((s) => s.freeSpinsTotalWin);
  const isSpinning = useGameStore((s) => s.isSpinning);

  const [showSummary, setShowSummary] = useState(false);
  const [summaryWin, setSummaryWin] = useState(0);
  const [prevRemaining, setPrevRemaining] = useState(freeSpinsRemaining);

  useEffect(() => {
    if (prevRemaining > 0 && freeSpinsRemaining === 0 && !isSpinning) {
      if (freeSpinsTotalWin > 0) {
        setSummaryWin(freeSpinsTotalWin);
        setShowSummary(true);
      }
    }
    setPrevRemaining(freeSpinsRemaining);
  }, [freeSpinsRemaining, isSpinning]);

  return (
    <>
      {/* Active free spins banner */}
      <AnimatePresence>
        {freeSpinsRemaining > 0 && (
          <motion.div
            key="banner"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="w-full mb-4"
          >
            <motion.div
              animate={{ boxShadow: ['0 0 10px #00ffff', '0 0 25px #a855f7', '0 0 10px #00ffff'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="rounded-xl border border-cyan-400 bg-black/70 px-6 py-3 flex items-center justify-between"
            >
              <motion.span
                animate={{ opacity: [1, 0.6, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="text-xl font-bold tracking-widest text-cyan-300"
              >
                🎰 FREE SPINS
              </motion.span>
              <span className="text-2xl font-extrabold text-purple-400 tracking-widest">
                {freeSpinsRemaining} REMAINING
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Free spins summary modal */}
      <AnimatePresence>
        {showSummary && (
          <motion.div
            key="summary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="rounded-2xl border border-cyan-400 bg-gray-900 px-10 py-8 flex flex-col items-center gap-4 shadow-[0_0_40px_#00ffff55]"
            >
              <h2 className="text-3xl font-extrabold tracking-widest text-cyan-300">
                FREE SPINS COMPLETE!
              </h2>
              <p className="text-xl text-purple-300 font-semibold">
                You won{' '}
                <span className="text-yellow-400 font-extrabold">
                  ${summaryWin.toFixed(2)}
                </span>
              </p>
              <button
                onClick={() => setShowSummary(false)}
                className="mt-2 px-8 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold tracking-widest text-lg transition-colors"
              >
                COLLECT
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
