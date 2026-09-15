/**
 * NotificationBell — bell icon with unread badge + dropdown panel.
 * Positioned in the Navbar. Uses Supabase Realtime for live updates.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import {
  useNotificationStore,
  NOTIFICATION_ICONS,
  type Notification,
  type NotificationType,
} from '../store/notificationStore';

// ── Type color map (Neon Noir palette) ──────────────────────
const TYPE_COLORS: Record<NotificationType, string> = {
  WIN:        '#4ade80',  // green
  JACKPOT:    '#FFD700',  // neon yellow
  DEPOSIT:    '#00ffff',  // cyan
  WITHDRAWAL: '#ff6b6b',  // red
  VIP:        '#FFD700',  // gold
  PROMOTION:  '#a78bfa',  // purple
  SECURITY:   '#fb923c',  // orange
  SYSTEM:     '#94a3b8',  // slate
};

function timeAgo(isoStr: string): string {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60)       return `${diff}s ago`;
  if (diff < 3600)     return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)    return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800)   return 'Yesterday';
  return new Date(isoStr).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}

// ── Navigation targets by notification type ──────────────────
const TARGET_MAP: Partial<Record<NotificationType, string>> = {
  JACKPOT:    '/jackpots',
  VIP:        '/vip',
  DEPOSIT:    '/',
  WITHDRAWAL: '/',
  PROMOTION:  '/vip',
};

// ── Bell SVG ─────────────────────────────────────────────────
function BellIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      width="18" height="18" viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2zm6-6V11a6 6 0 0 0-5-5.91V4a1 1 0 0 0-2 0v1.09A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z" />
    </svg>
  );
}

// ── Notification item ─────────────────────────────────────────
function NotificationItem({
  notif,
  onRead,
  onDelete,
  onNavigate,
}: {
  notif: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (url: string | null) => void;
}) {
  const color = TYPE_COLORS[notif.type] ?? '#FFD700';
  const icon  = NOTIFICATION_ICONS[notif.type] ?? '🔔';

  function handleClick() {
    if (!notif.is_read) onRead(notif.id);
    if (notif.target_url) onNavigate(notif.target_url);
    else if (TARGET_MAP[notif.type]) onNavigate(TARGET_MAP[notif.type]!);
  }

  return (
    <div
      className={`relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors
        ${notif.is_read ? 'hover:bg-white/[0.03]' : 'hover:bg-yellow-400/[0.06]'}`}
      style={{
        background: notif.is_read
          ? 'transparent'
          : 'rgba(255,215,0,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
      onClick={handleClick}
    >
      {/* Unread indicator dot */}
      {!notif.is_read && (
        <span
          className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
          style={{ background: '#FFD700' }}
        />
      )}

      {/* Type icon */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base"
        style={{ background: `${color}18`, border: `1px solid ${color}30` }}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`font-orbitron text-[11px] tracking-wider leading-tight truncate
          ${notif.is_read ? 'text-white/50' : 'text-white font-bold'}`}>
          {notif.title}
        </p>
        <p className={`text-[11px] mt-0.5 leading-relaxed line-clamp-2
          ${notif.is_read ? 'text-white/30' : 'text-white/60'}`}>
          {notif.message}
        </p>
        <p className="text-[10px] text-white/25 mt-1 font-orbitron">{timeAgo(notif.created_at)}</p>
      </div>

      {/* Delete */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(notif.id); }}
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-white/20 hover:text-white/60 transition-colors text-xs"
        aria-label="Delete notification"
      >
        ✕
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function NotificationBell() {
  const { user } = useAuthStore();
  const {
    notifications, unreadCount, loading, hasNewNotification,
    load, subscribe, markRead, markAllRead, deleteNotification, clearNewFlag,
  } = useNotificationStore();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const panelRef  = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Load + subscribe once user is known
  useEffect(() => {
    if (!user?.id) return;
    load(user.id);
    const unsub = subscribe(user.id);
    return unsub;
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  // Clear pulse after open
  useEffect(() => {
    if (open && hasNewNotification) clearNewFlag();
  }, [open, hasNewNotification]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <div className="relative">
      {/* ── Bell button ── */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        className="relative flex items-center justify-center w-8 h-8 text-gray-400 hover:text-white transition-colors"
      >
        <motion.div
          animate={hasNewNotification ? { rotate: [0, -12, 12, -8, 8, 0] } : {}}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
          <BellIcon className="text-yellow-400" style={{ filter: 'drop-shadow(0 0 6px rgba(255,215,0,0.6))' }} />
        </motion.div>

        {/* Badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full font-orbitron font-bold text-[9px] text-black leading-none"
              style={{ background: '#FFD700', boxShadow: '0 0 6px rgba(255,215,0,0.6)' }}
            >
              {badgeLabel}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* ── Dropdown panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="fixed sm:absolute right-0 sm:right-0 z-[300] flex flex-col"
            style={{
              top: '100%',
              marginTop: 8,
              width: 'min(400px, 100vw)',
              // On mobile: full-width, anchored to right edge
              right: 0,
              maxHeight: '80dvh',
              background: 'linear-gradient(160deg, #0d0020 0%, #050010 100%)',
              border: '1px solid rgba(255,215,0,0.2)',
              borderRadius: 16,
              boxShadow: '0 0 40px rgba(0,0,0,0.9), 0 0 20px rgba(255,215,0,0.05)',
              overflow: 'hidden',
            }}
          >
            {/* Panel header */}
            <div
              className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-2">
                <span className="font-orbitron text-xs font-bold text-white tracking-widest uppercase">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded-full font-orbitron text-[9px] font-bold text-black"
                    style={{ background: '#FFD700' }}
                  >
                    {badgeLabel}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead(user.id)}
                    className="text-[10px] font-orbitron text-yellow-400/70 hover:text-yellow-400 transition-colors tracking-wider"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="text-white/30 hover:text-white transition-colors text-sm"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Notification list */}
            <div className="overflow-y-auto flex-1 scrollbar-none">
              {loading && notifications.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <BellIcon className="w-8 h-8 text-white/15" />
                  <p className="font-orbitron text-xs text-white/25 tracking-wider">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <NotificationItem
                    key={notif.id}
                    notif={notif}
                    onRead={markRead}
                    onDelete={deleteNotification}
                    onNavigate={(url) => {
                      setOpen(false);
                      if (url) navigate(url);
                    }}
                  />
                ))
              )}
            </div>

            {/* Footer — view all */}
            {notifications.length > 0 && (
              <div
                className="shrink-0 px-4 py-2.5 flex justify-center"
                style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
              >
                <button
                  onClick={() => { setOpen(false); navigate('/notifications'); }}
                  className="font-orbitron text-[10px] tracking-widest text-white/30 hover:text-yellow-400 transition-colors uppercase"
                >
                  View all notifications →
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
