import ParticleBackground from '../components/ParticleBackground';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import HeroSection from './HeroSection';
import NewArrivalsSection from './NewArrivalsSection';
import ProgressiveJackpotsSection from './ProgressiveJackpotsSection';
import PopularChoicesSection from './PopularChoicesSection';

interface CasinoLobbyProps {
  onNavigateToSlot: (id?: string, title?: string) => void;
}

export default function CasinoLobby({ onNavigateToSlot }: CasinoLobbyProps) {
  return (
    <div className="relative bg-black min-h-screen">
      <ParticleBackground />
      <Navbar />

      <main className="bg-gradient-to-b from-casino-dark to-black min-h-screen pb-24 md:pb-0">
        <HeroSection onPlayNow={() => onNavigateToSlot()} />

        <div className="max-w-7xl mx-auto">
          <NewArrivalsSection onGameClick={onNavigateToSlot} />
          <PopularChoicesSection onGameClick={onNavigateToSlot} />
        </div>

        {/* Full-width so the scroll row isn't clipped by the max-width container */}
        <ProgressiveJackpotsSection onSpinNow={() => onNavigateToSlot()} />
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
