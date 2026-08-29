import { useEffect, useRef, useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import LeaderboardModal from './LeaderboardModal';
import DepositModal from './DepositModal';
import WithdrawalModal from './WithdrawalModal';
import SettingsModal from './SettingsModal';
import NotificationBell from './NotificationBell';
import { useSettingsStore } from '../store/settingsStore';
import { useNotificationStore } from '../store/notificationStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '../i18n/useTranslation';

interface NavbarProps {
  activeTab?: string;
  compact?: boolean;
}

const QUICK_NAV = [
  { labelKey: 'nav_slots' as const,       path: '/',            icon: '🎰' },
  { labelKey: 'nav_live_tables' as const, path: '/live-tables',  icon: '🃏' },
  { labelKey: 'nav_jackpots' as const,    path: '/jackpots',     icon: '🏆' },
  { labelKey: 'nav_vip' as const,         path: '/vip',          icon: '👑' },
];

const NAV_LINKS = [
  { labelKey: 'nav_slots' as const,       path: '/',            icon: '🎰' },
  { labelKey: 'nav_live_tables' as const, path: '/live-tables',  icon: '🃏' },
  { labelKey: 'nav_jackpots' as const,    path: '/jackpots',     icon: '🏆' },
  { labelKey: 'nav_vip' as const,         path: '/vip',          icon: '👑' },
];

function formatBalance(balance: number): string {
  if (balance >= 100_000) return `KES ${(balance / 1000).toFixed(1)}K`;
  return `KES ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Mobile menu row ──────────────────────────────────────────
function MenuRow({ icon, label, onClick, danger }: {
  icon: string; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-1 py-3 rounded-xl transition-colors active:bg-white/10
        ${danger ? 'text-red-400 hover:bg-red-400/10' : 'text-white/80 hover:bg-white/5'}`}
    >
      <span className="text-xl w-7 text-center shrink-0">{icon}</span>
      <span className="font-orbitron text-sm tracking-wider">{label}</span>
    </button>
  );
}

