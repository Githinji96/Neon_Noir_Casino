import { useRef, useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useTranslation } from '../../i18n/useTranslation';

export default function BettingControls() {
  const t = useTranslation();
  const bet = useGameStore((s) => s.bet);
  const balance = useGameStore((s) => s.balance);
  const setBet = useGameStore((s) => s.setBet);
  const isSpinning = useGameStore((s) => s.isSpinning);
  const jackpotMode = useGameStore((s) => s.jackpotMode);
  const activeGameId = useGameStore((s) => s.activeGameId);
  const isBetLocked = jackpotMode && activeGameId === 'cyber-strike-777';

  const MIN_BET = 1;
  const MAX_BET = 10_000; // cap bet at KES 10,000 — balance check is handled separately

  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isMin = bet <= MIN_BET;
  const isMax = bet >= MAX_BET;
  const insufficient = balance < bet;

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function openEditor() {
    if (isSpinning) return;
    setInputVal(String(bet));
    setError('');
    setEditing(true);
  }

  function applyInput() {
    const parsed = parseFloat(inputVal);
    if (isNaN(parsed)) { setError('Enter a valid number'); return; }
    if (parsed < MIN_BET) { setError(`Min is KES ${MIN_BET}`); return; }
    if (parsed > MAX_BET) { setError(`Max is KES ${MAX_BET.toLocaleString()}`); return; }
    useGameStore.setState({ bet: Math.round(parsed * 100) / 100 });
    setEditing(false);
    setError('');
  }

  function cancelEdit() {
    setEditing(false);
    setError('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') applyInput();
    if (e.key === 'Escape') cancelEdit();
  }

  return (
    <div className="flex flex-col items-center shrink-0 w-full">
      {/* BET AMOUNT label */}
      <span
        className="text-gray-400 uppercase tracking-widest font-orbitron text-center w-full"
        style={{ fontSize: 'clamp(9px, 2.5vw, 12px)', marginTop: 'clamp(6px, 1.5vh, 12px)', marginBottom: '2px' }}
      >
        {t.slot_bet_amount}
      </span>

      {/* Cyber Strike 777 jackpot mode: fixed KES 100 bet, locked */}
      {isBetLocked ? (
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2 px-5 py-2 rounded-xl"
            style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.3)' }}>
            <span className="text-xl sm:text-2xl font-orbitron text-neon-yellow font-bold"
              style={{ textShadow: '0 0 8px rgba(255,215,0,0.6)' }}>
              KES {bet.toFixed(2)}
            </span>
            <span className="text-[10px] font-orbitron text-yellow-600 tracking-widest">🔒 FIXED</span>
          </div>
          <p className="text-yellow-600/70 text-[10px] font-orbitron tracking-widest">
            Jackpot games require KES 100 bet
          </p>
        </div>
      ) : editing ? (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="font-orbitron text-neon-yellow font-bold text-lg">KES</span>
            <input
              ref={inputRef}
              type="number"
              min={MIN_BET}
              max={MAX_BET}
              step="0.01"
              value={inputVal}
              onChange={(e) => { setInputVal(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
              className="w-28 text-center font-orbitron text-neon-yellow font-bold text-xl bg-black/60 border-2 border-neon-yellow rounded-lg px-2 py-1 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              style={{ textShadow: '0 0 8px rgba(255,215,0,0.6)' }}
            />
          </div>
          {error && <p className="text-red-400 text-xs font-orbitron">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={applyInput}
              className="px-4 py-1 rounded-lg bg-neon-yellow text-black font-orbitron text-xs font-bold tracking-widest hover:bg-yellow-400 transition-colors"
            >
              SET
            </button>
            <button
              onClick={cancelEdit}
              className="px-4 py-1 rounded-lg bg-white/10 text-white/60 font-orbitron text-xs tracking-widest hover:bg-white/20 transition-colors"
            >
              CANCEL
            </button>
          </div>
          <p className="text-white/20 text-[10px] font-orbitron tracking-wider">
            MIN KES {MIN_BET} · MAX KES {MAX_BET.toLocaleString()}
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 xs:gap-4">
          <button
            onClick={() => setBet('down')}
            disabled={isMin || isSpinning}
            className={`rounded-full bg-gray-800 border border-gray-600 flex items-center justify-center text-white transition-colors
              ${isMin || isSpinning ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-700'}`}
            style={{ width: 'clamp(36px, 10vw, 44px)', height: 'clamp(36px, 10vw, 44px)', fontSize: 'clamp(14px, 4vw, 20px)' }}
            aria-label="Decrease bet"
          >
            −
          </button>

          <button
            onClick={openEditor}
            disabled={isSpinning}
            title="Click to type a custom bet"
            className="font-orbitron text-yellow-400 font-bold text-center hover:opacity-80 transition-opacity disabled:cursor-not-allowed underline decoration-dotted underline-offset-4 decoration-yellow-600"
            style={{
              fontSize:  'clamp(14px, 4.5vw, 24px)',
              minWidth:  'clamp(100px, 30vw, 140px)',
              textShadow: '0 0 8px rgba(255,215,0,0.6)',
            }}
          >
            KES {bet.toFixed(2)}
          </button>

          <button
            onClick={() => setBet('up')}
            disabled={isMax || isSpinning}
            className={`rounded-full bg-gray-800 border border-gray-600 flex items-center justify-center text-white transition-colors
              ${isMax || isSpinning ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-700'}`}
            style={{ width: 'clamp(36px, 10vw, 44px)', height: 'clamp(36px, 10vw, 44px)', fontSize: 'clamp(14px, 4vw, 20px)' }}
            aria-label="Increase bet"
          >
            +
          </button>
        </div>
      )}

      {!editing && !isBetLocked && insufficient && (
        <p className="text-red-400 text-xs font-orbitron text-center">
          INSUFFICIENT BALANCE
        </p>
      )}
    </div>
  );
}
