import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import WeeklyCashbackCard from '../components/WeeklyCashbackCard';
import WeeklyCashbackHistory from '../components/WeeklyCashbackHistory';
import { useAuthStore } from '../store/authStore';
import { useVIPStore } from '../store/vipStore';
import { VIP_TIERS, getNextTier } from '../config/vipConfig';
import { supabase } from '../lib/supabase';

interface LeaderboardEntry {
  username: string;
  level: string;
  total_points: number;
}

export default function VIPPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { totalPoints, monthlyPoints, currentTier, loadVIP } = useVIPStore();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const nextTier = getNextTier(currentTier.level);
  const progressPct = nextTier
    ? Math.min(100, ((totalPoints - currentTier.minPoints) / (nextTier.minPoints - currentTier.minPoints)) * 100)
    : 100;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (user?.id) loadVIP(user.id);

    // Load leaderboard
    supabase
      .from('vip_users')
      .select('user_id, level, total_points')
      .order('total_points', { ascending: false })
      .limit(10)
      .then(async ({ data }) => {
        if (!data?.length) return;
        const ids = data.map((r) => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', ids);
        const usernameMap: Record<string, string> = {};
        profiles?.forEach((p) => { usernameMap[p.id] = p.username; });
        setLeaderboard(data.map((r) => ({
          username: usernameMap[r.user_id] ?? 'Player',
          level: r.level,
          total_points: r.total_points,
        })));
      });
  }, [user?.id]);

  const tierColors: Record<string, string> = {
    bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700',
    platinum: '#E5E4E2', diamond: '#B9F2FF',
  };

  return (
    <div className="relative bg-black min-h-screen">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8 pb-28 md:pb-10">

        {/* Header */}
        <div className="text-center mb-8">
          <p className="font-orbitron text-xs text-white/30 tracking-[0.3em] uppercase mb-1">Loyalty Program</p>
          <h1 className="font-orbitron text-3xl font-black tracking-widest"
            style={{ color: '#FFD700', textShadow: '0 0 24px rgba(255,215,0,0.5)' }}>
            VIP CLUB
          </h1>
          <p className="text-white/40 text-sm mt-2">Earn points. Unlock rewards. Rise through the ranks.</p>
        </div>

        {/* Current Level Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-6 mb-6"
          style={{
            background: `linear-gradient(135deg, ${currentTier.color}22, rgba(0,0,0,0.8))`,
            border: `1px solid ${currentTier.color}44`,
            boxShadow: `0 0 40px ${currentTier.glowColor}`,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-5xl">{currentTier.icon}</span>
              <div>
                <p className="text-white/40 text-xs font-orbitron tracking-widest uppercase">Current Level</p>
                <p className="font-orbitron text-2xl font-black" style={{ color: currentTier.color }}>
                  {currentTier.label.toUpperCase()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white/40 text-xs font-orbitron">TOTAL POINTS</p>
              <p className="font-orbitron text-2xl font-bold text-white">{totalPoints.toLocaleString()}</p>
              <p className="text-white/30 text-xs">{monthlyPoints.toLocaleString()} this month</p>
            </div>
          </div>

          {/* Progress bar */}
          {nextTier && (
            <div>
              <div className="flex justify-between text-xs text-white/40 mb-1 font-orbitron">
                <span>{currentTier.label}</span>
                <span>{nextTier.label} — {(nextTier.minPoints - totalPoints).toLocaleString()} pts away</span>
              </div>
              <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  style={{ background: `linear-gradient(90deg, ${currentTier.color}, ${nextTier.color})` }}
                />
              </div>
              <p className="text-right text-xs text-white/30 mt-1 font-orbitron">{progressPct.toFixed(1)}%</p>
            </div>
          )}
          {!nextTier && (
            <p className="text-center font-orbitron text-sm text-yellow-400 mt-2">
              👑 Maximum level achieved
            </p>
          )}
        </motion.div>

        {/* Weekly Cashback */}
        {user && (
          <div className="mb-6">
            <WeeklyCashbackCard
              userId={user.id}
              tierColor={currentTier.color}
              tierLabel={currentTier.label}
              cashbackRate={currentTier.cashbackRate}
            />
          </div>
        )}

        {/* All Tiers */}
        <h2 className="font-orbitron text-sm text-white/40 tracking-widest uppercase mb-4">All Tiers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {VIP_TIERS.map((tier) => {
            const isUnlocked = totalPoints >= tier.minPoints;
            const isCurrent = tier.level === currentTier.level;
            return (
              <motion.div
                key={tier.level}
                whileHover={isUnlocked ? { scale: 1.02 } : {}}
                className="rounded-xl p-4 relative overflow-hidden"
                style={{
                  background: isCurrent
                    ? `linear-gradient(135deg, ${tier.color}22, rgba(0,0,0,0.7))`
                    : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isCurrent ? tier.color + '66' : 'rgba(255,255,255,0.08)'}`,
                  filter: isUnlocked ? 'none' : 'brightness(0.5)',
                }}
              >
                {isCurrent && (
                  <span className="absolute top-2 right-2 text-xs font-orbitron px-2 py-0.5 rounded-full"
                    style={{ background: tier.color, color: '#000' }}>CURRENT</span>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{tier.icon}</span>
                  <p className="font-orbitron font-bold" style={{ color: tier.color }}>{tier.label}</p>
                </div>
                <div className="flex flex-col gap-1 text-xs text-white/50">
                  <span>Min points: <span className="text-white">{tier.minPoints.toLocaleString()}</span></span>
                  <span>Cashback: <span className="text-white">{tier.cashbackRate}%</span></span>
                  <span>Deposit bonus: <span className="text-white">{tier.depositBonus}%</span></span>
                  <span>Withdrawals: <span className="text-white capitalize">{tier.withdrawalPriority}</span></span>
                  {tier.personalManager && <span className="text-yellow-400">✓ Personal manager</span>}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* How to earn */}
        <div className="rounded-2xl p-5 mb-8"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="font-orbitron text-xs text-white/40 tracking-widest uppercase mb-4">How to Earn Points</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: '🎰', label: 'Slot Spins', desc: `${currentTier.pointsPerBetKES * 100} pts per KES 1 bet` },
              { icon: '🃏', label: 'Live Tables', desc: `${currentTier.pointsPerBetKES * 100} pts per KES 1 bet` },
              { icon: '💳', label: 'Deposits', desc: `${currentTier.pointsPerDepositKES * 100} pts per KES 1 deposited` },
              { icon: '⚡', label: 'Double Points', desc: 'Special events & promotions' },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3 p-3 rounded-xl bg-white/5">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <p className="font-orbitron text-sm text-white font-bold">{item.label}</p>
                  <p className="text-white/40 text-xs">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Cashback History */}
        {user && (
          <div className="mb-8">
            <WeeklyCashbackHistory />
          </div>
        )}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div>
            <h2 className="font-orbitron text-xs text-white/40 tracking-widest uppercase mb-4">VIP Leaderboard</h2>
            <div className="flex flex-col gap-2">
              {leaderboard.map((entry, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-center gap-3">
                    <span className="font-orbitron text-white/30 text-sm w-6">{i + 1}</span>
                    <span className="text-white text-sm font-semibold">{entry.username}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-orbitron capitalize"
                      style={{ background: `${tierColors[entry.level]}22`, color: tierColors[entry.level] }}>
                      {entry.level}
                    </span>
                  </div>
                  <span className="font-orbitron text-yellow-400 text-sm font-bold">
                    {entry.total_points.toLocaleString()} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!user && (
          <div className="text-center py-12">
            <p className="text-white/40 font-orbitron mb-4">Sign in to track your VIP progress</p>
            <button onClick={() => navigate('/auth/login')}
              className="px-8 py-3 rounded-xl font-orbitron text-sm font-bold text-black"
              style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}>
              SIGN IN
            </button>
          </div>
        )}
      </main>

      <BottomNav activeTab="home" onTabChange={() => {}} />
    </div>
  );
}
