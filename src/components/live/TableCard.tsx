import { motion } from 'framer-motion';
import type { LiveTable } from '../../config/liveTablesData';

interface TableCardProps {
  table: LiveTable;
  onJoin: (table: LiveTable) => void;
}

const STATUS_CONFIG = {
  live:    { label: 'LIVE',    dot: 'bg-green-400',  text: 'text-green-400',  border: 'border-green-500/30' },
  waiting: { label: 'WAITING', dot: 'bg-yellow-400', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  full:    { label: 'FULL',    dot: 'bg-red-400',    text: 'text-red-400',    border: 'border-red-500/30' },
};

const GAME_COLORS: Record<string, string> = {
  blackjack: '#00ff88',
  roulette:  '#ff4466',
  baccarat:  '#aa44ff',
  poker:     '#ffaa00',
};

export default function TableCard({ table, onJoin }: TableCardProps) {
  const s = STATUS_CONFIG[table.status];
  const accentColor = GAME_COLORS[table.gameType] ?? '#FFD700';
  const isFull = table.status === 'full';

  return (
    <motion.div
      whileHover={!isFull ? { scale: 1.02, boxShadow: `0 0 28px ${accentColor}33` } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="relative flex flex-col gap-3 p-4 rounded-2xl"
      style={{
        background: 'linear-gradient(160deg, #0d0020 0%, #050010 100%)',
        border: `1px solid ${accentColor}22`,
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      }}
    >
      {/* Featured badge */}
      {table.featured && (
        <span className="absolute top-3 right-3 text-[10px] font-orbitron font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44` }}>
          FEATURED
        </span>
      )}

      {/* Game type tag */}
      <span className="text-[10px] font-orbitron font-bold tracking-widest uppercase"
        style={{ color: accentColor }}>
        {table.gameType}
      </span>

      {/* Table name */}
      <h3 className="font-orbitron font-bold text-white text-sm leading-tight pr-16">
        {table.name}
      </h3>

      {/* Dealer */}
      <div className="flex items-center gap-2">
        <span className="text-lg">{table.dealerAvatar}</span>
        <div>
          <p className="text-gray-400 text-[10px]">DEALER</p>
          <p className="text-white text-xs font-semibold">{table.dealerName}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs">
        {/* Players */}
        <div>
          <p className="text-gray-500 text-[10px]">PLAYERS</p>
          <p className="text-white font-semibold">{table.currentPlayers}/{table.maxPlayers}</p>
        </div>
        {/* Bet range */}
        <div className="text-right">
          <p className="text-gray-500 text-[10px]">BET RANGE</p>
          <p className="text-white font-semibold">${table.minBet} – ${table.maxBet.toLocaleString()}</p>
        </div>
      </div>

      {/* Status */}
      <div className={`flex items-center gap-1.5 ${s.text}`}>
        <span className={`w-2 h-2 rounded-full ${s.dot} ${table.status === 'live' ? 'animate-pulse' : ''}`} />
        <span className="text-[11px] font-orbitron font-bold tracking-widest">{s.label}</span>
      </div>

      {/* Join button */}
      <button
        onClick={() => !isFull && onJoin(table)}
        disabled={isFull}
        className="mt-auto w-full py-2.5 rounded-xl font-orbitron font-bold text-xs tracking-widest transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        style={!isFull ? {
          background: `linear-gradient(135deg, ${accentColor}, ${accentColor}99)`,
          color: '#000',
          boxShadow: `0 0 14px ${accentColor}55`,
        } : { background: '#1a1a2e', color: '#666', border: '1px solid #333' }}
      >
        {isFull ? 'TABLE FULL' : 'JOIN TABLE'}
      </button>
    </motion.div>
  );
}
