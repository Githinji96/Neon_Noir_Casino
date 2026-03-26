import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import ParticleBackground from '../components/ParticleBackground';
import TableCard from '../components/live/TableCard';
import { useLiveTablesStore } from '../store/liveTablesStore';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { GAME_CATEGORIES, type GameType, type LiveTable } from '../config/liveTablesData';

export default function LiveTablesPage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<GameType | 'all'>('all');
  const [alertMsg, setAlertMsg] = useState('');

  const tables = useLiveTablesStore((s) => s.tables);
  const startPolling = useLiveTablesStore((s) => s.startPolling);
  const { user } = useAuthStore();
  const balance = useGameStore((s) => s.balance);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    const stop = startPolling();
    return stop;
  }, []);

  const filtered = activeCategory === 'all'
    ? tables
    : tables.filter((t) => t.gameType === activeCategory);

  const handleJoin = (table: LiveTable) => {
    if (!user) {
      setAlertMsg('Please sign in to join a live table.');
      return;
    }
    if (balance < table.minBet) {
      setAlertMsg(`Insufficient balance. Minimum bet is $${table.minBet}.`);
      return;
    }
    navigate(`/live-tables/${table.id}`, { state: { table } });
  };

  return (
    <div className="relative bg-black min-h-screen">
      <ParticleBackground />
      <Navbar />

      <main className="px-3 sm:px-6 pb-24 md:pb-10">
        {/* Header */}
        <div className="pt-10 pb-6">
          <h1 className="font-orbitron font-bold text-2xl md:text-4xl tracking-widest text-white uppercase"
            style={{ textShadow: '0 0 20px rgba(255,100,100,0.5)' }}>
            Live <span style={{ color: '#ff4466' }}>Casino</span> Tables
          </h1>
          <p className="text-gray-400 text-sm mt-2">Play with real dealers in real time</p>

          {/* Live indicator */}
          <div className="flex items-center gap-2 mt-3">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs font-orbitron tracking-widest">
              {tables.filter((t) => t.status === 'live').length} TABLES LIVE NOW
            </span>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6" style={{ scrollbarWidth: 'none' }}>
          {GAME_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full font-orbitron text-xs tracking-widest transition-all duration-200 ${
                activeCategory === cat.id
                  ? 'text-black'
                  : 'text-gray-400 hover:text-white border border-white/10 hover:border-white/30'
              }`}
              style={activeCategory === cat.id ? {
                background: 'linear-gradient(135deg, #ff4466, #aa44ff)',
                boxShadow: '0 0 16px rgba(255,68,102,0.4)',
              } : {}}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Alert */}
        <AnimatePresence>
          {alertMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(255,68,68,0.15)', border: '1px solid rgba(255,68,68,0.3)', color: '#ff8888' }}
            >
              <span>⚠️ {alertMsg}</span>
              <button onClick={() => setAlertMsg('')} className="text-gray-400 hover:text-white text-lg leading-none">×</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((table) => (
              <motion.div
                key={table.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <TableCard table={table} onJoin={handleJoin} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      <BottomNav activeTab="home" onTabChange={(tab) => { if (tab === 'spin') navigate('/'); }} />
    </div>
  );
}
