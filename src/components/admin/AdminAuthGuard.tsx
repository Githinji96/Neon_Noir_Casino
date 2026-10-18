import { useEffect, useRef, useState, useCallback } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useAdminStore, AdminRole } from '../../store/adminStore';
import { hasRequiredAdminRole } from './adminAccess';
import {
  WARN_BEFORE_MS,
  ACTIVITY_EVENTS,
  touchActivity,
  msUntilLogout,
  broadcastLogout,
  clearActivity,
  clearSupabaseSession,
  LOGOUT_BROADCAST_KEY,
} from '../../lib/sessionManager';

interface AdminAuthGuardProps {
  requiredRoles: AdminRole[];
}

/** How often (ms) the frontend polls the server to validate the admin session */
const POLL_INTERVAL_MS = 5 * 60_000; // 5 minutes

export default function AdminAuthGuard({ requiredRoles }: AdminAuthGuardProps) {
  const { adminProfile, loading, init, checkSession, refreshSession, signOut } = useAdminStore();
  const sessionExpiresAt = useAdminStore((s) => s.sessionExpiresAt);
  const navigate = useNavigate();

  const [timedOut,            setTimedOut]            = useState(false);
  const [sessionStatus,       setSessionStatus]       = useState<'valid' | 'expiring' | 'expired' | null>(null);
  const [countdown,           setCountdown]           = useState(0);
  const [extending,           setExtending]           = useState(false);
  const [inactivityWarning,   setInactivityWarning]   = useState(false);
  const [inactivityCountdown, setInactivityCountdown] = useState(0);

  const pollRef           = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const inactivityRef     = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const inactivityWarnRef = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const inactivityTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logoutFiredRef    = useRef(false);

  // Always revalidate on mount
  useEffect(() => {
    void init();
    const t = setTimeout(() => setTimedOut(true), 5500);
    return () => clearTimeout(t);
  }, [init]);

  // Handle expired session → redirect immediately, cleanup async
  const handleExpired = useCallback((reason: string = 'timeout') => {
    if (logoutFiredRef.current) return;
    logoutFiredRef.current = true;
    if (pollRef.current)     clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    clearActivity();
    clearSupabaseSession();
    broadcastLogout();
    // Clear admin state synchronously so the guard redirects without waiting for network
    useAdminStore.setState({ adminProfile: null, alerts: [], unreadAlertCount: 0, sessionExpiresAt: null });
    void signOut(); // fire-and-forget cleanup (uses scope: 'local')
    navigate(`/admin/login?reason=${reason}`, { replace: true });
  }, [signOut, navigate]);

  // ── Inactivity detection — timestamp-based ────────────────────────────────
  const clearInactivityTimers = useCallback(() => {
    if (inactivityRef.current)     clearTimeout(inactivityRef.current);
    if (inactivityWarnRef.current) clearTimeout(inactivityWarnRef.current);
    if (inactivityTickRef.current) clearInterval(inactivityTickRef.current);
    inactivityRef.current     = null;
    inactivityWarnRef.current = null;
    inactivityTickRef.current = null;
  }, []);

  const scheduleInactivityLogout = useCallback(() => {
    clearInactivityTimers();
    setInactivityWarning(false);

    const remaining = msUntilLogout();

    if (remaining <= 0) {
      handleExpired('inactivity');
      return;
    }

    if (remaining <= WARN_BEFORE_MS) {
      // Already in warning window (e.g. tab restored after sleep)
      setInactivityWarning(true);
      setInactivityCountdown(Math.round(remaining / 1000));
      inactivityTickRef.current = setInterval(() => {
        const r = msUntilLogout();
        setInactivityCountdown(Math.round(r / 1000));
        if (r <= 0) {
          if (inactivityTickRef.current) clearInterval(inactivityTickRef.current);
          handleExpired('inactivity');
        }
      }, 1000);
      inactivityRef.current = setTimeout(() => handleExpired('inactivity'), remaining);
      return;
    }

    // Normal: schedule warning banner, then hard logout
    inactivityWarnRef.current = setTimeout(() => {
      setInactivityWarning(true);
      setInactivityCountdown(Math.round(WARN_BEFORE_MS / 1000));
      inactivityTickRef.current = setInterval(() => {
        const r = msUntilLogout();
        setInactivityCountdown(Math.round(r / 1000));
        if (r <= 0) {
          if (inactivityTickRef.current) clearInterval(inactivityTickRef.current);
          handleExpired('inactivity');
        }
      }, 1000);
    }, remaining - WARN_BEFORE_MS);

    inactivityRef.current = setTimeout(() => handleExpired('inactivity'), remaining);
  }, [clearInactivityTimers, handleExpired]);

  // Register activity listeners when admin is logged in
  useEffect(() => {
    if (!adminProfile) return;

    logoutFiredRef.current = false;
    touchActivity(); // stamp activity on admin login/route enter

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const onActivity = () => {
      if (debounceTimer) return;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        touchActivity();
        setInactivityWarning(false);
        scheduleInactivityLogout();
      }, 1000);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Pause timers — localStorage timestamp is the source of truth
        clearInactivityTimers();
      } else {
        // Resume: check deadline immediately (handles browser sleep/suspend)
        scheduleInactivityLogout();
      }
    };

    // Cross-tab logout (from player or another admin tab)
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOGOUT_BROADCAST_KEY && e.newValue) {
        handleExpired('inactivity');
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('storage', onStorage);
    ACTIVITY_EVENTS.forEach((evt) => document.addEventListener(evt, onActivity, { passive: true }));
    scheduleInactivityLogout();

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('storage', onStorage);
      ACTIVITY_EVENTS.forEach((evt) => document.removeEventListener(evt, onActivity));
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInactivityTimers();
    };
  }, [adminProfile, scheduleInactivityLogout, clearInactivityTimers, handleExpired]);

  // Session polling — server-authoritative check every 5 minutes
  useEffect(() => {
    if (!adminProfile) return;

    const poll = async () => {
      const status = await checkSession();
      setSessionStatus(status);
      if (status === 'expired') handleExpired('timeout');
    };

    void poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [adminProfile, checkSession, handleExpired]);

  // Countdown ticker when session is expiring (server-side expiry)
  useEffect(() => {
    if (sessionStatus !== 'expiring' || !sessionExpiresAt) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.floor(
        (new Date(sessionExpiresAt).getTime() - Date.now()) / 1000,
      ));
      setCountdown(remaining);
      if (remaining <= 0) handleExpired('timeout');
    };

    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [sessionStatus, sessionExpiresAt, handleExpired]);

  // Extend server-side session
  const handleExtend = async () => {
    setExtending(true);
    const ok = await refreshSession();
    setExtending(false);
    if (ok) {
      setSessionStatus('valid');
    } else {
      handleExpired('timeout');
    }
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loading && !timedOut) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-yellow-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!adminProfile) return <Navigate to="/admin/login" replace />;

  if (!hasRequiredAdminRole(requiredRoles, adminProfile.admin_role)) {
    return <Navigate to="/" replace state={{ accessDenied: true }} />;
  }

  return (
    <>
      {/* ── Inactivity warning banner ── */}
      {inactivityWarning && inactivityCountdown > 0 && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-4 px-5 py-3"
          style={{
            background: 'linear-gradient(90deg, rgba(239,68,68,0.15), rgba(239,68,68,0.08))',
            borderBottom: '1px solid rgba(239,68,68,0.4)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-red-400 text-lg shrink-0" aria-hidden="true">⏱️</span>
            <div className="min-w-0">
              <p className="font-orbitron text-xs text-red-400 font-bold tracking-widest uppercase">
                Session Inactive
              </p>
              <p className="text-red-400/70 text-xs font-mono mt-0.5">
                Auto-logout in{' '}
                <span className="text-red-400 font-bold tabular-nums">{formatCountdown(inactivityCountdown)}</span>
                {' '}— move your mouse or press a key to stay logged in
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              touchActivity();
              setInactivityWarning(false);
              scheduleInactivityLogout();
            }}
            className="shrink-0 px-4 py-1.5 rounded-lg font-orbitron text-xs font-bold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }}
          >
            STAY LOGGED IN
          </button>
        </div>
      )}

      {/* ── Server-side session expiry warning banner ── */}
      {sessionStatus === 'expiring' && countdown > 0 && (
        <div
          role="alert"
          aria-live="polite"
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-4 px-5 py-3"
          style={{
            background: 'linear-gradient(90deg, rgba(234,179,8,0.15), rgba(234,179,8,0.08))',
            borderBottom: '1px solid rgba(234,179,8,0.4)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-yellow-400 text-lg shrink-0" aria-hidden="true">⚠️</span>
            <div className="min-w-0">
              <p className="font-orbitron text-xs text-yellow-400 font-bold tracking-widest uppercase">
                Admin Session Expiring
              </p>
              <p className="text-yellow-400/70 text-xs font-mono mt-0.5">
                Session expires in{' '}
                <span className="text-yellow-400 font-bold tabular-nums">{formatCountdown(countdown)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleExtend}
            disabled={extending}
            className="shrink-0 px-4 py-1.5 rounded-lg font-orbitron text-xs font-bold text-black transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}
          >
            {extending ? 'EXTENDING…' : 'CONTINUE SESSION'}
          </button>
        </div>
      )}

      <Outlet />
    </>
  );
}
