import { motion, useAnimation } from 'framer-motion';
import { useEffect } from 'react';
import { SymbolId } from '../../config/symbols';
import SymbolCell from './SymbolCell';

interface ReelColumnProps {
  symbols: SymbolId[];      // 3 visible symbols [row0, row1, row2]
  isSpinning: boolean;
  stopDelay: number;        // ms stagger offset (colIndex * 150)
  winningRows: number[];    // row indices that are winning (0, 1, 2)
  turboMode: boolean;
}

export default function ReelColumn({
  symbols,
  isSpinning,
  stopDelay,
  winningRows,
  turboMode,
}: ReelColumnProps) {
  const controls = useAnimation();
  const cycleDuration = turboMode ? 0.12 : 0.55;
  const blurAmount = turboMode ? '4px' : '2px';

  useEffect(() => {
    if (isSpinning) {
      controls.start({
        y: [0, -28, 0],
        filter: [`blur(0px)`, `blur(${blurAmount})`, `blur(0px)`],
        transition: {
          duration: cycleDuration,
          repeat: Infinity,
          ease: 'linear',
          delay: turboMode ? (stopDelay / 1000) * 0.4 : stopDelay / 1000,
        },
      });
    } else {
      controls.start({
        y: 0,
        filter: 'blur(0px)',
        transition: {
          type: 'spring',
          stiffness: turboMode ? 600 : 300,
          damping: turboMode ? 25 : 15,
          delay: turboMode ? (stopDelay / 1000) * 0.3 : stopDelay / 1000,
        },
      });
    }
  }, [isSpinning, cycleDuration, stopDelay, controls, blurAmount, turboMode]);

  return (
    <div className="flex flex-col gap-1 overflow-hidden rounded-xl bg-black/40 p-1 border border-white/5">
      <motion.div
        animate={controls}
        className="flex flex-col gap-1"
      >
        {symbols.map((symbolId, rowIndex) => (
          <SymbolCell
            key={rowIndex}
            symbolId={symbolId}
            isWinning={!isSpinning && winningRows.includes(rowIndex)}
          />
        ))}
      </motion.div>
    </div>
  );
}
