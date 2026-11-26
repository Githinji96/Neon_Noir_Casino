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

  useEffect(() => {
    const stopGrowth = startRealTimeGrowth();
    return stopGrowth;
  }, []);

  return (
    <section className="pt-6 pb-2">
      <div className="px-3 sm:px-4 md:px-6 mb-4">
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
                🏆 {recentWinner.jackpotName}: KES {recentWinner.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="px-3 sm:px-4 md:px-6 pb-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 sm:gap-3 w-full">
          {jackpots.map((jackpot) => (
            <JackpotCard
              key={jackpot.id}
              name={jackpot.name}
              gameTitle={jackpot.gameTitle}
              amount={jackpot.currentAmount}
              type={jackpot.type}
              tags={jackpot.tags}
              state={jackpot.state}
              progressPct={jackpot.progressPct}
              minimumThreshold={jackpot.minimumThreshold}
              contributionRate={jackpot.contributionRate}
              onSpinNow={() => onSpinNow(jackpot.gameId, jackpot.name)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
