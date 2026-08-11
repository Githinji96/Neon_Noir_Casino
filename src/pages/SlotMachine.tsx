import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import {
  playSpinSound,
  playReelStop,
  playWinSound,
  playFreeSpinsTrigger,
} from '../utils/audio';
import { fetchTracks, playMusic, pauseMusic, resumeMusic } from '../utils/jamendo';
import Navbar from '../components/Navbar';
import PaytableModal from '../components/PaytableModal';
import JackpotWinModal from '../components/JackpotWinModal';
import JackpotWinToast from '../components/JackpotWinToast';
import NearMissToast from '../components/NearMissToast';
import { useJackpotStore } from '../store/jackpotStore';
import FreeSpinsBanner from './SlotMachine/FreeSpinsBanner';
import WinDisplay from './SlotMachine/WinDisplay';
import SpinControls from './SlotMachine/SpinControls';
import BettingControls from './SlotMachine/BettingControls';
import GameCanvas from '../pixi/GameCanvas';

interface SlotMachinePageProps {
  onBack?: () => void;
}

export default function SlotMachinePage({ onBack }: SlotMachinePageProps) {
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const gameId      = (location.state as { id?: string; title?: string; jackpotMode?: boolean } | null)?.id ?? 'cyber-strike-777';
  const gameTitle   = (location.state as { id?: string; title?: string; jackpotMode?: boolean } | null)?.title ?? 'Cyber Strike 777';
  // Cyber Strike 777 always runs in jackpot mode (fixed KES 100 bet)
  const jackpotMode = gameId === 'cyber-strike-777' ? true : (location.state as { id?: string; title?: string; jackpotMode?: boolean } | null)?.jackpotMode ?? false;

  // If no onBack prop (navigated directly e.g. from jackpots page), go back in history or to lobby
  const handleBack = onBack ?? (() => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  });

  const isSpinning = useGameStore((s) => s.isSpinning);
  const winResults = useGameStore((s) => s.winResults);
  const turboMode = useGameStore((s) => s.turboMode);
  const autoplay = useGameStore((s) => s.autoplay);
  const balance = useGameStore((s) => s.balance);
  const isPaytableOpen = useGameStore((s) => s.isPaytableOpen);
  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const musicEnabled = useSettingsStore((s) => s.settings.musicEnabled);
  const animationSpeed = useSettingsStore((s) => s.settings.animationSpeed);
  const autoSpinCount = useSettingsStore((s) => s.settings.autoSpinCount);
  const stopOnWin = useSettingsStore((s) => s.settings.stopOnWin);
  const triggerFreeSpins = useGameStore((s) => s.triggerFreeSpins);
  const spin = useGameStore((s) => s.spin);
  const setSpinning = useGameStore((s) => s.setSpinning);
  const openPaytable = useGameStore((s) => s.openPaytable);
  const closePaytable = useGameStore((s) => s.closePaytable);
  const setGame = useGameStore((s) => s.setGame);

  const { syncBalance, recordWin } = useAuthStore();
  const pendingJackpotWin = useJackpotStore((s) => s.pendingWin);
  const clearPendingWin = useJackpotStore((s) => s.clearPendingWin);

  const prevSpinning = useRef(false);

  // Start music only when page is ready AND sound is enabled.
  // stopMusic on cleanup ensures music stops when leaving the slot page.
  useEffect(() => {
    if (loading) return;

    if (soundEnabled && musicEnabled) {
      // Use default global genres (hip-hop / RnB). Preload tracks then start when ready.
      fetchTracks(undefined, 10).then(() => {
        if (soundEnabled && musicEnabled) playMusic(0.3);
      });
    }

    return () => {
      pauseMusic(); // pause when leaving the slot page, keep tracks cached
    };
  }, [loading, soundEnabled, musicEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Respond to sound toggle AFTER mount:
  // - turning OFF → pause music
  // - turning ON  → resume/start music
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    if (soundEnabled) {
      resumeMusic();
    } else {
      pauseMusic();
    }
  }, [soundEnabled]);

  const turboRef = useRef(turboMode);
  useEffect(() => { turboRef.current = turboMode; }, [turboMode]);
  useEffect(() => {
    if (!soundEnabled) return;
    if (isSpinning && !prevSpinning.current) {
      playSpinSound();
      [0, 150, 300, 450, 600].forEach((delay) =>
        playReelStop(delay + (turboRef.current ? 300 : 1000))
      );
    }
    prevSpinning.current = isSpinning;
  }, [isSpinning, soundEnabled]); // turboMode intentionally excluded via ref

  // Win sound when spin ends with wins
  useEffect(() => {
    if (isSpinning || winResults.length === 0 || !soundEnabled) return;
    playWinSound(winResults.length >= 3);
  }, [isSpinning, winResults, soundEnabled]);

  // Sync balance + record wins to Supabase after each spin
  // Only sync on session boundaries (tab hidden, unmount) — not every spin.
  // This eliminates ~3,300 writes/sec at 10K concurrent users.
  const pendingSync = useRef(false);

  useEffect(() => {
    if (isSpinning) return;
    pendingSync.current = true; // mark dirty — sync on next visibility change or unmount
  }, [balance]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync on unmount and tab-hide
  useEffect(() => {
    const flush = () => {
      if (!pendingSync.current) return;
      pendingSync.current = false;
      const snap = useGameStore.getState().balance;
      const lastWin = useGameStore.getState().lastWin;
      syncBalance(snap);
      if (lastWin > 0) recordWin(lastWin, gameTitle);
    };
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      flush(); // sync on unmount (navigation away)
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Free spins fanfare
  useEffect(() => {
    if (triggerFreeSpins && soundEnabled) playFreeSpinsTrigger();
  }, [triggerFreeSpins, soundEnabled]);

  // 1-second loading state on mount — also sets the active game symbol set
  useEffect(() => {
    setGame(gameId, jackpotMode);
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, [gameId, jackpotMode]);

  // Spin animation timing: set isSpinning=false after animation completes
  useEffect(() => {
    if (!isSpinning) return;
    // Use ref to avoid stale closure on turboMode; animationSpeed is captured fresh
    const duration = turboRef.current ? 450
      : animationSpeed === 'slow' ? 2400
      : animationSpeed === 'fast' ? 900
      : 1600;
    const timer = setTimeout(() => setSpinning(false), duration);
    return () => clearTimeout(timer);
  }, [isSpinning]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autoplay loop: triggers next spin after current spin ends.
  // Respects autoSpinCount (from settings) and stopOnWin.
  const autoplayArmed = useRef(false);
  const autoSpinsDone = useRef(0);
  useEffect(() => {
    if (!autoplay) {
      autoplayArmed.current = false;
      autoSpinsDone.current = 0;
      return;
    }
    // A spin just finished while autoplay is on
    if (!isSpinning && autoplayArmed.current) {
      // Check stop-on-win: if last spin had wins, stop autoplay
      if (stopOnWin && winResults.length > 0) {
        useGameStore.setState({ autoplay: false });
        autoplayArmed.current = false;
        autoSpinsDone.current = 0;
        return;
      }

      // Check spin count limit
      autoSpinsDone.current += 1;
      if (autoSpinsDone.current >= autoSpinCount) {
        useGameStore.setState({ autoplay: false });
        autoplayArmed.current = false;
        autoSpinsDone.current = 0;
        return;
      }

      // Fire next spin
      const delay = turboRef.current ? 80 : animationSpeed === 'slow' ? 800 : animationSpeed === 'fast' ? 200 : 500;
      const timer = setTimeout(() => spin(), delay);
      return () => clearTimeout(timer);
    }
    // Spin started → arm for the next completion
    if (isSpinning) {
      autoplayArmed.current = true;
    }
  }, [isSpinning, autoplay]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-4 border-yellow-300 border-t-transparent animate-spin" />
          <span className="font-orbitron text-yellow-300 tracking-widest text-sm">LOADING...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="slot-page-root bg-gray-950 flex flex-col" style={{ height: '100dvh', overflow: 'hidden' }}>
      <Navbar compact />

      <main
        className="flex-1 min-h-0 w-full max-w-2xl mx-auto px-4 flex flex-col overflow-hidden"
      >
        {/* ── Header: ← LOBBY left, TITLE centered ── */}
        <div className="relative flex items-center justify-center pt-2 pb-1.5 shrink-0">
          <button
            onClick={handleBack}
            className="absolute left-0 font-orbitron text-sm text-gray-400 hover:text-white tracking-widest transition-colors"
          >
            ← LOBBY
          </button>
          <div className="flex items-center gap-1.5">
            <h1
              className="font-orbitron text-lg sm:text-2xl font-bold text-yellow-300 tracking-widest"
              style={{ textShadow: '0 0 12px rgba(253,224,71,0.7)' }}
            >
              {gameTitle.toUpperCase()}
            </h1>
            {jackpotMode && (
              <span
                className="px-1.5 py-0.5 rounded-full font-orbitron text-[9px] font-bold animate-pulse shrink-0"
                style={{ background: 'rgba(255,215,0,0.2)', border: '1px solid rgba(255,215,0,0.5)', color: '#FFD700' }}
              >
                💰 JACKPOT
              </span>
            )}
          </div>
        </div>

        {/* ── Balance / payout panel ── */}
        <div className="shrink-0 mt-1">
          <WinDisplay />
        </div>

        {/* ── FreeSpins banner (conditional, sits between balance and reels) ── */}
        <FreeSpinsBanner />

        {/* ── Reel canvas — tight below balance panel ── */}
        <div className="w-full flex justify-center mt-2 shrink-0">
          <GameCanvas
            gameId={gameId}
            animationSpeed={animationSpeed}
            onSpinComplete={() => {
              if (winResults.length > 0 && soundEnabled) {
                playWinSound(winResults.length >= 3);
              }
            }}
          />
        </div>

        {/* ── Controls packed immediately below reels ── */}
        <div className="flex flex-col items-center mt-3 shrink-0">
          <SpinControls />
          <BettingControls />
          <button
            onClick={openPaytable}
            className="px-6 py-1.5 rounded-full border border-white/20 text-gray-400 font-orbitron text-xs hover:text-white hover:border-white/40 transition-colors mt-2"
          >
            PAYTABLE
          </button>
          {balance === 0 && (
            <p className="font-orbitron text-red-400 text-[10px] tracking-widest mt-1">NO FUNDS</p>
          )}
        </div>

        {/* ── Spacer — absorbs leftover height on tall screens ── */}
        <div className="flex-1" />
      </main>

      <PaytableModal isOpen={isPaytableOpen} onClose={closePaytable} />
      <JackpotWinToast />
      <NearMissToast />
      {pendingJackpotWin && (
        <JackpotWinModal win={pendingJackpotWin} onClose={clearPendingWin} />
      )}
    </div>
  );
}
