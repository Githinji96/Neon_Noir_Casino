/**
 * BottomNav — mobile bottom navigation bar (hidden on md+ screens).
 *
 * Uses React Router for real navigation. Active state is derived from
 * the current pathname — no external props needed.
 *
 * Routes:
 *   🏠 Home     → /
 *   🎁 Promos   → /vip        (VIP/promotions hub — no separate promo route exists)
 *   🎰 Spin     → /slot       (casino lobby redirected via CasinoLobby, or direct)
 *   📜 History  → /notifications (player activity feed)
 *   💬 Support  → /contact
 */
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface NavItem {
  id:        string;
  label:     string;
  icon:      string;
  path:      string;
  /** true when this item needs an active session to navigate */
  protected: boolean;
  isSpin:    boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home',    label: 'Home',    icon: '🏠', path: '/',             protected: false, isSpin: false },
  { id: 'promos',  label: 'Promos',  icon: '🎁', path: '/vip',          protected: false, isSpin: false },
  { id: 'spin',    label: 'Spin',    icon: '🎰', path: '/slot',         protected: true,  isSpin: true  },
  { id: 'history', label: 'History', icon: '📜', path: '/notifications', protected: false, isSpin: false },
  { id: 'support', label: 'Support', icon: '💬', path: '/contact',      protected: false, isSpin: false },
];

/** Derive which nav item is active from the current pathname. */
function getActiveId(pathname: string): string {
  if (pathname === '/')              return 'home';
  if (pathname.startsWith('/vip'))   return 'promos';
  if (pathname.startsWith('/slot'))  return 'spin';
  if (pathname.startsWith('/notifications')) return 'history';
  if (pathname.startsWith('/contact')) return 'support';
  return '';
}

export default function BottomNav() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const user      = useAuthStore((s) => s.user);
  const activeId  = getActiveId(location.pathname);

  // Pages where the bottom nav should not appear (immersive full-screen views)
  const hidden = ['/slot', '/live-tables/'].some((p) => location.pathname.startsWith(p))
    || location.pathname.startsWith('/admin');

  if (hidden) return null;

  function handleClick(item: NavItem, e: React.MouseEvent) {
    if (item.isSpin) {
      e.preventDefault();
      if (!user) {
        // Not logged in — go to login with redirect state
        navigate('/auth/login', { state: { from: { pathname: '/slot' } } });
      } else {
        // Navigate to lobby (home) so player can pick a game,
        // or go directly to the default slot game
        navigate('/slot', { state: { id: 'neon-jungle-fruits', title: 'Neon Jungle Fruits', jackpotMode: false } });
      }
    }
    // All other items use standard <Link> navigation
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[100] md:hidden"
      role="navigation"
      aria-label="Mobile bottom navigation"
      style={{
        background:    'rgba(5, 5, 8, 0.96)',
        backdropFilter: 'blur(12px)',
        borderTop:     '1px solid rgba(255, 215, 0, 0.18)',
        boxShadow:     '0 -4px 24px rgba(0, 0, 0, 0.6), 0 -1px 0 rgba(255, 215, 0, 0.08)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-end justify-around px-1 pt-2 pb-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activeId === item.id;

          if (item.isSpin) {
            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={(e) => handleClick(item, e)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className="flex-1 flex flex-col items-center gap-0.5 -mt-5 outline-none focus-visible:outline-none"
              >
                {/* Elevated circular Spin button */}
                <span
                  className="flex items-center justify-center rounded-full text-2xl transition-all duration-200"
                  style={{
                    width:      'clamp(52px, 14vw, 60px)',
                    height:     'clamp(52px, 14vw, 60px)',
                    background: isActive
                      ? 'linear-gradient(135deg, #FFD700, #FFA500)'
                      : 'linear-gradient(135deg, #FFD700ee, #FFA500cc)',
                    boxShadow: isActive
                      ? '0 0 20px rgba(255,215,0,0.7), 0 0 40px rgba(255,215,0,0.3)'
                      : '0 0 12px rgba(255,215,0,0.45)',
                    transform:  isActive ? 'scale(1.08)' : 'scale(1)',
                  }}
                >
                  {item.icon}
                </span>
                <span
                  className="font-orbitron font-bold tracking-wider"
                  style={{
                    fontSize: 'clamp(8px, 2.2vw, 10px)',
                    color:     isActive ? '#FFD700' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.id}
              to={item.path}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className="flex-1 flex flex-col items-center gap-0.5 py-1 min-h-[44px] justify-center outline-none focus-visible:outline-none"
              style={{ minWidth: 44 }}
            >
              <span
                className="transition-all duration-200 leading-none"
                style={{
                  fontSize:  'clamp(18px, 5vw, 22px)',
                  transform:  isActive ? 'scale(1.15)' : 'scale(1)',
                  filter:     isActive ? 'drop-shadow(0 0 6px rgba(255,215,0,0.6))' : 'none',
                }}
              >
                {item.icon}
              </span>
              <span
                className="font-orbitron font-medium tracking-wider"
                style={{
                  fontSize: 'clamp(8px, 2.2vw, 10px)',
                  color:     isActive ? '#FFD700' : 'rgba(255,255,255,0.4)',
                  transition: 'color 0.2s',
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
