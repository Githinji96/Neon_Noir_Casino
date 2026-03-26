import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import JackpotCard from '../components/JackpotCard';
import { useJackpotStore } from '../store/jackpotStore';

interface ProgressiveJackpotsSectionProps {
  onSpinNow: (gameId: string, gameTitle: string) => void;
}

export default function ProgressiveJackpotsSection({ onSpinNow }: ProgressiveJackpotsSectionProps) {
  const jackpots = useJackpotStore((s) => s.jackpots);
  const recentWinner = useJackpotStore((s) => s.recentWinner);
  const startRealTimeGrowth = useJackpotStore((s) => s.startRealTimeGrowth);
  const syncFromSupabase = useJackpotStore((s) => s.syncFromSupabase);

  useEffect(() => {
    syncFromSupabase();
    const stop = startRealTimeGrowth();
    return stop;
  }, []);

  return (
    <section className="py-8">
      <div className="px-6 md:px-10 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-orbitron font-bold text-xl tracking-widest text-white uppercase">
              Progressive Jackpots
            </h2>
            <div className="mt-2 h-0.5 w-16 bg-neon-yellow" style={{ boxShadow: '0 0 8px #FFD700' }} />
          </div>
          <AnimatePresence>
            {recentWinner && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-orbitron"
                style={{
                  background: 'rgba(255,215,0,0.1)',
                  border: '1px solid rgba(255,215,0,0.3)',
                  color: '#FFD700',
                }}
              >
                🏆 Last win: ${recentWinner.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })} on {recentWinner.jackpotName}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 px-6 md:px-10 pb-4">
        {jackpots.map((jackpot) => (
          <JackpotCard
            key={jackpot.id}
            name={jackpot.name}
            amount={jackpot.currentAmount}
            tags={jackpot.tags}
            onSpinNow={() => onSpinNow(jackpot.gameId, jackpot.gameTitle)}
          />
        ))}
      </div>
    </section>
  );
}
