import { type SpinGrid } from '../../logic/rng';
import { type WinResult } from '../../logic/paylines';
import ReelColumn from './ReelColumn';

interface ReelGridProps {
  reels: SpinGrid;
  isSpinning: boolean;
  winResults: WinResult[];
  turboMode: boolean;
}

function buildWinningRowsMap(winResults: WinResult[]): Map<number, Set<number>> {
  const map = new Map<number, Set<number>>();
  for (const result of winResults) {
    for (const [col, row] of result.cells) {
      if (!map.has(col)) {
        map.set(col, new Set());
      }
      map.get(col)!.add(row);
    }
  }
  return map;
}

export default function ReelGrid({ reels, isSpinning, winResults, turboMode }: ReelGridProps) {
  const hasWins = winResults.length > 0;
  const winningRowsMap = buildWinningRowsMap(winResults);

  return (
    <div
      className={[
        'flex flex-row gap-1.5 sm:gap-2',
        'bg-black/60 backdrop-blur rounded-2xl p-3 sm:p-4',
        'border',
        hasWins
          ? 'border-yellow-400/60 shadow-[0_0_20px_rgba(250,204,21,0.3)]'
          : 'border-white/10',
      ].join(' ')}
    >
      {Array.from({ length: 5 }, (_, colIndex) => (
        <ReelColumn
          key={colIndex}
          symbols={reels[colIndex]}
          isSpinning={isSpinning}
          stopDelay={colIndex * 150}
          winningRows={Array.from(winningRowsMap.get(colIndex) ?? [])}
          turboMode={turboMode}
        />
      ))}
    </div>
  );
}
