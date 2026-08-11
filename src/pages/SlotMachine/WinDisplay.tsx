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
    <div className="relative w-full shrink-0">
      <div
        className="flex justify-between items-center px-4 py-3 rounded-lg border border-gray-700/60"
        style={{ background: 'rgba(13,13,26,0.9)' }}
      >
        <div className="flex flex-col items-start">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-orbitron">Balance</span>
          <span className="font-orbitron text-white text-base font-bold leading-tight">{fmt(balance)}</span>
        </div>
        {/* Vertical divider */}
        <div className="w-px self-stretch bg-gray-700/50 mx-2" />
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-orbitron">Last Payout</span>
          <span className={`font-orbitron text-base font-bold leading-tight ${lastWin > bet ? 'text-green-400' : lastWin > 0 ? 'text-yellow-300' : 'text-gray-600'}`}>
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
