import { useEffect, useState, Component, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Outlet } from 'react-router-dom';
import CasinoLobby from './pages/CasinoLobby';
import SlotMachinePage from './pages/SlotMachine';
import LoginPage from './pages/auth/LoginPage';
import SignUpPage from './pages/auth/SignUpPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import { useAuthStore } from './store/authStore';

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

  return user ? <Outlet /> : <Navigate to="/auth/login" replace />;
}

function AppRoutes() {
  const navigate = useNavigate();
  const init = useAuthStore((s) => s.init);

  // Initialise auth once on mount
  useEffect(() => { init(); }, []);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<CasinoLobby onNavigateToSlot={(id?: string, title?: string) => navigate('/slot', { state: { id, title } })} />} />
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/signup" element={<SignUpPage />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

      {/* Protected routes — require active session */}
      <Route element={<ProtectedRoute />}>
        <Route path="/slot" element={<SlotMachinePage onBack={() => navigate('/')} />} />
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
