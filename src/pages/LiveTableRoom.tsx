import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';
import { useGameStore } from '../store/gameStore';
import { CHIP_VALUES, type LiveTable } from '../config/liveTablesData';
import { outcomeEngine, type RoundResult } from '../logic/outcomeEngine/outcomeEngine';
import type { GameMode } from '../logic/outcomeEngine/outcomeConfig';

type GamePhase = 'betting' | 'locked' | 'result';

export default function LiveTableRoom() {
  const { tableId: _tableId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const table = (location.state as { table: LiveTable } | null)?.table;

  const balance = useGameStore((s) => s.balance);
  const setBalance = (v: number) => useGameStore.setState({ balance: v });

  const [chips, setChips] = useState(0);
  const [phase, setPhase] = useState<GamePhase>('betting');
  const [result, setResult] = useState<RoundResult | null>(null);
  const [timer, setTimer] = useState(15);
  const [sessionRTP, setSessionRTP] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const balanceRef = useRef(balance);
  const chipsRef = useRef(chips);
  // tracks whether the user has explicitly clicked PLACE BET this round
  const betPlacedRef = useRef(false);

  useEffect(() => { balanceRef.current = balance; }, [balance]);
  useEffect(() => { chipsRef.current = chips; }, [chips]);

  const gameType = (table?.gameType ?? 'roulette') as GameMode;
  const accentColor = { blackjack: '#00ff88', roulette: '#ff4466', baccarat: '#aa44ff', poker: '#ffaa00' }[gameType] ?? '#FFD700';
  const phaseLabel = { betting: 'Place Your Bets', locked: 'Bets Locked — Spinning…', result: result?.outcome ?? '' }[phase];

  useEffect(() => {
    startBettingPhase();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function startBettingPhase() {
    // Reset everything for a fresh round
    betPlacedRef.current = false;
    chipsRef.current = 0;
    setChips(0);
    setPhase('betting');
    setResult(null);
    setTimer(15);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          // Timer expired — only resolve if user placed a bet, otherwise skip round
          if (betPlacedRef.current) {
            resolveRound();
          } else {
            // No bet placed — just start next round after a short pause
            setTimeout(startBettingPhase, 1000);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  function resolveRound() {
    setPhase('locked');
    setTimeout(() => {
      const bet = chipsRef.current;
      if (bet <= 0) {
        setTimeout(startBettingPhase, 1000);
        return;
      }

      const resolved = outcomeEngine.resolve({ gameMode: gameType, bet });
      setResult(resolved);
      setPhase('result');
      setSessionRTP(resolved.sessionRTP);

      const newBalance = Math.round((balanceRef.current - bet + resolved.payout) * 100) / 100;
      setBalance(Math.max(0, newBalance));

      setLog((prev) => [
        `${resolved.outcome} | Bet ${bet} → ${resolved.won ? `+${resolved.payout}` : `-${bet}`} | RTP ${resolved.sessionRTP}%`,
        ...prev.slice(0, 9),
      ]);

      setTimeout(startBettingPhase, 5000);
    }, 2000);
  }

  function handlePlaceBet() {
    if (phase !== 'betting' || chipsRef.current <= 0) return;
    // Stop the countdown timer — user has committed their bet
    if (timerRef.current) clearInterval(timerRef.current);
    betPlacedRef.current = true;
    resolveRound();
  }

  function addChip(val: number) {
    if (phase !== 'betting') return;
    if (chipsRef.current + val > balanceRef.current) return;
    setChips((c) => c + val);
  }

  function clearBet() {
    if (phase === 'betting') {
      setChips(0);
    }
  }

  if (!table) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="font-orbitron text-red-400 tracking-widest">TABLE NOT FOUND</p>
        <button onClick={() => navigate('/live-tables')}
          className="text-yellow-300 font-orbitron text-xs tracking-widest hover:underline">
          ← BACK TO TABLES
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 md:pb-6">
        <button onClick={() => navigate('/live-tables')}
          className="mb-4 font-orbitron text-xs text-gray-400 hover:text-white tracking-widest transition-colors">
          ← LIVE TABLES
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left: stream + state + log */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Stream placeholder */}
            <div className="relative rounded-2xl overflow-hidden aspect-video flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #0d0020, #050010)', border: `1px solid ${accentColor}33` }}>
              <div className="flex flex-col items-center gap-3 text-center px-6">
                <span className="text-5xl">{table.dealerAvatar}</span>
                <p className="font-orbitron font-bold text-white text-lg tracking-widest">{table.dealerName}</p>
                <p className="text-gray-400 text-sm">Live stream coming soon</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400 text-xs font-orbitron tracking-widest">LIVE</span>
                </div>
              </div>
              {/* Timer bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                <motion.div className="h-full" style={{ background: accentColor }}
                  animate={{ width: `${(timer / 15) * 100}%` }} transition={{ duration: 0.5 }} />
              </div>
            </div>

            {/* Game state */}
            <div className="rounded-xl px-5 py-4 flex items-center justify-between"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <p className="text-gray-400 text-xs font-orbitron tracking-widest">GAME STATE</p>
                <AnimatePresence mode="wait">
                  <motion.p key={phaseLabel} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="font-orbitron font-bold text-sm mt-1"
                    style={{ color: phase === 'result' ? (result?.won ? '#00ff88' : '#ff4466') : accentColor }}>
                    {phaseLabel}
                  </motion.p>
                </AnimatePresence>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                {phase === 'betting' && (
                  <>
                    <p className="text-gray-400 text-xs font-orbitron tracking-widest">TIME LEFT</p>
                    <p className="font-orbitron font-bold text-2xl" style={{ color: timer <= 5 ? '#ff4466' : accentColor }}>{timer}s</p>
                  </>
                )}
                {sessionRTP > 0 && (
                  <p className="text-gray-500 text-[10px] font-orbitron">Session RTP: {sessionRTP}%</p>
                )}
              </div>
            </div>

            {/* Round log */}
            {log.length > 0 && (
              <div className="rounded-xl px-4 py-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-gray-500 text-[10px] font-orbitron tracking-widest mb-2">ROUND HISTORY</p>
                {log.map((entry, i) => (
                  <p key={i} className="text-gray-400 text-xs py-0.5 border-b border-white/5 last:border-0">{entry}</p>
                ))}
              </div>
            )}
          </div>

          {/* Right: betting panel */}
          <div className="flex flex-col gap-4">
            {/* Balance */}
            <div className="rounded-xl px-4 py-3 flex items-center justify-between"
              style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
              <span className="text-gray-400 text-xs font-orbitron tracking-widest">BALANCE</span>
              <span className="font-orbitron font-bold text-yellow-300">
                ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Current bet */}
            <div className="rounded-xl px-4 py-3 flex items-center justify-between"
              style={{ background: `${accentColor}11`, border: `1px solid ${accentColor}33` }}>
              <span className="text-gray-400 text-xs font-orbitron tracking-widest">YOUR BET</span>
              <span className="font-orbitron font-bold text-lg" style={{ color: accentColor }}>${chips}</span>
            </div>

            {/* Chips */}
            <div>
              <p className="text-gray-500 text-[10px] font-orbitron tracking-widest mb-2">SELECT CHIPS</p>
              <div className="grid grid-cols-3 gap-2">
                {CHIP_VALUES.map((val) => (
                  <button key={val} onClick={() => addChip(val)} disabled={phase !== 'betting'}
                    className="py-2 rounded-xl font-orbitron font-bold text-xs tracking-wider transition-all active:scale-95 disabled:opacity-30"
                    style={{ background: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44` }}>
                    ${val}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={clearBet} disabled={phase !== 'betting' || chips === 0}
                className="flex-1 py-2.5 rounded-xl font-orbitron text-xs tracking-widest text-gray-400 border border-white/10 hover:border-white/30 transition-colors disabled:opacity-30">
                CLEAR
              </button>
              <button
                onClick={handlePlaceBet}
                disabled={phase !== 'betting' || chips === 0}
                className="flex-1 py-2.5 rounded-xl font-orbitron font-bold text-xs tracking-widest text-black transition-all active:scale-95 disabled:opacity-30"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}99)`, boxShadow: `0 0 14px ${accentColor}55` }}>
                PLACE BET
              </button>
            </div>

            {/* Result banner */}
            <AnimatePresence>
              {phase === 'result' && result && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="rounded-xl px-4 py-4 text-center"
                  style={{
                    background: result.won ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)',
                    border: `1px solid ${result.won ? '#00ff8844' : '#ff446644'}`,
                  }}>
                  <p className="font-orbitron font-bold text-lg" style={{ color: result.won ? '#00ff88' : '#ff4466' }}>
                    {result.isBigWin ? '🎉 BIG WIN!' : result.won ? '✅ YOU WIN!' : '😔 YOU LOSE'}
                  </p>
                  <p className="text-white text-sm mt-1">{result.outcome}</p>
                  <p className="text-gray-400 text-xs">{result.detail}</p>
                  {result.won && <p className="font-orbitron text-yellow-300 font-bold mt-1">+${result.payout}</p>}
                  <p className="text-gray-500 text-xs mt-2">Next round starting…</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Table info */}
            <div className="rounded-xl px-4 py-3 text-xs space-y-1.5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex justify-between">
                <span className="text-gray-500">Table</span>
                <span className="text-white font-semibold">{table.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Players</span>
                <span className="text-white">{table.currentPlayers}/{table.maxPlayers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Min/Max Bet</span>
                <span className="text-white">${table.minBet} – ${table.maxBet.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
