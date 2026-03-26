import { useNavigate } from 'react-router-dom';
import { useAdminStore } from '../../store/adminStore';
import type { AdminRole } from '../../store/adminStore';

interface AdminTopbarProps {
  title: string;
  onMenuClick?: () => void;
}

const roleBadge: Record<AdminRole, string> = {
  super_admin: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  finance_admin: 'bg-green-500/20 text-green-400 border border-green-500/30',
  support_agent: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  game_manager: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
};

const roleLabel: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  finance_admin: 'Finance',
  support_agent: 'Support',
  game_manager: 'Game Mgr',
};

export default function AdminTopbar({ title, onMenuClick }: AdminTopbarProps) {
  const navigate = useNavigate();
  const { adminProfile, unreadAlertCount, signOut } = useAdminStore();

  async function handleSignOut() {
    await signOut();
    navigate('/admin/login');
  }

  return (
    <header className="h-16 bg-black/40 backdrop-blur border-b border-white/10 flex items-center px-4 gap-4 sticky top-0 z-30">
      {/* Hamburger (mobile) */}
      <button
        onClick={onMenuClick}
        className="md:hidden text-white/60 hover:text-white transition-colors text-xl"
        aria-label="Open menu"
      >
        ☰
      </button>

      {/* Logo */}
      <span className="font-orbitron font-bold text-[#FFD700] tracking-widest text-lg shrink-0">
        NEON NOIR
      </span>

      {/* Page title */}
      <div className="flex-1 flex justify-center">
        <h1 className="font-orbitron text-sm font-semibold text-white/70 uppercase tracking-widest">
          {title}
        </h1>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Notification bell */}
        <div className="relative">
          <span className="text-xl text-white/60 cursor-pointer hover:text-white transition-colors">
            🔔
          </span>
          {unreadAlertCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
              {unreadAlertCount > 99 ? '99+' : unreadAlertCount}
            </span>
          )}
        </div>

        {/* User info */}
        {adminProfile && (
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-white/70 text-sm">{adminProfile.username}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${roleBadge[adminProfile.admin_role]}`}>
              {roleLabel[adminProfile.admin_role]}
            </span>
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="text-white/40 hover:text-red-400 transition-colors text-sm px-2 py-1 rounded-lg hover:bg-red-500/10"
          aria-label="Sign out"
        >
          ⏻
        </button>
      </div>
    </header>
  );
}
