import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import ParticleBackground from '../components/ParticleBackground';
import ProgressiveJackpotsSection from './ProgressiveJackpotsSection';
import JackpotWinModal from '../components/JackpotWinModal';
import { useJackpotStore } from '../store/jackpotStore';

export default function JackpotsPage() {
  const navigate = useNavigate();
  const pendingWin = useJackpotStore((s) => s.pendingWin);
  const clearPendingWin = useJackpotStore((s) => s.clearPendingWin);

  // Scroll to top on mount
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);

  const handleSpinNow = (gameId: string, gameTitle: string) => {
    navigate('/slot', { state: { id: gameId, title: gameTitle } });
  };

  return (
    <div className="relative bg-black min-h-screen">
      <ParticleBackground />
      <Navbar />

      <main className="pb-24 md:pb-8">
        {/* Page header */}
        <div className="px-4 sm:px-6 pt-8 sm:pt-10 pb-4">
          <h1
            className="font-orbitron font-bold text-2xl sm:text-4xl tracking-widest text-white uppercase"
            style={{ textShadow: '0 0 20px rgba(255,215,0,0.5)' }}
          >
            Progressive <span style={{ color: '#FFD700' }}>Jackpots</span>
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            Spin for a chance to win life-changing jackpots. Every bet contributes to the pool.
          </p>
        </div>

        <ProgressiveJackpotsSection onSpinNow={handleSpinNow} />
      </main>

      <BottomNav activeTab="home" onTabChange={(tab) => { if (tab === 'spin') navigate('/'); }} />

      {pendingWin && <JackpotWinModal win={pendingWin} onClose={clearPendingWin} />}
    </div>
  );
}
