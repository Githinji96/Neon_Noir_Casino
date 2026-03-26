import { useGameStore } from '../../store/gameStore';
import { MIN_BET, MAX_BET } from '../../config/betLadder';

export default function BettingControls() {
  const bet = useGameStore((s) => s.bet);
  const balance = useGameStore((s) => s.balance);
  const setBet = useGameStore((s) => s.setBet);

  const isMin = bet === MIN_BET;
  const isMax = bet === MAX_BET;
  const insufficient = balance < bet;

  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-gray-400 uppercase tracking-widest mb-2" style={{ fontVariant: 'small-caps' }}>
        Bet Amount
      </span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setBet('down')}
          disabled={isMin}
          className={`w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white text-lg transition-colors
            ${isMin ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20'}`}
          aria-label="Decrease bet"
        >
          −
        </button>

        <span className="text-xl sm:text-2xl font-orbitron text-neon-yellow font-bold min-w-[80px] sm:min-w-[100px] text-center">
          ${bet.toFixed(2)}
        </span>

        <button
          onClick={() => setBet('up')}
          disabled={isMax}
          className={`w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white text-lg transition-colors
            ${isMax ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20'}`}
          aria-label="Increase bet"
        >
          +
        </button>
      </div>

      {insufficient && (
        <p className="text-red-400 text-xs font-orbitron mt-1 text-center">
          INSUFFICIENT BALANCE
        </p>
      )}
    </div>
  );
}