export default function Navbar({ activeTab, compact }: NavbarProps) {
  const t = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingSafetyRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openSettings = useSettingsStore((s) => s.openSettings);
  const unreadCount  = useNotificationStore((s) => s.unreadCount);
  const location = useLocation();
  const navigate = useNavigate();
  const balance = useGameStore((state) => state.balance);
  const { user, profile, signOut } = useAuthStore();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileMenuOpen]);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileMenuOpen(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  // Prevent body scroll while menu is open
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  // Clean up polling timers if Navbar unmounts mid-poll (e.g. route change)
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (pollingSafetyRef.current)   clearTimeout(pollingSafetyRef.current);
    };
  }, []);

  const handlePolling = (checkoutId: string) => {
    if (!checkoutId) return;
    setPolling(true);
    let attempts = 0;
    const MAX = 12;

    const syncBalance = async () => {
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return;
      const { data: prof } = await supabase
        .from('profiles').select('balance').eq('id', currentUser.id).single();
      if (prof?.balance != null) {
        useAuthStore.setState((s) => ({
          profile: s.profile ? { ...s.profile, balance: prof.balance } : null,
        }));
        const { useGameStore } = await import('../store/gameStore');
        useGameStore.setState({ balance: prof.balance });
      }
    };

    const stop = (success: boolean) => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (pollingSafetyRef.current)   clearTimeout(pollingSafetyRef.current);
      pollingIntervalRef.current = null;
      pollingSafetyRef.current   = null;
      setPolling(false);
      if (success) syncBalance();
    };

    pollingSafetyRef.current = setTimeout(() => stop(false), 40_000);

    pollingIntervalRef.current = setInterval(async () => {
      attempts++;
      try {
        const { data } = await supabase
          .from('transactions').select('status')
          .eq('checkout_request_id', checkoutId).single();

        if (data?.status === 'success') { stop(true); return; }
        if (data?.status === 'failed')  { stop(false); return; }

        if (attempts >= 3 && data?.status === 'pending') {
          try {
            const session = (await supabase.auth.getSession()).data.session;
            const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL.replace(
              '.supabase.co', '.supabase.co/functions/v1',
            );
            const res = await fetch(`${FUNCTIONS_URL}/mpesa-stk`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
              body: JSON.stringify({ action: 'query', checkoutRequestId: checkoutId }),
            });
            const result = await res.json();
            if (result.status === 'success') { stop(true); return; }
            if (result.status === 'failed')  { stop(false); return; }
          } catch (queryErr) {
            console.warn('[handlePolling] query error:', queryErr);
          }
        }
      } catch (pollErr) {
        console.warn('[handlePolling] poll error:', pollErr);
      }
      if (attempts >= MAX) stop(false);
    }, 3000);
  };

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    await signOut();
    const { useGameStore } = await import('../store/gameStore');
    useGameStore.setState({ balance: 0 });
    navigate('/auth/login');
  };

  const close = () => setMobileMenuOpen(false);
  const isActive = (path: string) => activeTab ? activeTab === path : location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 bg-black border-b border-yellow-400/20" ref={menuRef}>

      {/* ── TOP BAR ── */}
      <div className="px-3 sm:px-4 h-12 flex items-center justify-between gap-2 min-w-0">

        {/* Logo */}
        <Link
          to="/"
          className="font-orbitron font-bold tracking-tight text-neon-yellow shrink-0 leading-tight"
          style={{ fontSize: 'clamp(10px, 2.5vw, 16px)', textShadow: '0 0 8px rgba(255,215,0,0.6)' }}
        >
          <span className="sm:hidden">N·N·C</span>
          <span className="hidden sm:inline">NEON NOIR CASINO</span>
        </Link>

        {/* Desktop center nav */}
        <ul className="hidden lg:flex items-center gap-6 flex-1 justify-center">
          {NAV_LINKS.map(({ labelKey, path, icon }) => (
            <li key={path}>
              <Link to={path} className={`flex items-center gap-1.5 font-orbitron text-sm tracking-wider transition-colors ${isActive(path) ? 'text-neon-yellow' : 'text-gray-400 hover:text-white'}`}>
                <span className="text-base leading-none">{icon}</span>
                {t[labelKey]}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right cluster */}
        <div className="flex items-center gap-1.5 shrink-0 min-w-0">

          {/* Balance — always visible */}
          {user && (
            <span
              className="font-orbitron font-bold text-neon-yellow whitespace-nowrap"
              style={{ fontSize: 'clamp(9px, 2.2vw, 12px)', textShadow: '0 0 8px rgba(255,215,0,0.4)' }}
            >
              {formatBalance(balance)}
            </span>
          )}

          {/* Desktop-only: Deposit / Withdraw */}
          {user && (
            <div className="hidden lg:flex items-center gap-2 ml-1">
              <button onClick={() => !polling && setDepositOpen(true)}
                className="btn-neon px-3 py-1.5 rounded-full text-xs font-orbitron">
                {polling ? t.nav_pending : t.nav_deposit}
              </button>
              <button onClick={() => setWithdrawOpen(true)}
                className="btn-neon px-3 py-1.5 rounded-full text-xs font-orbitron">
                {t.nav_withdraw}
              </button>
            </div>
          )}

          {/* Desktop-only: Leaderboard */}
          <button onClick={() => setLeaderboardOpen(true)}
            className="hidden lg:flex text-yellow-400 text-lg w-8 h-8 items-center justify-center">
            🏆
          </button>

          {/* Desktop-only: Auth */}
          {user ? (
            <button onClick={handleSignOut}
              className="hidden lg:block text-gray-400 text-[10px] font-orbitron px-1">
              OUT
            </button>
          ) : (
            <div className="hidden lg:flex items-center gap-1">
              <button onClick={() => navigate('/auth/login')}
                className="font-orbitron text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full border border-yellow-400/50 text-yellow-400 hover:bg-yellow-400/10 transition-all">
                LOGIN
              </button>
              <button onClick={() => navigate('/auth/signup')}
                className="font-orbitron text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full transition-all"
                style={{ background: 'linear-gradient(135deg,#FFD700,#FFA500)', color: '#000' }}>
                SIGN UP
              </button>
            </div>
          )}

          {/* Desktop-only: Bell + Settings */}
          <div className="hidden lg:flex items-center gap-1">
            <NotificationBell />
            <button onClick={openSettings}
              className="text-gray-400 hover:text-neon-yellow text-lg w-8 h-8 flex items-center justify-center">
              ⚙️
            </button>
          </div>

          {/* Mobile: quick login when logged out */}
          {!user && (
            <button onClick={() => navigate('/auth/login')}
              className="lg:hidden font-orbitron text-[10px] font-bold px-2.5 py-1 rounded-full border border-yellow-400/50 text-yellow-400">
              {t.nav_login}
            </button>
          )}

          {/* Hamburger — mobile/tablet only */}
          <button
            onClick={() => setMobileMenuOpen((p) => !p)}
            aria-label="Menu"
            aria-expanded={mobileMenuOpen}
            className="lg:hidden flex items-center justify-center w-9 h-9 text-yellow-400 text-2xl font-black shrink-0"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* ── QUICK NAV ICONS (mobile + tablet) ── */}
      <div data-testid="quick-nav" className={`lg:hidden flex justify-around items-center px-1 py-2 border-t border-white/5${compact ? ' slot-hide' : ''}`}>
        {QUICK_NAV.map(({ labelKey, path, icon }) => (
          <Link key={path} to={path}
            className={`flex flex-col items-center gap-0.5 flex-1 py-2 rounded-xl border transition-colors mx-0.5 ${
              isActive(path)
                ? 'border-yellow-400/60 bg-yellow-400/10 text-yellow-400'
                : 'border-white/10 bg-white/5 text-gray-400'
            }`}>
            <span className="text-xl leading-none">{icon}</span>
            <span className="font-orbitron text-[8px] tracking-wide font-bold leading-tight text-center px-0.5">{t[labelKey]}</span>
          </Link>
        ))}
      </div>

      {/* ── MOBILE DRAWER ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={close}
            />

            {/* Slide-in panel */}
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="lg:hidden fixed top-0 right-0 bottom-0 w-72 z-50 flex flex-col"
              style={{
                background: 'linear-gradient(160deg, #0d0020 0%, #050010 100%)',
                borderLeft: '1px solid rgba(255,215,0,0.15)',
                boxShadow: '-8px 0 40px rgba(0,0,0,0.8)',
              }}
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
                <div>
                  <p className="font-orbitron text-[10px] text-white/30 tracking-[0.3em] uppercase">Neon Noir Casino</p>
                  {user && profile?.username && (
                    <p className="font-orbitron text-sm text-cyan-400 mt-0.5">{profile.username}</p>
                  )}
                  {user && (
                    <p className="font-orbitron text-xs text-yellow-400 font-bold mt-0.5">{formatBalance(balance)}</p>
                  )}
                </div>
                <button onClick={close} className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white">✕</button>
              </div>

              {/* Drawer body */}
              <div className="flex-1 overflow-y-auto px-3 py-2">
                {user ? (
                  <>
                    <p className="font-orbitron text-[9px] text-yellow-400/50 tracking-[0.2em] uppercase px-1 mt-2 mb-1">Wallet</p>
                    <MenuRow icon="💳" label={polling ? 'Pending…' : 'Deposit'} onClick={() => { setDepositOpen(true); close(); }} />
                    <MenuRow icon="💸" label="Withdraw" onClick={() => { setWithdrawOpen(true); close(); }} />

                    <div className="my-2 border-t border-white/5" />
                    <p className="font-orbitron text-[9px] text-yellow-400/50 tracking-[0.2em] uppercase px-1 mb-1">Account</p>
                    <MenuRow icon="🏆" label="Leaderboard" onClick={() => { setLeaderboardOpen(true); close(); }} />
                    <MenuRow
                      icon="🔔"
                      label={`Notifications${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
                      onClick={() => { navigate('/notifications'); close(); }}
                    />
                    <MenuRow icon="👑" label="VIP Club" onClick={() => { navigate('/vip'); close(); }} />
                    <MenuRow icon="⚙️" label="Settings" onClick={() => { openSettings(); close(); }} />

                    <div className="my-2 border-t border-white/5" />
                    <MenuRow icon="🚪" label="Sign Out" onClick={handleSignOut} danger />
                  </>
                ) : (
                  <>
                    <p className="font-orbitron text-[9px] text-yellow-400/50 tracking-[0.2em] uppercase px-1 mt-2 mb-1">Account</p>
                    <MenuRow icon="🔑" label="Login" onClick={() => { navigate('/auth/login'); close(); }} />
                    <MenuRow icon="✨" label="Sign Up" onClick={() => { navigate('/auth/signup'); close(); }} />
                  </>
                )}
              </div>

              {/* Drawer footer */}
              <div className="px-4 py-3 border-t border-white/5">
                <p className="text-center text-white/15 text-[10px] font-orbitron">NEON NOIR CASINO</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <LeaderboardModal isOpen={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} />
      <DepositModal isOpen={depositOpen} onClose={() => setDepositOpen(false)} onPolling={handlePolling} />
      <WithdrawalModal isOpen={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
      <SettingsModal />
    </nav>
  );
}
