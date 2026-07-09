import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';

export default function WinDisplay() {
  const balance = useGameStore((s) => s.balance);
  const lastWin = useGameStore((s) => s.lastWin);
  const bet = useGameStore((s) => s.bet);
  const isSpinning = useGameStore((s) => s.isSpinning);

  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    // Only show WIN overlay when payout exceeds the bet (actual profit)
    if (lastWin > bet && !isSpinning) {
      setShowOverlay(true);
      const timer = setTimeout(() => setShowOverlay(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastWin, isSpinning]);

  const fmt = (n: number) =>
    `KES ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="relative w-full">
      <div className="flex justify-between items-center px-4 py-2 bg-gray-900/80 rounded-lg border border-gray-700">
        <div className="flex flex-col items-start">
          <span className="text-xs text-gray-400 uppercase tracking-widest">Balance</span>
          <span className="font-orbitron text-white text-lg">{fmt(balance)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-gray-400 uppercase tracking-widest">Last Payout</span>
          <span className={`font-orbitron text-lg ${lastWin > bet ? 'text-green-400' : lastWin > 0 ? 'text-yellow-300' : 'text-white/30'}`}>
            {fmt(lastWin)}
          </span>
        </div>
      </div>

      <AnimatePresence>
        {showOverlay && (
          <motion.div
            key="win-overlay"
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: [0.5, 1.2, 1.0] }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.4, times: [0, 0.6, 1] }}
          >
            <div className="bg-black/70 rounded-xl px-6 py-3 border border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)]">
              <span className="font-orbitron text-yellow-300 text-2xl font-bold tracking-wider">
                WIN! {fmt(lastWin)}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
