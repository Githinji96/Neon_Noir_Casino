/**
 * NotificationsPage — /notifications
 * Full notification history with filtering, mark-all-read, and pagination.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import { useAuthStore } from '../store/authStore';
import {
  useNotificationStore,
  NOTIFICATION_ICONS,
  type Notification,
  type NotificationType,
} from '../store/notificationStore';

const TYPE_COLORS: Record<NotificationType, string> = {
  WIN:        '#4ade80',
  JACKPOT:    '#FFD700',
  DEPOSIT:    '#00ffff',
  WITHDRAWAL: '#ff6b6b',
  VIP:        '#FFD700',
  PROMOTION:  '#a78bfa',
  SECURITY:   '#fb923c',
  SYSTEM:     '#94a3b8',
};

const FILTER_TABS: { label: string; value: NotificationType | 'ALL' | 'UNREAD' }[] = [
  { label: 'All',        value: 'ALL' },
  { label: 'Unread',     value: 'UNREAD' },
  { label: 'Wins',       value: 'WIN' },
  { label: 'Jackpot',    value: 'JACKPOT' },
  { label: 'Financial',  value: 'DEPOSIT' },
  { label: 'VIP',        value: 'VIP' },
  { label: 'Security',   value: 'SECURITY' },
];

function timeAgo(isoStr: string): string {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(isoStr).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    notifications, unreadCount, loading,
    load, subscribe, markRead, markAllRead, deleteNotification,
  } = useNotificationStore();

  const [filter, setFilter] = useState<NotificationType | 'ALL' | 'UNREAD'>('ALL');
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!user?.id) return;
    load(user.id);
    const unsub = subscribe(user.id);
    return unsub;
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = notifications.filter((n) => {
    if (filter === 'ALL')    return true;
    if (filter === 'UNREAD') return !n.is_read;
    if (filter === 'DEPOSIT') return n.type === 'DEPOSIT' || n.type === 'WITHDRAWAL';
    return n.type === filter;
  });

  const paginated = filtered.slice(0, page * PER_PAGE);
  const hasMore   = paginated.length < filtered.length;

  function handleClick(notif: Notification) {
    if (!notif.is_read) markRead(notif.id);
    if (notif.target_url) navigate(notif.target_url);
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="font-orbitron text-white/40 tracking-widest">Sign in to see notifications</p>
        <button
          onClick={() => navigate('/auth/login')}
          className="px-8 py-3 rounded-xl font-orbitron text-sm font-bold text-black"
          style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}
        >
          SIGN IN
        </button>
      </div>
    );
  }

  return (
    <div className="relative bg-black min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-orbitron text-xs text-white/30 tracking-[0.3em] uppercase mb-0.5">Account</p>
            <h1 className="font-orbitron text-xl font-bold text-yellow-400 tracking-widest">
              NOTIFICATIONS
            </h1>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead(user.id)}
              className="text-xs font-orbitron text-yellow-400/70 hover:text-yellow-400 transition-colors tracking-wider border border-yellow-400/20 rounded-full px-3 py-1.5 hover:border-yellow-400/40"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 mb-4">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setFilter(tab.value); setPage(1); }}
              className={`shrink-0 px-3 py-1.5 rounded-full font-orbitron text-[10px] tracking-wider transition-all
                ${filter === tab.value
                  ? 'bg-yellow-400 text-black font-bold'
                  : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
                }`}
            >
              {tab.label}
              {tab.value === 'UNREAD' && unreadCount > 0 && (
                <span className="ml-1.5 bg-black/30 rounded-full px-1">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Notification list */}
        {loading && notifications.length === 0 ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-4xl opacity-30">🔔</span>
            <p className="font-orbitron text-sm text-white/25 tracking-widest">No notifications</p>
          </div>
        ) : (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.07)' }}
          >
            {paginated.map((notif, i) => {
              const color = TYPE_COLORS[notif.type] ?? '#FFD700';
              const icon  = NOTIFICATION_ICONS[notif.type] ?? '🔔';
              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className={`relative flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors
                    ${notif.is_read ? 'hover:bg-white/[0.03]' : 'hover:bg-yellow-400/[0.06]'}
                    ${i < paginated.length - 1 ? 'border-b border-white/5' : ''}`}
                  style={{ background: notif.is_read ? 'transparent' : 'rgba(255,215,0,0.04)' }}
                  onClick={() => handleClick(notif)}
                >
                  {/* Unread dot */}
                  {!notif.is_read && (
                    <span
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                      style={{ background: '#FFD700' }}
                    />
                  )}

                  {/* Icon */}
                  <div
                    className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-base mt-0.5"
                    style={{ background: `${color}15`, border: `1px solid ${color}25` }}
                  >
                    {icon}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-orbitron text-xs tracking-wider leading-tight
                        ${notif.is_read ? 'text-white/40' : 'text-white font-bold'}`}>
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-white/25 font-orbitron shrink-0">
                        {timeAgo(notif.created_at)}
                      </span>
                    </div>
                    <p className={`text-xs mt-0.5 leading-relaxed
                      ${notif.is_read ? 'text-white/25' : 'text-white/55'}`}>
                      {notif.message}
                    </p>
                    {/* Type badge */}
                    <span
                      className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-orbitron uppercase tracking-widest"
                      style={{ color, background: `${color}15` }}
                    >
                      {notif.type}
                    </span>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-white/15 hover:text-white/50 transition-colors text-xs mt-0.5"
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => setPage((p) => p + 1)}
              className="px-6 py-2 rounded-full font-orbitron text-xs tracking-widest border border-white/20 text-white/50 hover:text-white hover:border-white/40 transition-all"
            >
              Load more
            </button>
          </div>
        )}
      </main>

      <BottomNav activeTab="home" onTabChange={() => {}} />
    </div>
  );
}
