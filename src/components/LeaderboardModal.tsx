import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import {
  type LeaderboardEntry,
  type LeaderboardGameType,
  buildPlayerPool,
  sampleLeaderboard,
  generateFeedEntry,
  formatTimeAgo,
  formatAmount,
} from '../lib/leaderboardGenerator';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VISIBLE_COUNT = 30;
const UPDATE_INTERVAL_MS = 20000; // 20s
const FEED_INTERVAL_MS = 8000;    // 8s

export default function LeaderboardModal({ isOpen, onClose }: LeaderboardModalProps) {
  const { user, profile } = useAuthStore();
  const balance = useGameStore((s) => s.balance);

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [feed, setFeed] = useState<LeaderboardEntry[]>([]);
  const [tab, setTab] = useState<'board' | 'feed'>('board');
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const poolBuilt = useRef(false);

  // Build pool once
  useEffect(() => {
    if (!poolBuilt.current) {
      buildPlayerPool(1000);
      poolBuilt.current = true;
    }
  }, []);

  // Build real player entry if logged in
  function getRealEntry(): LeaderboardEntry | null {
    if (!user || !profile?.username) return null;
    return {
      id: user.id,
      username: profile.username,
      country: 'Kenya',
      countryFlag: '🇰🇪',
      game: 'Cyber Strike 777',
      gameType: 'slot',
      amount: balance,
      timestamp: Date.now() - 30000,
      avatar: '🎯',
      isRealPlayer: true,
      userId: user.id,
    };
  }

  function refresh(animate = false) {
    const real = getRealEntry();
    const realList = real && real.amount > 0 ? [real] : [];
    const next = sampleLeaderboard(VISIBLE_COUNT, [], realList);

    if (animate) {
      const prev = entries.map((e) => e.id);
      const fresh = next.filter((e) => !prev.includes(e.id)).map((e) => e.id);
      setNewIds(new Set(fresh));
      setTimeout(() => setNewIds(new Set()), 2000);
    }
    setEntries(next);
  }

  // Initial load
  useEffect(() => {
    if (isOpen) {
      refresh();
      setFeed([]);
    }
  }, [isOpen]);

  // Auto-update leaderboard
  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => refresh(true), UPDATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isOpen, balance, profile?.username]);

  // Live feed updates
  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => {
      const entry = generateFeedEntry();
      setFeed((prev) => [entry, ...prev.slice(0, 49)]);
    }, FEED_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isOpen]);

  // Update timestamps every 15s
  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => setEntries((prev) => [...prev]), 15000);
    return () => clearInterval(id);
  }, [isOpen]);

  function rankColor(i: number) {
    if (i === 0) return 'text-yellow-300';
    if (i === 1) return 'text-gray-300';
    if (i === 2) return 'text-orange-400';
    return 'text-white/30';
  }

  function rankBg(i: number) {
    if (i === 0) return 'rgba(255,215,0,0.08)';
    if (i === 1) return 'rgba(192,192,192,0.06)';
    if (i === 2) return 'rgba(205,127,50,0.06)';
    return 'rgba(255,255,255,0.03)';
  }

  function gameTypeBadge(type: LeaderboardGameType) {
    const map: Record<LeaderboardGameType, { label: string; color: string; bg: string }> = {
      slot:      { label: '🎰 Slot',      color: '#FFD700', bg: 'rgba(255,215,0,0.12)'   },
      blackjack: { label: '🃏 Blackjack', color: '#00ff88', bg: 'rgba(0,255,136,0.12)'  },
      roulette:  { label: '🎡 Roulette',  color: '#ff4466', bg: 'rgba(255,68,102,0.12)' },
      baccarat:  { label: '🎴 Baccarat',  color: '#aa44ff', bg: 'rgba(170,68,255,0.12)' },
      poker:     { label: '♠️ Poker',     color: '#ffaa00', bg: 'rgba(255,170,0,0.12)'  },
    };
    const { label, color, bg } = map[type] ?? map.slot;
    return (
      <span className="text-[9px] font-orbitron px-1.5 py-0.5 rounded-full shrink-0 tracking-wide"
        style={{ color, background: bg }}>
        {label}
      </span>
    );
  }

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-8"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg flex flex-col rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(160deg, #0d0020 0%, #050010 100%)',
              border: '1px solid rgba(255,215,0,0.2)',
              boxShadow: '0 0 60px rgba(255,215,0,0.1)',
              maxHeight: 'min(85vh, 680px)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏆</span>
                <div>
                  <h2 className="font-orbitron text-lg font-bold text-yellow-300 tracking-widest">LEADERBOARD</h2>
                  <p className="text-white/30 text-xs font-orbitron">Live winners · Updates every 20s</p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex shrink-0 border-b border-white/10">
              {([['board', '🏅 Rankings'], ['feed', '⚡ Live Feed']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex-1 py-2.5 text-xs font-orbitron tracking-wider transition-colors ${tab === id ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-white/40 hover:text-white/70'}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1">
              {tab === 'board' && (
                <div className="flex flex-col">
                  {entries.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-6 h-6 rounded-full border-2 border-yellow-300 border-t-transparent animate-spin" />
                    </div>
                  ) : (
                    entries.map((entry, i) => {
                      const isMe = entry.isRealPlayer;
                      const isNew = newIds.has(entry.id);
                      return (
                        <motion.div
                          key={entry.id}
                          layout
                          initial={isNew ? { opacity: 0, x: -20 } : false}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3 }}
                          className="flex items-center gap-3 px-4 py-3 border-b border-white/5 transition-colors"
                          style={{
                            background: isMe
                              ? 'rgba(255,215,0,0.08)'
                              : rankBg(i),
                            border: isMe ? '1px solid rgba(255,215,0,0.3)' : undefined,
                          }}
                        >
                          {/* Rank */}
                          <span className={`font-orbitron text-sm font-bold w-7 text-center shrink-0 ${rankColor(i)}`}>
                            {i + 1}
                          </span>

                          {/* Avatar */}
                          <span className="text-xl shrink-0">{entry.avatar}</span>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-orbitron text-xs font-bold truncate ${isMe ? 'text-yellow-300' : 'text-white'}`}>
                                {entry.username}
                              </span>
                              {isMe && (
                                <span className="text-[9px] font-orbitron px-1.5 py-0.5 rounded-full shrink-0"
                                  style={{ background: 'rgba(255,215,0,0.3)', color: '#FFD700' }}>
                                  YOU
                                </span>
                              )}
                              <span className="text-sm shrink-0">{entry.countryFlag}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {gameTypeBadge(entry.gameType)}
                              <p className="text-white/40 text-[10px] truncate">{entry.game}</p>
                            </div>
                          </div>

                          {/* Amount + time */}
                          <div className="text-right shrink-0">
                            <motion.p
                              className={`font-orbitron text-xs font-bold ${entry.amount >= 1000000 ? 'text-yellow-300' : 'text-green-400'}`}
                              animate={isNew ? { scale: [1, 1.15, 1] } : {}}
                              transition={{ duration: 0.4 }}
                              style={entry.amount >= 1000000 ? { textShadow: '0 0 8px rgba(255,215,0,0.6)' } : undefined}
                            >
                              {formatAmount(entry.amount)}
                            </motion.p>
                            <p className="text-white/25 text-[10px]">{formatTimeAgo(entry.timestamp)}</p>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              )}

              {tab === 'feed' && (
                <div className="flex flex-col px-4 py-3 gap-2">
                  {feed.length === 0 && (
                    <p className="text-center text-white/30 text-xs font-orbitron py-8">
                      Waiting for winners...
                    </p>
                  )}
                  <AnimatePresence initial={false}>
                    {feed.map((entry) => {
                      const isJackpot = entry.amount >= 1000000;
                      const feedIcon = isJackpot ? '🏆' : {
                        slot: '🎰', blackjack: '🃏', roulette: '🎡',
                        baccarat: '🎴', poker: '♠️',
                      }[entry.gameType] ?? '🎰';
                      return (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, y: -16 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
                          style={{
                            background: isJackpot ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.04)',
                            border: isJackpot ? '1px solid rgba(255,215,0,0.3)' : '1px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          <span className="text-base shrink-0">{feedIcon}</span>
                          <span className="text-white/60 flex-1">
                            <span className={`font-orbitron font-bold ${isJackpot ? 'text-yellow-300' : 'text-white'}`}>
                              {entry.username}
                            </span>
                            {' '}
                            <span className="text-white/40">{entry.countryFlag}</span>
                            {' won '}
                            <span className={`font-bold ${isJackpot ? 'text-yellow-300' : 'text-green-400'}`}>
                              {formatAmount(entry.amount)}
                            </span>
                            {' on '}
                            <span className="text-white/70">{entry.game}</span>
                          </span>
                          <span className="text-white/20 shrink-0 text-[10px]">{formatTimeAgo(entry.timestamp)}</span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-white/10 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400 text-[10px] font-orbitron">LIVE</span>
              </div>
              <span className="text-white/20 text-[10px] font-orbitron">1,000+ active players</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
