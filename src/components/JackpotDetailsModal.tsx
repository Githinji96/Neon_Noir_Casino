import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { JACKPOT_CONFIGS } from '../logic/jackpot/jackpotConfig';
import { useJackpotStore } from '../store/jackpotStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onPlayNow: () => void;
}

interface RecentWinner {
  username: string;
  amount: number;
  created_at: string;
}

const MEGA = JACKPOT_CONFIGS.find((c) => c.id === 'mega-moolah-noir')!;

export default function JackpotDetailsModal({ isOpen, onClose, onPlayNow }: Props) {
  const jackpots = useJackpotStore((s) => s.jackpots);
  const megaJackpot = jackpots.find((j) => j.id === 'mega-moolah-noir');
  const currentAmount = megaJackpot?.currentAmount ?? MEGA.baseAmount;

  const [recentWinners, setRecentWinners] = useState<RecentWinner[]>([]);
  const [loadingWinners, setLoadingWinners] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingWinners(true);
    supabase
      .from('jackpot_wins')
      .select('amount, created_at, profiles(username)')
      .eq('jackpot_id', 'mega-moolah-noir')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        const winners = (data ?? []).map((row: any) => ({
          username: row.profiles?.username ?? 'Anonymous',
          amount: row.amount,
          created_at: row.created_at,
        }));
        setRecentWinners(winners);
        setLoadingWinners(false);
      });
  }, [isOpen]);

  const triggerOdds = Math.round(1 / MEGA.baseProbability).toLocaleString();
  const maxOdds = Math.round(1 / MEGA.maxProbability).toLocaleString();
  const contributionPct = (MEGA.contributionRate * 100).toFixed(0);
  const maxAmountFmt = MEGA.maxAmount.toLocaleString('en-US', { minimumFractionDigits: 0 });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl"
            style={{
              background: 'linear-gradient(160deg, #0d0020 0%, #050010 100%)',
              border: '1px solid rgba(255,215,0,0.3)',
              boxShadow: '0 0 60px rgba(255,215,0,0.2), 0 0 120px rgba(128,0,255,0.1)',
            }}
            initial={{ scale: 0.9, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            {/* Header */}
            <div className="relative px-6 pt-6 pb-4 border-b border-white/10">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/40 hover:text-white text-2xl leading-none transition-colors"
              >
                ×
              </button>
              <p className="text-white/40 text-xs font-orbitron tracking-[0.3em] uppercase mb-1">Progressive</p>
              <h2 className="font-orbitron font-black text-2xl text-[#FFD700]"
                style={{ textShadow: '0 0 16px rgba(255,215,0,0.6)' }}>
                MEGA MOOLAH NOIR
              </h2>
              <p className="text-white/50 text-sm mt-1">The biggest jackpot in Neon Noir Casino</p>
            </div>

            {/* Current pool */}
            <div className="px-6 py-5 border-b border-white/10 text-center">
              <p className="text-white/40 text-xs font-orbitron tracking-widest uppercase mb-2">Current Pool</p>
              <motion.p
                className="font-orbitron font-black text-4xl"
                style={{
                  color: '#FFD700',
                  textShadow: '0 0 20px rgba(255,215,0,0.9), 0 0 40px rgba(255,165,0,0.5)',
                }}
                animate={{ textShadow: [
                  '0 0 16px rgba(255,215,0,0.7), 0 0 32px rgba(255,165,0,0.3)',
                  '0 0 28px rgba(255,215,0,1),   0 0 56px rgba(255,165,0,0.6)',
                  '0 0 16px rgba(255,215,0,0.7), 0 0 32px rgba(255,165,0,0.3)',
                ]}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                KES {currentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </motion.p>
              <p className="text-white/30 text-xs mt-2">Growing with every spin across all games</p>
            </div>

            {/* Stats grid */}
            <div className="px-6 py-5 grid grid-cols-2 gap-3 border-b border-white/10">
              {[
                { label: 'Base Amount', value: `KES ${MEGA.baseAmount.toLocaleString()}` },
                { label: 'Max Pool Cap', value: `KES ${maxAmountFmt}` },
                { label: 'Contribution Rate', value: `${contributionPct}% per bet` },
                { label: 'Base Trigger Odds', value: `1 in ${triggerOdds}` },
                { label: 'Max Trigger Odds', value: `1 in ${maxOdds} (at cap)` },
                { label: 'Cooldown After Win', value: '1 hour' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/5 rounded-xl p-3">
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-white font-semibold text-sm">{value}</p>
                </div>
              ))}
            </div>

            {/* How it works */}
            <div className="px-6 py-5 border-b border-white/10">
              <h3 className="text-white/60 text-xs font-orbitron tracking-widest uppercase mb-3">How It Works</h3>
              <ul className="space-y-2 text-sm text-white/60">
                <li className="flex gap-2"><span className="text-[#FFD700]">→</span> Every spin contributes {contributionPct}% of your bet to the pool</li>
                <li className="flex gap-2"><span className="text-[#FFD700]">→</span> Each spin has a small random chance to trigger the jackpot</li>
                <li className="flex gap-2"><span className="text-[#FFD700]">→</span> Larger pool = higher trigger probability (up to {(MEGA.maxProbability * 100).toFixed(3)}%)</li>
                <li className="flex gap-2"><span className="text-[#FFD700]">→</span> Win is determined by cryptographically secure RNG — never forced</li>
                <li className="flex gap-2"><span className="text-[#FFD700]">→</span> On win, pool resets to KES {MEGA.seedAmount.toLocaleString()} seed amount</li>
              </ul>
            </div>

            {/* Recent winners */}
            <div className="px-6 py-5 border-b border-white/10">
              <h3 className="text-white/60 text-xs font-orbitron tracking-widest uppercase mb-3">Recent Winners</h3>
              {loadingWinners ? (
                <p className="text-white/30 text-sm">Loading...</p>
              ) : recentWinners.length === 0 ? (
                <p className="text-white/30 text-sm">No winners yet — be the first!</p>
              ) : (
                <div className="space-y-2">
                  {recentWinners.map((w, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[#FFD700] text-sm">🏆</span>
                        <span className="text-white text-sm font-semibold">{w.username}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-[#FFD700] font-mono text-sm font-bold">
                          KES {Number(w.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-white/30 text-xs">
                          {new Date(w.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="px-6 py-5 flex gap-3">
              <button
                onClick={() => { onClose(); onPlayNow(); }}
                className="flex-1 py-3 rounded-xl font-orbitron font-bold text-sm tracking-widest text-black transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                  boxShadow: '0 0 20px rgba(255,215,0,0.5)',
                }}
              >
                PLAY NOW
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 rounded-xl font-orbitron font-bold text-sm tracking-widest text-white/60 border border-white/20 hover:border-white/40 hover:text-white transition-colors"
              >
                CLOSE
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
