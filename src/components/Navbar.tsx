import { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import LeaderboardModal from './LeaderboardModal';
import DepositModal from './DepositModal';
import WithdrawalModal from './WithdrawalModal';
import SettingsModal from './SettingsModal';
import { useSettingsStore } from '../store/settingsStore';
import { motion, AnimatePresence } from 'framer-motion';

interface NavbarProps {
  activeTab?: string;
}

const QUICK_NAV = [
  { label: 'SLOTS',       path: '/slots',       icon: '🎰' },
  { label: 'LIVE TABLES', path: '/live-tables',  icon: '🃏' },
  { label: 'JACKPOTS',    path: '/jackpots',     icon: '🏆' },
  { label: 'VIP',         path: '/vip',          icon: '👑' },
];

const NAV_LINKS = [
  { label: 'Slots',       path: '/slots',       icon: '🎰' },
  { label: 'Live Tables', path: '/live-tables',  icon: '🃏' },
  { label: 'Jackpots',    path: '/jackpots',     icon: '🏆' },
  { label: 'VIP',         path: '/vip',          icon: '👑' },
];

const formatBalance = (balance: number): string =>
  `KES ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Navbar({ activeTab }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [polling, setPolling] = useState(false);
  const openSettings = useSettingsStore((s) => s.openSettings);
  const location = useLocation();
  const navigate = useNavigate();
  const balance = useGameStore((state) => state.balance);
  const { user, profile, signOut } = useAuthStore();

  const handlePolling = (checkoutId: string) => {
    if (!checkoutId) return;
    setPolling(true);
    let attempts = 0;
    const MAX = 24; // 24 × 5s = 2 minutes

    const syncBalance = async () => {
      // Always read fresh user ID from store — avoids stale closure
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return;
      const { data: prof } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', currentUser.id)
        .single();
      if (prof?.balance != null) {
        useAuthStore.setState((s) => ({
          profile: s.profile ? { ...s.profile, balance: prof.balance } : null,
        }));
        const { useGameStore } = await import('../store/gameStore');
        useGameStore.setState({ balance: prof.balance });
      }
    };

    const stop = (success: boolean) => {
      clearInterval(interval);
      clearTimeout(safetyTimer);
      setPolling(false);
      if (success) syncBalance();
    };

    const safetyTimer = setTimeout(() => stop(false), 125_000);

    const interval = setInterval(async () => {
      attempts++;
      try {
        const { data } = await supabase
          .from('transactions')
          .select('status')
          .eq('checkout_request_id', checkoutId)
          .single();

        if (data?.status === 'success') { stop(true); return; }
        if (data?.status === 'failed')  { stop(false); return; }

        // After 2 pending polls (~10s in sandbox, ~30s in prod), actively query Daraja for status
        if (attempts >= 2 && data?.status === 'pending') {
          try {
            const session = (await supabase.auth.getSession()).data.session;
            const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL.replace(
              '.supabase.co',
              '.supabase.co/functions/v1',
            );
            const res = await fetch(`${FUNCTIONS_URL}/mpesa-stk`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.access_token}`,
              },
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
    }, 5000);
  };

  const handleSignOut = async () => {
    await signOut();
    const { useGameStore } = await import('../store/gameStore');
    useGameStore.setState({ balance: 0 });
    navigate('/auth/login');
  };

  const isActive = (path: string) => activeTab ? activeTab === path : location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 bg-black border-b border-yellow-400/20">

      {/* ── TOP BAR ── */}
      <div className="px-2 sm:px-4 h-12 flex items-center justify-between gap-1 overflow-hidden">
        {/* Logo */}
        <Link to="/" className="font-orbitron font-bold tracking-tight text-neon-yellow text-[11px] xs:text-sm sm:text-base shrink-0 leading-tight"
          style={{ textShadow: '0 0 8px rgba(255,215,0,0.6)' }}>
          <span className="xs:hidden">N.N.C</span>
          <span className="hidden xs:inline">NEON NOIR CASINO</span>
        </Link>

        {/* Desktop center nav */}
        <ul className="hidden lg:flex items-center gap-6 flex-1 justify-center">
          {NAV_LINKS.map(({ label, path, icon }) => (
            <li key={path}>
              <Link to={path} className={`flex items-center gap-1.5 font-orbitron text-sm tracking-wider transition-colors ${isActive(path) ? 'text-neon-yellow' : 'text-gray-400 hover:text-white'}`}>
                <span className="text-base leading-none">{icon}</span>
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right side */}
        <div className="flex items-center gap-1 shrink-0 min-w-0">
          {/* Balance — truncated on tiny screens */}
          {user && (
            <span className="font-orbitron text-[11px] text-neon-yellow font-bold whitespace-nowrap max-w-[90px] truncate"
              style={{ textShadow: '0 0 8px rgba(255,215,0,0.4)' }}>
              {formatBalance(balance)}
            </span>
          )}

          {/* Desktop: deposit/withdraw */}
          {user && (
            <div className="hidden lg:flex items-center gap-2 ml-1">
              <button onClick={() => !polling && setDepositOpen(true)}
                className="btn-neon px-3 py-1.5 rounded-full text-xs font-orbitron">
                {polling ? 'PENDING...' : 'DEPOSIT'}
              </button>
              <button onClick={() => setWithdrawOpen(true)} className="btn-neon px-3 py-1.5 rounded-full text-xs font-orbitron">
                WITHDRAW
              </button>
            </div>
          )}

          {/* Trophy — hidden on xs, shown sm+ */}
          <button onClick={() => setLeaderboardOpen(true)} className="hidden xs:flex text-yellow-400 text-base w-7 h-7 items-center justify-center sm:w-8 sm:h-8 sm:text-lg">🏆</button>

          {/* OUT / IN */}
          {user ? (
            <button onClick={handleSignOut} className="text-gray-400 text-[10px] font-orbitron px-1 hidden xs:block">OUT</button>
          ) : (
            <button onClick={() => navigate('/auth/login')} className="text-gray-400 text-[10px] font-orbitron px-1 hidden xs:block">LOGIN</button>
          )}

          {/* Bell — hidden on xs */}
          <button className="hidden xs:flex text-gray-400 text-base w-7 h-7 items-center justify-center sm:w-8 sm:h-8 sm:text-lg">🔔</button>

          {/* Settings — desktop only */}
          <button onClick={openSettings} className="hidden lg:flex text-gray-400 hover:text-neon-yellow text-lg w-8 h-8 items-center justify-center">⚙️</button>

          {/* Hamburger — ALWAYS visible on mobile/tablet, guaranteed last */}
          <button onClick={() => setMobileMenuOpen(p => !p)}
            className="lg:hidden text-yellow-400 text-2xl w-9 h-9 flex items-center justify-center font-black shrink-0 ml-1">
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* ── QUICK NAV ICONS (mobile + tablet) ── */}
      <div className="lg:hidden flex justify-around items-center px-1 py-2 border-t border-white/5">
        {QUICK_NAV.map(({ label, path, icon }) => (
          <Link key={path} to={path}
            className={`flex flex-col items-center gap-0.5 flex-1 py-2 rounded-xl border transition-colors mx-0.5 ${
              isActive(path)
                ? 'border-yellow-400/60 bg-yellow-400/10 text-yellow-400'
                : 'border-white/10 bg-white/5 text-gray-400'
            }`}>
            <span className="text-xl leading-none">{icon}</span>
            <span className="font-orbitron text-[8px] tracking-wide font-bold leading-tight text-center px-0.5">{label}</span>
          </Link>
        ))}
      </div>

      {/* ── HAMBURGER SLIDE-DOWN MENU (mobile only) ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden overflow-hidden border-t border-white/10 bg-black/95 backdrop-blur-md"
          >
            <div className="px-4 py-4 flex flex-col gap-3">
              {/* Deposit & Withdraw only */}
              {user && (
                <div className="flex gap-3">
                  <button
                    onClick={() => { setDepositOpen(true); setMobileMenuOpen(false); }}
                    className="flex-1 py-3 rounded-xl font-orbitron text-sm font-bold tracking-widest text-black"
                    style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}>
                    {polling ? 'PENDING...' : '💳 DEPOSIT'}
                  </button>
                  <button
                    onClick={() => { setWithdrawOpen(true); setMobileMenuOpen(false); }}
                    className="flex-1 py-3 rounded-xl font-orbitron text-sm font-bold tracking-widest border border-red-400/50 text-red-400 hover:bg-red-400/10 transition-colors">
                    💸 WITHDRAW
                  </button>
                </div>
              )}

              {/* Sign in if not logged in */}
              {!user && (
                <button onClick={() => { setMobileMenuOpen(false); navigate('/auth/login'); }}
                  className="w-full py-3 rounded-xl font-orbitron text-sm font-bold tracking-widest text-black"
                  style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}>
                  SIGN IN
                </button>
              )}

              {/* Username display */}
              {user && profile?.username && (
                <p className="text-center text-white/30 text-xs font-orbitron">
                  Signed in as <span className="text-cyan-400">{profile.username}</span>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <LeaderboardModal isOpen={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} />
      <DepositModal isOpen={depositOpen} onClose={() => setDepositOpen(false)} onPolling={handlePolling} />
      <WithdrawalModal isOpen={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
      <SettingsModal />
    </nav>
  );
}
