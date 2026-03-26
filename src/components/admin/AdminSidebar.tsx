import { Link, useLocation } from 'react-router-dom';
import { useAdminStore } from '../../store/adminStore';
import type { AdminRole } from '../../store/adminStore';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  roles: AdminRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',   path: '/admin/dashboard',   icon: '📊', roles: ['super_admin', 'finance_admin'] },
  { label: 'Users',       path: '/admin/users',        icon: '👥', roles: ['super_admin', 'support_agent'] },
  { label: 'Finance',     path: '/admin/finance',      icon: '💰', roles: ['super_admin', 'finance_admin'] },
  { label: 'Games',       path: '/admin/games',        icon: '🎰', roles: ['super_admin', 'game_manager'] },
  { label: 'RTP Control', path: '/admin/rtp',          icon: '📈', roles: ['super_admin', 'game_manager'] },
  { label: 'Jackpots',    path: '/admin/jackpots',     icon: '🎯', roles: ['super_admin', 'game_manager'] },
  { label: 'Live Tables', path: '/admin/live-tables',  icon: '📡', roles: ['super_admin', 'game_manager'] },
  { label: 'Analytics',   path: '/admin/analytics',    icon: '📉', roles: ['super_admin', 'finance_admin'] },
  { label: 'Fraud & Risk',path: '/admin/fraud',        icon: '🚨', roles: ['super_admin'] },
  { label: 'Audit Logs',  path: '/admin/audit',        icon: '📜', roles: ['super_admin'] },
];

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const { adminProfile } = useAdminStore();
  const { pathname } = useLocation();

  const visibleItems = adminProfile
    ? NAV_ITEMS.filter((item) => item.roles.includes(adminProfile.admin_role))
    : [];

  const sidebarContent = (
    <nav className="flex flex-col gap-1 p-3">
      <div className="px-3 py-4 mb-2">
        <span className="font-orbitron font-bold text-[#FFD700] tracking-widest text-base">
          NEON NOIR
        </span>
        <p className="text-white/30 text-xs mt-0.5">Admin Panel</p>
      </div>

      {visibleItems.map((item) => {
        const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isActive
                ? 'text-[#FFD700] border-l-2 border-yellow-400 bg-yellow-400/5 pl-[10px]'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="text-base">{item.icon}</span>
            <span className={isActive ? 'font-semibold' : ''}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-[#0a0a0f] border-r border-white/10 fixed left-0 top-0 h-screen z-20 overflow-y-auto">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <aside className="relative z-50 w-56 bg-[#0a0a0f] border-r border-white/10 h-full overflow-y-auto">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
