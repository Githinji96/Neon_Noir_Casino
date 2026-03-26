import { useEffect, useState, Component, type ReactNode, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, Outlet } from 'react-router-dom';
import CasinoLobby from './pages/CasinoLobby';
import SlotMachinePage from './pages/SlotMachine';
import JackpotsPage from './pages/JackpotsPage';
import LiveTablesPage from './pages/LiveTablesPage';
import LiveTableRoom from './pages/LiveTableRoom';
import LoginPage from './pages/auth/LoginPage';
import SignUpPage from './pages/auth/SignUpPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import { useAuthStore } from './store/authStore';
import AdminAuthGuard from './components/admin/AdminAuthGuard';

// Lazy-load admin pages to keep main bundle small
const AdminLoginPage      = lazy(() => import('./pages/admin/AdminLoginPage'));
const AdminLayout         = lazy(() => import('./components/admin/AdminLayout'));
const DashboardPage       = lazy(() => import('./pages/admin/DashboardPage'));
const UsersPage           = lazy(() => import('./pages/admin/UsersPage'));
const UserDetailPage      = lazy(() => import('./pages/admin/UserDetailPage'));
const FinancePage         = lazy(() => import('./pages/admin/FinancePage'));
const GamesPage           = lazy(() => import('./pages/admin/GamesPage'));
const RTPPage             = lazy(() => import('./pages/admin/RTPPage'));
const AdminJackpotsPage   = lazy(() => import('./pages/admin/AdminJackpotsPage'));
const LiveTablesAdminPage = lazy(() => import('./pages/admin/LiveTablesAdminPage'));
const AnalyticsPage       = lazy(() => import('./pages/admin/AnalyticsPage'));
const FraudPage           = lazy(() => import('./pages/admin/FraudPage'));
const AuditPage           = lazy(() => import('./pages/admin/AuditPage'));

const AdminFallback = () => (
  <div className="min-h-screen bg-gray-950 flex items-center justify-center">
    <div className="w-10 h-10 rounded-full border-4 border-yellow-400 border-t-transparent animate-spin" />
  </div>
);

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="font-orbitron text-red-400 text-lg tracking-widest">SOMETHING WENT WRONG</p>
          <p className="text-gray-500 text-sm font-mono">{(this.state.error as Error).message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 rounded-full font-orbitron text-xs tracking-widest border border-yellow-300 text-yellow-300 hover:bg-yellow-300/10 transition-colors"
          >
            RELOAD
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Redirects to /auth/login if the user has no active session. */
function ProtectedRoute() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const [timedOut, setTimedOut] = useState(false);
  const location = useLocation();

  // Safety net: if loading takes > 4s, unblock and treat as unauthenticated
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, [loading]);

  if (loading && !timedOut) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-yellow-300 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Pass current location as state so login page can redirect back after auth
  return user ? <Outlet /> : <Navigate to="/auth/login" state={{ from: location }} replace />;
}

function AppRoutes() {
  const navigate = useNavigate();
  const init = useAuthStore((s) => s.init);

  // Initialise auth once on mount — admin init is handled by AdminAuthGuard
  useEffect(() => { init(); }, []);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<CasinoLobby onNavigateToSlot={(id?: string, title?: string) => navigate('/slot', { state: { id, title } })} />} />
      <Route path="/jackpots" element={<JackpotsPage />} />
      <Route path="/live-tables" element={<LiveTablesPage />} />
      <Route path="/live-tables/:tableId" element={<LiveTableRoom />} />
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/signup" element={<SignUpPage />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

      {/* Protected routes — require active session */}
      <Route element={<ProtectedRoute />}>
        <Route path="/slot" element={<SlotMachinePage onBack={() => navigate('/')} />} />
      </Route>

      {/* ── Admin routes ─────────────────────────────────────────── */}
      <Route path="/admin/login" element={
        <Suspense fallback={<AdminFallback />}><AdminLoginPage /></Suspense>
      } />

      {/* /admin → redirect to dashboard */}
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

      {/* Role-gated admin layout */}
      <Route element={
        <AdminAuthGuard requiredRoles={['super_admin','finance_admin','support_agent','game_manager']} />
      }>
        <Route element={<Suspense fallback={<AdminFallback />}><AdminLayout /></Suspense>}>
          {/* Dashboard — super_admin, finance_admin */}
          <Route element={<AdminAuthGuard requiredRoles={['super_admin','finance_admin']} />}>
            <Route path="/admin/dashboard" element={<Suspense fallback={<AdminFallback />}><DashboardPage /></Suspense>} />
            <Route path="/admin/analytics" element={<Suspense fallback={<AdminFallback />}><AnalyticsPage /></Suspense>} />
          </Route>

          {/* Users — super_admin, support_agent */}
          <Route element={<AdminAuthGuard requiredRoles={['super_admin','support_agent']} />}>
            <Route path="/admin/users" element={<Suspense fallback={<AdminFallback />}><UsersPage /></Suspense>} />
            <Route path="/admin/users/:userId" element={<Suspense fallback={<AdminFallback />}><UserDetailPage /></Suspense>} />
          </Route>

          {/* Finance — super_admin, finance_admin */}
          <Route element={<AdminAuthGuard requiredRoles={['super_admin','finance_admin']} />}>
            <Route path="/admin/finance" element={<Suspense fallback={<AdminFallback />}><FinancePage /></Suspense>} />
          </Route>

          {/* Games / RTP / Jackpots / Live Tables — super_admin, game_manager */}
          <Route element={<AdminAuthGuard requiredRoles={['super_admin','game_manager']} />}>
            <Route path="/admin/games" element={<Suspense fallback={<AdminFallback />}><GamesPage /></Suspense>} />
            <Route path="/admin/rtp" element={<Suspense fallback={<AdminFallback />}><RTPPage /></Suspense>} />
            <Route path="/admin/jackpots" element={<Suspense fallback={<AdminFallback />}><AdminJackpotsPage /></Suspense>} />
            <Route path="/admin/live-tables" element={<Suspense fallback={<AdminFallback />}><LiveTablesAdminPage /></Suspense>} />
          </Route>

          {/* Fraud + Audit — super_admin only */}
          <Route element={<AdminAuthGuard requiredRoles={['super_admin']} />}>
            <Route path="/admin/fraud" element={<Suspense fallback={<AdminFallback />}><FraudPage /></Suspense>} />
            <Route path="/admin/audit" element={<Suspense fallback={<AdminFallback />}><AuditPage /></Suspense>} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
