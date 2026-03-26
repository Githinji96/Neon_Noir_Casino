import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminTopbar from './AdminTopbar';
import { ToastProvider } from './ToastProvider';

const PAGE_TITLES: Record<string, string> = {
  '/admin/dashboard':   'Dashboard',
  '/admin/users':       'Users',
  '/admin/finance':     'Finance',
  '/admin/games':       'Games',
  '/admin/rtp':         'RTP Control',
  '/admin/jackpots':    'Jackpots',
  '/admin/live-tables': 'Live Tables',
  '/admin/analytics':   'Analytics',
  '/admin/fraud':       'Fraud & Risk',
  '/admin/audit':       'Audit Logs',
};

function deriveTitle(pathname: string): string {
  // Exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Prefix match (e.g. /admin/users/123 → Users)
  const match = Object.keys(PAGE_TITLES).find((key) => pathname.startsWith(key + '/'));
  return match ? PAGE_TITLES[match] : 'Admin';
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const title = deriveTitle(pathname);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-950 flex">
        <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main area — offset by sidebar on desktop */}
        <div className="flex-1 flex flex-col md:ml-56 min-w-0">
          <AdminTopbar title={title} onMenuClick={() => setSidebarOpen(true)} />

          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
