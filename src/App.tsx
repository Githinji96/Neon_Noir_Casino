import { useEffect, useState, Component, type ReactNode, lazy, Suspense, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, Outlet } from 'react-router-dom';
import CasinoLobby from './pages/CasinoLobby';
import { useAuthStore } from './store/authStore';
import { useAdminStore } from './store/adminStore';
import AdminAuthGuard from './components/admin/AdminAuthGuard';
import MusicManager from './components/MusicManager';
import Footer from './components/Footer';
import BottomNav from './components/BottomNav';
import ScrollToTop from './components/ScrollToTop';

// ── Lazy-load every page that isn't the landing (CasinoLobby) ────────────────
// This keeps the initial bundle small — pages only load when the user navigates.
const SlotMachinePage        = lazy(() => import('./pages/SlotMachine'));
const JackpotsPage           = lazy(() => import('./pages/JackpotsPage'));
const LiveTablesPage         = lazy(() => import('./pages/LiveTablesPage'));
const LiveTableRoom          = lazy(() => import('./pages/LiveTableRoom'));
const VIPPage                = lazy(() => import('./pages/VIPPage'));
const NotificationsPage      = lazy(() => import('./pages/NotificationsPage'));
const LoginPage              = lazy(() => import('./pages/auth/LoginPage'));
const SignUpPage             = lazy(() => import('./pages/auth/SignUpPage'));
const ForgotPasswordPage     = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage      = lazy(() => import('./pages/auth/ResetPasswordPage'));
const AuthCallbackPage       = lazy(() => import('./pages/auth/AuthCallbackPage'));
const PrivacyPolicyPage      = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsAndConditionsPage = lazy(() => import('./pages/TermsAndConditionsPage'));
const ContactPage            = lazy(() => import('./pages/ContactPage'));

// ── Admin pages (already lazy) ────────────────────────────────────────────────
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
const WithdrawalsPage     = lazy(() => import('./pages/admin/WithdrawalsPage'));
const SupportTicketsPage  = lazy(() => import('./pages/admin/SupportTicketsPage'));
const CasinoFinancialPage = lazy(() => import('./pages/admin/CasinoFinancialPage'));
const BetHistoryPage      = lazy(() => import('./pages/admin/BetHistoryPage'));

// Minimal spinner — used as Suspense fallback for all lazy pages
const PageFallback = () => (
  <div className="min-h-screen bg-gray-950 flex items-center justify-center">
    <div className="w-10 h-10 rounded-full border-4 border-yellow-400 border-t-transparent animate-spin" />
  </div>
);

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      // Never expose stack traces or internal error messages in production
      const isDev = import.meta.env.DEV;
      return (
        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="font-orbitron text-red-400 text-lg tracking-widest">SOMETHING WENT WRONG</p>
          {isDev && (
            <p className="text-gray-500 text-sm font-mono">{(this.state.error as Error).message}</p>
          )}
          {!isDev && (
            <p className="text-gray-500 text-sm">An unexpected error occurred. Please refresh the page.</p>
          )}
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

/** Layout wrapper that adds the Footer and mobile BottomNav to all public pages */
function PublicLayout() {
  const location = useLocation();
  // Don't show footer inside the slot machine or live table room (immersive pages)
  const noFooter = ['/slot', '/live-tables/'].some((p) => location.pathname.startsWith(p));
  return (
    <>
      <Outlet />
      {!noFooter && <Footer />}
      {/* Mobile bottom navigation — renders on all public pages, hides itself on /slot */}
      <BottomNav />
    </>
  );
}

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const init = useAuthStore((s) => s.init);
  const adminInit = useAdminStore((s) => s.init);
  const preWarmedRef = useRef(false);

  // Initialise player auth once on mount
  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-warm admin store as soon as the URL looks like an admin page —
  // fires before AdminAuthGuard mounts, so the DB fetch is already in-flight
  // when the guard checks the store, eliminating most of the visible delay.
  useEffect(() => {
    if (preWarmedRef.current) return;
    if (location.pathname.startsWith('/admin') && location.pathname !== '/admin/login') {
      preWarmedRef.current = true;
      void adminInit();
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // Single Suspense boundary wraps all routes — eliminates per-route wrapper noise
    // while still showing the spinner for any lazy-loaded page transition.
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Public routes — wrapped in PublicLayout which adds the Footer */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<CasinoLobby onNavigateToSlot={(id?: string, title?: string, jackpotMode?: boolean) => navigate('/slot', { state: { id, title, jackpotMode } })} />} />
          <Route path="/jackpots" element={<JackpotsPage />} />
          <Route path="/vip" element={<VIPPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/live-tables" element={<LiveTablesPage />} />
          <Route path="/live-tables/:tableId" element={<LiveTableRoom />} />
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/signup" element={<SignUpPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsAndConditionsPage />} />
          <Route path="/contact" element={<ContactPage />} />

          {/* Protected routes — require active session */}
          <Route element={<ProtectedRoute />}>
            <Route path="/slot" element={<SlotMachinePage onBack={() => navigate('/')} />} />
          </Route>
        </Route>

        {/* ── Admin routes ─────────────────────────────────────────── */}
        <Route path="/admin/login" element={<AdminLoginPage />} />

        {/* /admin → redirect to dashboard */}
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

        {/* Role-gated admin layout — single outer guard checks auth,
            inner guards check role permissions without re-running init */}
        <Route element={
          <AdminAuthGuard requiredRoles={['super_admin','finance_admin','support_agent','game_manager']} />
        }>
          <Route element={<AdminLayout />}>
            <Route path="/admin/dashboard" element={<DashboardPage />} />
            <Route element={<AdminAuthGuard requiredRoles={['super_admin','finance_admin','game_manager']} />}>
              <Route path="/admin/analytics" element={<AnalyticsPage />} />
            </Route>
            <Route element={<AdminAuthGuard requiredRoles={['super_admin','support_agent']} />}>
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/users/:userId" element={<UserDetailPage />} />
              <Route path="/admin/users/:userId/bet-history" element={<BetHistoryPage />} />
            </Route>
            <Route element={<AdminAuthGuard requiredRoles={['super_admin','finance_admin']} />}>
              <Route path="/admin/finance" element={<FinancePage />} />
              <Route path="/admin/withdrawals" element={<WithdrawalsPage />} />
              <Route path="/admin/casino-financial" element={<CasinoFinancialPage />} />
            </Route>
            <Route element={<AdminAuthGuard requiredRoles={['super_admin','game_manager']} />}>
              <Route path="/admin/games" element={<GamesPage />} />
              <Route path="/admin/rtp" element={<RTPPage />} />
              <Route path="/admin/jackpots" element={<AdminJackpotsPage />} />
              <Route path="/admin/live-tables" element={<LiveTablesAdminPage />} />
            </Route>
            <Route element={<AdminAuthGuard requiredRoles={['super_admin', 'support_agent']} />}>
              <Route path="/admin/fraud" element={<FraudPage />} />
              <Route path="/admin/audit" element={<AuditPage />} />
            </Route>
            <Route element={<AdminAuthGuard requiredRoles={['super_admin','support_agent']} />}>
              <Route path="/admin/support-tickets" element={<SupportTicketsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ScrollToTop />
        <MusicManager />
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
