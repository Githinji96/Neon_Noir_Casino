import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import {
  playSpinSound,
  playReelStop,
  playWinSound,
  playFreeSpinsTrigger,
} from '../utils/audio';
import { fetchTracks, playMusic, pauseMusic, resumeMusic } from '../utils/jamendo';
import Navbar from '../components/Navbar';
import PaytableModal from '../components/PaytableModal';
import FreeSpinsBanner from './SlotMachine/FreeSpinsBanner';
import WinDisplay from './SlotMachine/WinDisplay';
import ReelGrid from './SlotMachine/ReelGrid';
import SpinControls from './SlotMachine/SpinControls';
import BettingControls from './SlotMachine/BettingControls';

interface SlotMachinePageProps {
  onBack?: () => void;
}

export default function SlotMachinePage({ onBack }: SlotMachinePageProps) {
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const gameTitle = (location.state as { title?: string } | null)?.title ?? 'Cyber Strike 777';

  const reels = useGameStore((s) => s.reels);
  const isSpinning = useGameStore((s) => s.isSpinning);
  const winResults = useGameStore((s) => s.winResults);
  const turboMode = useGameStore((s) => s.turboMode);
  const autoplay = useGameStore((s) => s.autoplay);
  const balance = useGameStore((s) => s.balance);
  const isPaytableOpen = useGameStore((s) => s.isPaytableOpen);
  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const triggerFreeSpins = useGameStore((s) => s.triggerFreeSpins);
  const spin = useGameStore((s) => s.spin);
  const setSpinning = useGameStore((s) => s.setSpinning);
  const openPaytable = useGameStore((s) => s.openPaytable);
  const closePaytable = useGameStore((s) => s.closePaytable);

  const { syncBalance, recordWin } = useAuthStore();

  const prevSpinning = useRef(false);

  // Start music only when page is ready AND sound is enabled.
  // stopMusic on cleanup ensures music stops when leaving the slot page.
  useEffect(() => {
    if (loading) return;
    fetchTracks('whistling', 10).then(() => {
      if (soundEnabled) playMusic(0.3);
    });
    return () => {
      pauseMusic(); // pause when leaving the slot page, keep tracks cached
    };
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

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
  useEffect(() => {
    if (isSpinning) return;
    syncBalance(balance);
    const lastWin = useGameStore.getState().lastWin;
    if (lastWin > 0) recordWin(lastWin, gameTitle);
  }, [isSpinning]);

  // Free spins fanfare
  useEffect(() => {
    if (triggerFreeSpins && soundEnabled) playFreeSpinsTrigger();
  }, [triggerFreeSpins, soundEnabled]);

  // 1-second loading state on mount
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Spin animation timing: set isSpinning=false after animation completes
  useEffect(() => {
    if (!isSpinning) return;
    // Use ref to avoid stale closure on turboMode
    const duration = turboRef.current ? 450 : 1600;
    const timer = setTimeout(() => setSpinning(false), duration);
    return () => clearTimeout(timer);
  }, [isSpinning]);

  // Autoplay loop: trigger next spin after current spin ends.
  // autoplayArmed ensures we don't fire immediately on toggle — only after
  // a spin has actually completed while autoplay is active.
  const autoplayArmed = useRef(false);
  useEffect(() => {
    if (!autoplay) {
      autoplayArmed.current = false;
      return;
    }
    // A spin just finished while autoplay is on → fire next spin
    if (!isSpinning && autoplayArmed.current) {
      const delay = turboRef.current ? 80 : 500;
      const timer = setTimeout(() => spin(), delay);
      return () => clearTimeout(timer);
    }
    // Spin started → arm for the next completion
    if (isSpinning) {
      autoplayArmed.current = true;
    }
  }, [isSpinning, autoplay]);

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
    <div className="min-h-screen bg-gray-950">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Back button */}
        <button
          onClick={onBack}
          className="mb-4 font-orbitron text-xs text-gray-400 hover:text-white tracking-widest transition-colors"
        >
          ← LOBBY
        </button>

        {/* Game title */}
        <h1
          className="font-orbitron text-3xl font-bold text-yellow-300 tracking-widest text-center mb-6"
          style={{ textShadow: '0 0 12px rgba(253,224,71,0.7)' }}
        >
          {gameTitle.toUpperCase()}
        </h1>

        <div className="flex flex-col items-center gap-4">
          <FreeSpinsBanner />
          <WinDisplay />
          <ReelGrid
            reels={reels}
            isSpinning={isSpinning}
            winResults={winResults}
            turboMode={turboMode}
          />
          <SpinControls />
          <BettingControls />

          {/* Paytable button */}
          <button
            onClick={openPaytable}
            className="mt-2 px-6 py-2 rounded-full font-orbitron text-xs tracking-widest border border-white/20 text-gray-400 hover:text-white hover:border-white/40 transition-colors"
          >
            PAYTABLE
          </button>

          {/* No funds message */}
          {balance === 0 && (
            <p className="font-orbitron text-red-400 text-sm tracking-widest text-center mt-2">
              NO FUNDS
            </p>
          )}
        </div>
      </main>

      <PaytableModal isOpen={isPaytableOpen} onClose={closePaytable} />
    </div>
  );
}
