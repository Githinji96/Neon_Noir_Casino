import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { useLiveTablesStore } from '../store/liveTablesStore';
import { supabase } from '../lib/supabase';
import { getTableChipValues, type LiveTable } from '../config/liveTablesData';
import { outcomeEngine, type RoundResult } from '../logic/outcomeEngine/outcomeEngine';
import type { GameMode } from '../logic/outcomeEngine/outcomeConfig';

type GamePhase = 'betting' | 'locked' | 'result';

export default function LiveTableRoom() {
  const { tableId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const tables = useLiveTablesStore((s) => s.tables);
  const startPolling = useLiveTablesStore((s) => s.startPolling);
  const fallbackTable = (location.state as { table: LiveTable } | null)?.table;
  const table = tables.find((entry) => entry.id === tableId) ?? fallbackTable;

  const balance = useGameStore((s) => s.balance);
  const setBalance = (v: number) => useGameStore.setState({ balance: v });
  const { user, profile, syncBalance } = useAuthStore();

  const [chips, setChips] = useState(0);
  const [betInput, setBetInput] = useState('0');
  const [phase, setPhase] = useState<GamePhase>('betting');
  const [result, setResult] = useState<RoundResult | null>(null);
  const [lastBet, setLastBet] = useState(0);
  const [timer, setTimer] = useState(15);
  const [sessionRTP, setSessionRTP] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextRoundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const balanceRef = useRef(balance);
  const chipsRef = useRef(chips);
  // tracks whether the user has explicitly clicked PLACE BET this round
  const betPlacedRef = useRef(false);

  useEffect(() => { balanceRef.current = balance; }, [balance]);
  useEffect(() => { chipsRef.current = chips; }, [chips]);

  const balanceMountedRef = useRef(false);
  useEffect(() => {
    if (!balanceMountedRef.current) {
      balanceMountedRef.current = true;
      return;
    }
    syncBalance(balance);
  }, [balance, syncBalance]);

  useEffect(() => {
    const stop = startPolling();
    return stop;
  }, [startPolling]);

  // Register session on join, remove on leave
  useEffect(() => {
    if (!user || !table) return;
    const username = profile?.username ?? user.email?.split('@')[0] ?? 'Player';

    // Delete any stale session first, then insert fresh
    supabase.from('live_table_sessions')
      .delete()
      .match({ user_id: user.id, table_id: table.id })
      .then(() => {
        supabase.from('live_table_sessions')
          .insert({ table_id: table.id, user_id: user.id, username })
          .then(({ error }) => {
            if (error) console.error('[LiveTableRoom] session insert failed:', error.message, error.code);
          });
      });

    return () => {
      supabase.from('live_table_sessions')
        .delete()
        .match({ table_id: table.id, user_id: user.id })
        .then(() => {});
    };
  }, [user?.id, table?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync room phase with the shared live-table status so pause/resume is reflected immediately.
  useEffect(() => {
    if (!table) return;

    if (table.status === 'waiting') {
      setPhase('locked');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (nextRoundTimeoutRef.current) {
        clearTimeout(nextRoundTimeoutRef.current);
        nextRoundTimeoutRef.current = null;
      }
      return;
    }

    if (table.status === 'live') {
      if (phase === 'locked') {
        startBettingPhase();
      }
    }
  }, [table?.status, table?.id]);

  const gameType = (table?.gameType ?? 'roulette') as GameMode;
  const accentColor = { blackjack: '#00ff88', roulette: '#ff4466', baccarat: '#aa44ff', poker: '#ffaa00' }[gameType] ?? '#FFD700';
  const phaseLabel = { betting: 'Place Your Bets', locked: 'Bets Locked — Spinning…', result: result?.outcome ?? '' }[phase];
  const chipValues = table ? getTableChipValues(table.minBet, table.maxBet) : [1, 5, 10, 50, 100, 500];
  if (import.meta.env.DEV) console.log('[LiveTableRoom] chips:', chipValues, 'minBet:', table?.minBet, 'maxBet:', table?.maxBet);

  useEffect(() => {
    startBettingPhase();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function startBettingPhase() {
    if (table?.status !== 'live') return;
    // Reset everything for a fresh round
    betPlacedRef.current = false;
    chipsRef.current = 0;
    setChips(0);
    setBetInput('0');
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
    if (nextRoundTimeoutRef.current) {
      clearTimeout(nextRoundTimeoutRef.current);
      nextRoundTimeoutRef.current = null;
    }
    nextRoundTimeoutRef.current = setTimeout(() => {
      const bet = chipsRef.current;
      if (bet <= 0) {
        nextRoundTimeoutRef.current = setTimeout(startBettingPhase, 1000);
        return;
      }

      setLastBet(bet);
      const resolved = outcomeEngine.resolve({ gameMode: gameType, bet });
      setResult(resolved);
      setPhase('result');
      setSessionRTP(resolved.sessionRTP);

      const newBalance = Math.round((balanceRef.current - bet + resolved.payout) * 100) / 100;
      setBalance(Math.max(0, newBalance));

      const netChange = Math.round((resolved.payout - bet) * 100) / 100;
      const resultLabel = resolved.isPush
        ? `Tie — returned KES ${bet.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        : resolved.won
          ? `+KES ${netChange.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
          : `-KES ${bet.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

      setLog((prev) => [
        `${resolved.outcome} | Bet KES ${bet.toLocaleString('en-US', { minimumFractionDigits: 2 })} → ${resultLabel} | RTP ${resolved.sessionRTP}%`,
        ...prev.slice(0, 9),
      ]);

      nextRoundTimeoutRef.current = setTimeout(startBettingPhase, 5000);
    }, 2000);
  }

  function addChip(val: number) {
    if (phase !== 'betting') return;
    const newTotal = chipsRef.current + val;
    if (newTotal > balanceRef.current) return;
    if (table && newTotal > table.maxBet) return; // enforce max bet
    chipsRef.current = newTotal;
    setChips(newTotal);
    setBetInput(newTotal.toString());
  }

  function handlePlaceBet() {
    if (phase !== 'betting' || chipsRef.current <= 0) return;
    if (table?.status !== 'live') return;
    if (table && chipsRef.current < table.minBet) return; // enforce min bet
    if (timerRef.current) clearInterval(timerRef.current);
    betPlacedRef.current = true;
    resolveRound();
  }

  function clearBet() {
    if (phase === 'betting') {
      chipsRef.current = 0;
      setChips(0);
      setBetInput('0');
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
                    style={{ color: phase === 'result' ? (result?.isPush ? '#FFD700' : result?.won ? '#00ff88' : '#ff4466') : accentColor }}>
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
                KES {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Current bet (editable) */}
            <div className="rounded-xl px-4 py-3 flex items-center justify-between"
              style={{ background: `${accentColor}11`, border: `1px solid ${accentColor}33` }}>
              <span className="text-gray-400 text-xs font-orbitron tracking-widest">YOUR BET</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-300 text-sm">KES</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={betInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    // Allow typing and keep leading zero behavior natural
                    if (raw === '') {
                      setBetInput('');
                      chipsRef.current = 0;
                      setChips(0);
                      return;
                    }

                    const digitsOnly = raw.replace(/[^0-9]/g, '');
                    if (digitsOnly === '') {
                      setBetInput('0');
                      chipsRef.current = 0;
                      setChips(0);
                      return;
                    }

                    let v = Number(digitsOnly);
                    if (Number.isNaN(v)) v = 0;
                    if (v > balanceRef.current) v = balanceRef.current;
                    if (table && v > table.maxBet) v = table.maxBet;
                    if (v < 0) v = 0;

                    chipsRef.current = v;
                    setChips(v);
                    setBetInput(v.toString());
                  }}
                  onFocus={(e) => {
                    if (e.target.value === '0') {
                      setBetInput('');
                    }
                  }}
                  onBlur={() => {
                    if (betInput === '') {
                      setBetInput('0');
                    }
                  }}
                  className="w-32 py-1 px-3 rounded-md bg-black/60 border border-white/10 text-yellow-300 font-orbitron font-bold text-lg"
                  style={{ color: accentColor }}
                />
              </div>
            </div>

            {/* Chips */}
            <div>
              <p className="text-gray-500 text-[10px] font-orbitron tracking-widest mb-2">SELECT CHIPS</p>
              <div className="grid grid-cols-3 gap-2">
                {chipValues.map((val) => (
                  <button key={val} onClick={() => addChip(val)} disabled={phase !== 'betting'}
                    className="py-2 rounded-xl font-orbitron font-bold text-xs tracking-wider transition-all active:scale-95 disabled:opacity-30"
                    style={{ background: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44` }}>
                    KES {val.toLocaleString()}
                  </button>
                ))}
              </div>
              {table && (
                <p className="text-white/20 text-[10px] font-orbitron mt-2 text-center">
                  Min KES {table.minBet} · Max KES {table.maxBet.toLocaleString()}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1">
              {table && chips > 0 && chips < table.minBet && (
                <p className="text-yellow-400 text-[10px] font-orbitron text-center">
                  Min bet is KES {table.minBet}
                </p>
              )}
              <div className="flex gap-2">
                <button onClick={clearBet} disabled={phase !== 'betting' || chips === 0}
                  className="flex-1 py-2.5 rounded-xl font-orbitron text-xs tracking-widest text-gray-400 border border-white/10 hover:border-white/30 transition-colors disabled:opacity-30">
                  CLEAR
                </button>
                <button
                  onClick={handlePlaceBet}
                  disabled={phase !== 'betting' || chips === 0 || (!!table && chips < table.minBet)}
                  className="flex-1 py-2.5 rounded-xl font-orbitron font-bold text-xs tracking-widest text-black transition-all active:scale-95 disabled:opacity-30"
                  style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}99)`, boxShadow: `0 0 14px ${accentColor}55` }}>
                  PLACE BET
                </button>
              </div>
            </div>

            {/* Result banner */}
            <AnimatePresence>
              {phase === 'result' && result && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="rounded-xl px-4 py-4 text-center"
                  style={{
                    background: result.isPush ? 'rgba(255,255,255,0.08)' : result.won ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)',
                    border: `1px solid ${result.isPush ? '#FFD70044' : result.won ? '#00ff8844' : '#ff446644'}`,
                  }}>
                  <p className="font-orbitron font-bold text-lg" style={{ color: result.isPush ? '#FFD700' : result.won ? '#00ff88' : '#ff4466' }}>
                    {result.isBigWin ? '🎉 BIG WIN!' : result.isPush ? '🤝 PUSH' : result.won ? '✅ YOU WIN!' : '😔 YOU LOSE'}
                  </p>
                  <p className="text-white text-sm mt-1">{result.outcome}</p>
                  <p className="text-gray-400 text-xs">{result.detail}</p>
                  {result.isPush && (
                    <>
                      <p className="font-orbitron text-yellow-300 font-bold mt-1">
                        BET RETURNED
                      </p>
                      <p className="text-gray-500 text-xs">
                        Bet {lastBet} → Return {result.payout.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </>
                  )}
                  {result.won && !result.isPush && (
                    <>
                      <p className="font-orbitron text-yellow-300 font-bold mt-1">
                        +KES {(result.payout - lastBet).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-gray-500 text-xs">
                        Bet {lastBet} → Return {result.payout.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </>
                  )}
                  {!result.won && !result.isPush && (
                    <p className="font-orbitron text-red-400 font-bold mt-1">
                      -KES {lastBet.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  )}
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
                <span className="text-white">KES {table.minBet} – KES {table.maxBet.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
