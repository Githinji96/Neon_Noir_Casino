import { useEffect, useState } from 'react';
import { useMiniGameStore } from '../../store/miniGameStore';
import { useAuthStore } from '../../store/authStore';
import MiniGameCard from './MiniGameCard';
import MiniGameModal from './MiniGameModal';
import AuthModal from '../AuthModal';
import type { MiniGameId } from '../../types/miniGames';

const ALL_GAME_IDS: MiniGameId[] = [
  'lucky-wheel',
  'scratch-cards',
  'treasure-chest',
  'mini-slot',
  'mystery-multiplier',
  'crystal-match',
];

export default function MiniJackpotGamesSection() {
  const loadConfigs              = useMiniGameStore((s) => s.loadConfigs);
  const subscribeToConfigUpdates = useMiniGameStore((s) => s.subscribeToConfigUpdates);
  const configs                  = useMiniGameStore((s) => s.configs);
  const configErrors             = useMiniGameStore((s) => s.configErrors);
  const configLoading            = useMiniGameStore((s) => s.configLoading);
  const openGame                 = useMiniGameStore((s) => s.openGame);
  const user                     = useAuthStore((s) => s.user);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingGame, setPendingGame]     = useState<MiniGameId | null>(null);

  const handlePlay = (gameId: MiniGameId) => {
    if (!user) { setPendingGame(gameId); setAuthModalOpen(true); return; }
    openGame(gameId);
  };

  const handleAuthSuccess = () => {
    setAuthModalOpen(false);
    if (pendingGame) { openGame(pendingGame); setPendingGame(null); }
  };

  useEffect(() => {
    void loadConfigs();
    const unsub = subscribeToConfigUpdates();
    return unsub;
  }, [loadConfigs, subscribeToConfigUpdates]);

  return (
    <section className="pt-4 pb-8 w-full overflow-hidden" aria-label="Mini Jackpot Games">

      <div className="px-3 sm:px-4 md:px-6 mb-3">
        <h2 className="font-orbitron font-bold text-xl tracking-widest text-white uppercase">
          Mini Jackpot Games
        </h2>
        <div className="mt-2 h-0.5 w-16 bg-neon-yellow" style={{ boxShadow: '0 0 8px #FFD700' }} />
        <p className="text-gray-400 text-sm mt-2">Quick games. Instant reveals. Exciting prizes.</p>
      </div>

      {configLoading && (
        <div className="flex items-center gap-2 px-4 sm:px-6 mb-3">
          <div className="w-4 h-4 rounded-full border-2 border-purple-500 border-t-transparent animate-spin shrink-0" />
          <span className="font-orbitron text-[10px] uppercase tracking-wider" style={{ color: 'rgba(156,163,175,0.5)' }}>
            Loading…
          </span>
        </div>
      )}

      {/* Grid: 2 cols mobile → 3 cols tablet → 6 cols desktop, always fills width */}
      <div className="px-3 sm:px-4 md:px-6 pb-4" style={{ overflow: 'hidden' }}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3 w-full">
          {ALL_GAME_IDS.map((gameId) => (
            <MiniGameCard
              key={gameId}
              gameId={gameId}
              config={configs[gameId]}
              configError={configErrors[gameId]}
              onPlay={handlePlay}
            />
          ))}
        </div>
      </div>

      <MiniGameModal />
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => { setAuthModalOpen(false); setPendingGame(null); }}
        onSuccess={handleAuthSuccess}
      />
    </section>
  );
}
