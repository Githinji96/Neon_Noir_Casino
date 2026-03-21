import { motion } from 'framer-motion';
import { SymbolId, getSymbol } from '../../config/symbols';

interface SymbolCellProps {
  symbolId: SymbolId;
  isWinning: boolean;
}

const PREMIUM_SYMBOLS: SymbolId[] = ['wild', 'scatter', 'seven'];

function getPremiumBg(symbolId: SymbolId): string {
  if (symbolId === 'wild' || symbolId === 'scatter') return 'bg-purple-900/20';
  if (symbolId === 'seven') return 'bg-yellow-900/20';
  return '';
}

export default function SymbolCell({ symbolId, isWinning }: SymbolCellProps) {
  const symbol = getSymbol(symbolId);
  const isPremium = PREMIUM_SYMBOLS.includes(symbolId);
  const premiumBg = getPremiumBg(symbolId);

  const baseClasses = [
    'relative flex items-center justify-center',
    'w-full aspect-square',
    'rounded-lg border',
    'bg-black/60',
    isPremium ? premiumBg : '',
    isWinning
      ? 'border-neon-yellow shadow-neon-yellow'
      : 'border-white/10',
  ]
    .filter(Boolean)
    .join(' ');

  if (isWinning) {
    return (
      <motion.div
        className={baseClasses}
        animate={{ scale: [1, 1.1, 1], opacity: [1, 0.8, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="text-3xl md:text-4xl select-none">{symbol.emoji}</span>
      </motion.div>
    );
  }

  return (
    <div className={baseClasses}>
      <span className="text-3xl md:text-4xl select-none">{symbol.emoji}</span>
    </div>
  );
}
