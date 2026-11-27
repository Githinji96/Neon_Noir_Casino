import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import ParticleBackground from '../components/ParticleBackground';
import NeonFlareBackground from '../components/NeonFlareBackground';
import ProgressiveJackpotsSection from './ProgressiveJackpotsSection';
import JackpotWinModal from '../components/JackpotWinModal';
import { useJackpotStore } from '../store/jackpotStore';
import MiniJackpotGamesSection from '../components/miniGames/MiniJackpotGamesSection';
import { useMiniGameStore } from '../store/miniGameStore';


export default function JackpotsPage() {
  const navigate = useNavigate();
  const pendingWin = useJackpotStore((s) => s.pendingWin);
  const clearPendingWin = useJackpotStore((s) => s.clearPendingWin);

  // Pre-fetch mini game configs as soon as the page starts mounting —
  // this runs before MiniJackpotGamesSection renders so the "Loading configs…"
  // spinner is gone by the time the section appears.
  const loadConfigs = useMiniGameStore((s) => s.loadConfigs);
  useEffect(() => { void loadConfigs(); }, [loadConfigs]);

  // Scroll to top on mount
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);

  const handleSpinNow = (gameId: string, gameTitle: string) => {
    navigate('/slot', { state: { id: gameId, title: gameTitle, jackpotMode: true } });
  };

  return (
    <div className="relative bg-black min-h-screen overflow-x-hidden">
      <ParticleBackground />
      <NeonFlareBackground />
      <Navbar />
      <main className="pb-24 md:pb-8">
        {/* Page header */}
        <div className="px-3 sm:px-4 md:px-6 pt-6 pb-4">
          <h1
            className="font-orbitron font-bold text-2xl tracking-widest text-white uppercase"
            style={{ textShadow: '0 0 20px rgba(255,215,0,0.5)' }}
          >
            Progressive <span style={{ color: '#FFD700' }}>Jackpots</span>
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            Spin for a chance to win life-changing jackpots. Every bet contributes to the pool.
          </p>
        </div>

        <ProgressiveJackpotsSection onSpinNow={handleSpinNow} />
        <MiniJackpotGamesSection />
      </main>

      <BottomNav />

      {pendingWin && <JackpotWinModal win={pendingWin} onClose={clearPendingWin} />}
    </div>
  );
}
