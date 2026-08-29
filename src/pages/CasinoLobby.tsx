import { useEffect, useRef } from 'react';
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
  onNavigateToSlot: (id?: string, title?: string, jackpotMode?: boolean) => void;
}

export default function CasinoLobby({ onNavigateToSlot }: CasinoLobbyProps) {
  const subscribeToWinBroadcasts = useJackpotStore((s) => s.subscribeToWinBroadcasts);
  // ref points at the PopularChoicesSection DOM node
  const popularRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeToWinBroadcasts();
    return unsubscribe;
  }, [subscribeToWinBroadcasts]);

  function handleSeeAll() {
    if (!popularRef.current) return;
    // Offset for the sticky navbar (~48px)
    const top = popularRef.current.getBoundingClientRect().top + window.scrollY - 56;
    window.scrollTo({ top, behavior: 'smooth' });
    // Trigger the brief heading glow on arrival
    setTimeout(() => {
      (popularRef as unknown as React.MutableRefObject<{ highlight?: () => void }>)
        .current?.highlight?.();
    }, 600);
  }

  return (
    <div className="relative bg-black min-h-screen">
      <ParticleBackground />
      <Navbar />
      <JackpotWinToast />

      <main className="bg-gradient-to-b from-casino-dark to-black pb-24 md:pb-0">
        <HeroSection onPlayNow={() => onNavigateToSlot()} />

        <NewArrivalsSection onGameClick={onNavigateToSlot} onSeeAll={handleSeeAll} />
        <PopularChoicesSection onGameClick={onNavigateToSlot} sectionRef={popularRef} />

        <ProgressiveJackpotsSection onSpinNow={(id, title) => onNavigateToSlot(id, title, true)} />
      </main>

      <BottomNav />
    </div>
  );
}
