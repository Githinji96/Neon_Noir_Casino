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

interface NavbarProps {
  activeTab?: string;
}

const NAV_LINKS = [
  { label: 'Slots', path: '/slots' },
  { label: 'Live Tables', path: '/live-tables' },
  { label: 'Jackpots', path: '/jackpots' },
  { label: 'VIP', path: '/vip' },
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

  // gameStore.balance is the live source of truth (updated every spin).
  // profile.balance is only used as the seed on first load via authStore.init.
  const displayBalance = balance;

  // Poll transaction after STK push — clears after 10s (2 attempts × 5s)
  const handlePolling = (checkoutId: string) => {
    if (!checkoutId) return;
    setPolling(true);
    let attempts = 0;
    const MAX = 24; // poll for 2 minutes (24 × 5s)

    const syncBalance = async () => {
      const { data: prof } = await supabase
        .from('profiles').select('balance').eq('id', user?.id).single();
      if (prof) {
        useAuthStore.setState((s) => ({
          profile: s.profile ? { ...s.profile, balance: prof.balance } : null,
        }));
        const { useGameStore } = await import('../store/gameStore');
        useGameStore.setState({ balance: prof.balance });
      }
    };

    const safetyTimer = setTimeout(() => {
      clearInterval(interval);
      setPolling(false);
    }, 125000);

    const interval = setInterval(async () => {
      attempts++;

      // First check our DB (callback may have already updated it)
      const { data } = await supabase
        .from('transactions').select('status').eq('checkout_request_id', checkoutId).single();

      if (data?.status === 'success') {
        clearInterval(interval);
        clearTimeout(safetyTimer);
        setPolling(false);
        await syncBalance();
        return;
      }

      if (data?.status === 'failed') {
        clearInterval(interval);
        clearTimeout(safetyTimer);
        setPolling(false);
        return;
      }

      // After 30s (6 attempts), query Safaricom directly as fallback
      if (attempts >= 6 && data?.status === 'pending') {
        try {
          const session = (await supabase.auth.getSession()).data.session;
          const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL.replace('.supabase.co', '.supabase.co/functions/v1');
          const res = await fetch(`${FUNCTIONS_URL}/mpesa-stk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
            body: JSON.stringify({ action: 'query', checkoutRequestId: checkoutId }),
          });
          const result = await res.json();
          if (result.status === 'success') {
            clearInterval(interval);
            clearTimeout(safetyTimer);
            setPolling(false);
            await syncBalance();
          } else if (result.status === 'failed') {
            clearInterval(interval);
            clearTimeout(safetyTimer);
            setPolling(false);
          }
        } catch { /* ignore query errors */ }
      }

      if (attempts >= MAX) {
        clearInterval(interval);
        clearTimeout(safetyTimer);
        setPolling(false);
      }
    }, 5000);
  };

  const handleSignOut = async () => {
    await signOut();
    // Reset game balance so it doesn't show stale value after logout
    const { useGameStore } = await import('../store/gameStore');
    useGameStore.setState({ balance: 0 });
    navigate('/auth/login');
  };

  const isActive = (path: string) =>
    activeTab ? activeTab === path : location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/10 shadow-glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            className="font-orbitron font-bold tracking-widest text-neon-yellow text-lg shrink-0"
            style={{ textShadow: '0 0 8px rgba(255,215,0,0.6)' }}
          >
            NEON NOIR CASINO
          </Link>

          {/* Desktop Nav Links */}
          <ul className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(({ label, path }) => (
              <li key={path}>
                <Link
                  to={path}
                  className={`font-orbitron text-sm tracking-wider transition-colors duration-250 ${
                    isActive(path)
                      ? 'text-neon-yellow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  style={isActive(path) ? { textShadow: '0 0 8px rgba(255,215,0,0.6)' } : undefined}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Right Side */}
          <div className="hidden md:flex items-center gap-3">
            {/* Balance + Deposit — only shown when logged in */}
            {user && (
              <>
                <span className="font-orbitron text-sm text-neon-yellow font-bold tracking-wider"
                  style={{ textShadow: '0 0 8px rgba(255,215,0,0.4)' }}>
                  {formatBalance(displayBalance)}
                </span>
                <button
                  onClick={() => !polling && setDepositOpen(true)}
                  className="btn-neon px-4 py-1.5 rounded-full text-xs font-orbitron tracking-widest flex items-center gap-1.5"
                >
                  {polling ? (
                    <>
                      <span className="w-3 h-3 rounded-full border-2 border-black border-t-transparent animate-spin" />
                      PENDING...
                    </>
                  ) : 'DEPOSIT'}
                </button>
                <button
                  onClick={() => setWithdrawOpen(true)}
                  className="btn-neon px-4 py-1.5 rounded-full text-xs font-orbitron tracking-widest"
                >
                  WITHDRAW
                </button>
              </>
            )}

            {/* Leaderboard */}
            <button
              aria-label="Leaderboard"
              onClick={() => setLeaderboardOpen(true)}
              className="text-gray-400 hover:text-neon-yellow transition-colors duration-250 text-xl"
              title="Leaderboard"
            >
              🏆
            </button>

            {/* Auth */}
            {user ? (
              <div className="flex items-center gap-2">
                <span className="font-orbitron text-xs text-cyan-400 tracking-wider">{profile?.username}</span>
                <button
                  onClick={handleSignOut}
                  className="text-gray-400 hover:text-red-400 transition-colors text-xs font-orbitron tracking-wider"
                >
                  OUT
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('/auth/login')}
                aria-label="Sign In"
                className="text-gray-400 hover:text-neon-yellow transition-colors duration-250 text-xl"
              >
                👤
              </button>
            )}
            <button
              aria-label="Notifications"
              className="text-gray-400 hover:text-neon-yellow transition-colors duration-250 text-xl"
            >
              🔔
            </button>
            <button
              aria-label="Settings"
              onClick={openSettings}
              className="text-gray-400 hover:text-neon-yellow transition-colors duration-250 text-xl"
            >
              ⚙️
            </button>
          </div>

          {/* Mobile: show balance only when logged in + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            {user && (
              <span className="font-orbitron text-xs text-neon-yellow font-bold tracking-wider"
                style={{ textShadow: '0 0 8px rgba(255,215,0,0.4)' }}>
                {formatBalance(displayBalance)}
              </span>
            )}
            <button
              className="text-gray-300 hover:text-neon-yellow transition-colors duration-250 text-2xl"
              aria-label="Toggle menu"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-black/80 backdrop-blur-md border-t border-white/10 px-4 pb-4">
          <ul className="flex flex-col gap-4 pt-4">
            {NAV_LINKS.map(({ label, path }) => (
              <li key={path}>
                <Link
                  to={path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block font-orbitron text-sm tracking-wider transition-colors duration-250 ${
                    isActive(path)
                      ? 'text-neon-yellow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  style={isActive(path) ? { textShadow: '0 0 8px rgba(255,215,0,0.6)' } : undefined}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Mobile balance + actions */}
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/10">
            {user && (
              <>
                <span className="font-orbitron text-sm text-neon-yellow font-bold tracking-wider flex-1">
                  {formatBalance(displayBalance)}
                </span>
                <button
                  onClick={() => !polling && setDepositOpen(true)}
                  className="btn-neon px-4 py-1.5 rounded-full text-xs font-orbitron tracking-widest flex items-center gap-1.5">
                  {polling ? (
                    <>
                      <span className="w-3 h-3 rounded-full border-2 border-black border-t-transparent animate-spin" />
                      PENDING...
                    </>
                  ) : 'DEPOSIT'}
                </button>
              </>
            )}
            <button aria-label="Leaderboard" onClick={() => setLeaderboardOpen(true)} className="text-gray-400 hover:text-neon-yellow transition-colors duration-250 text-xl">🏆</button>
            {user ? (
              <button onClick={handleSignOut} className="text-gray-400 hover:text-red-400 transition-colors text-xs font-orbitron tracking-wider">OUT</button>
            ) : (
              <button aria-label="Sign In" onClick={() => navigate('/auth/login')} className="text-gray-400 hover:text-neon-yellow transition-colors duration-250 text-xl">👤</button>
            )}
            <button aria-label="Notifications" className="text-gray-400 hover:text-neon-yellow transition-colors duration-250 text-xl">🔔</button>
            <button aria-label="Settings" onClick={openSettings} className="text-gray-400 hover:text-neon-yellow transition-colors duration-250 text-xl">⚙️</button>
          </div>
        </div>
      )}

      <LeaderboardModal isOpen={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} />
      <DepositModal isOpen={depositOpen} onClose={() => setDepositOpen(false)} onPolling={handlePolling} />
      <WithdrawalModal isOpen={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
      <SettingsModal />
    </nav>
  );
}
