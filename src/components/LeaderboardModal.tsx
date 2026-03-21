import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, type LeaderboardEntry } from '../lib/supabase';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LeaderboardModal({ isOpen, onClose }: LeaderboardModalProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    supabase
      .from('leaderboard')
      .select('*')
      .order('win_amount', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setEntries(data ?? []);
        setLoading(false);
      });
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-lg bg-gray-900 border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[80vh] flex flex-col"
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-orbitron text-xl font-bold text-yellow-300 tracking-widest">
                🏆 LEADERBOARD
              </h2>
              <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-xl">✕</button>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-yellow-300 border-t-transparent animate-spin" />
              </div>
            ) : entries.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-8">No wins recorded yet. Be the first!</p>
            ) : (
              <div className="overflow-y-auto flex-1 flex flex-col gap-2">
                {entries.map((entry, i) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 bg-black/30 rounded-xl px-4 py-3 border border-white/5"
                  >
                    <span className={`font-orbitron text-sm font-bold w-6 text-center ${
                      i === 0 ? 'text-yellow-300' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-gray-500'
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-orbitron text-xs text-white font-semibold truncate">{entry.username}</p>
                      <p className="text-gray-500 text-xs truncate">{entry.game_title}</p>
                    </div>
                    <span className="font-orbitron text-sm font-bold text-green-400">
                      ${entry.win_amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
