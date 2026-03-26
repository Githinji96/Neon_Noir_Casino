import { useEffect } from 'react';
import ParticleBackground from '../components/ParticleBackground';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import HeroSection from './HeroSection';
import NewArrivalsSection from './NewArrivalsSection';
import ProgressiveJackpotsSection from './ProgressiveJackpotsSection';
import PopularChoicesSection from './PopularChoicesSection';
import JackpotWinToast from '../components/JackpotWinToast';
import { useJackpotStore } from '../store/jackpotStore';

interface CasinoLobbyProps {
  onNavigateToSlot: (id?: string, title?: string) => void;
}

export default function CasinoLobby({ onNavigateToSlot }: CasinoLobbyProps) {
  const subscribeToWinBroadcasts = useJackpotStore((s) => s.subscribeToWinBroadcasts);

  // Subscribe to jackpot win broadcasts on mount
  useEffect(() => {
    const unsubscribe = subscribeToWinBroadcasts();
    return unsubscribe;
  }, [subscribeToWinBroadcasts]);

  return (
    <div className="relative bg-black min-h-screen overflow-x-hidden">
      <ParticleBackground />
      <Navbar />
      <JackpotWinToast />

      <main className="bg-gradient-to-b from-casino-dark to-black min-h-screen pb-24 md:pb-0">
        <HeroSection onPlayNow={() => onNavigateToSlot()} />

        <NewArrivalsSection onGameClick={onNavigateToSlot} />
        <PopularChoicesSection onGameClick={onNavigateToSlot} />

        {/* Full-width so the scroll row isn't clipped by the max-width container */}
        <ProgressiveJackpotsSection onSpinNow={(id, title) => onNavigateToSlot(id, title)} />
      </main>

      <BottomNav
        activeTab="home"
        onTabChange={(tab) => {
          if (tab === 'spin') onNavigateToSlot();
        }}
      />
    </div>
  );
}
