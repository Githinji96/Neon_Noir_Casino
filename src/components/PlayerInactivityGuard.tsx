/**
 * PlayerInactivityGuard
 *
 * Enforces a 60-minute inactivity session timeout for authenticated players.
 * Uses localStorage timestamps (not just JavaScript timers) so the deadline
 * survives tab suspension, browser sleep, and multiple open tabs.
 *
 * Features:
 *  - Timestamp-based deadline stored in localStorage (shared across tabs)
 *  - On tab restore: immediately checks if deadline already passed
 *  - Cross-tab logout: detects nn-session-logout key and logs out instantly
 *  - 5-minute warning banner before logout (does NOT auto-reset the timer)
 *  - "STAY SIGNED IN" button: only explicit interaction resets the deadline
 *  - Skips admin routes — AdminAuthGuard handles those independently
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  WARN_BEFORE_MS,
  ACTIVITY_EVENTS,
  touchActivity,
  msUntilLogout,
  broadcastLogout,
  clearActivity,
  clearSupabaseSession,
  LOGOUT_BROADCAST_KEY,
} from '../lib/sessionManager';

function formatCountdown(ms: number): string {
  const totalSecs = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSecs / 60).toString().padStart(2, '0');
  const s = (totalSecs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function PlayerInactivityGuard() {
  const user    = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();

  const [warning, setWarning] = useState(false);
  const [msLeft,  setMsLeft]  = useState(WARN_BEFORE_MS);

  const logoutTimerRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const warnTimerRef    = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks whether this instance already initiated a logout (prevents double-fire)
  const logoutFiredRef  = useRef(false);

  const clearAllTimers = useCallback(() => {
    if (logoutTimerRef.current)  clearTimeout(logoutTimerRef.current);
    if (warnTimerRef.current)    clearTimeout(warnTimerRef.current);
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    logoutTimerRef.current  = null;
    warnTimerRef.current    = null;
    tickIntervalRef.current = null;
  }, []);

  const doSignOut = useCallback(async () => {
    if (logoutFiredRef.current) return; // already in progress
    logoutFiredRef.current = true;
    clearAllTimers();
    clearActivity();
    clearSupabaseSession();   // wipe localStorage token before async signOut
    broadcastLogout();        // tell other tabs to sign out too
    await signOut();
    navigate('/auth/login?reason=inactivity', { replace: true });
  }, [signOut, navigate, clearAllTimers]);

  /**
   * Schedule the warn and logout timers based on the remaining ms until
   * the deadline stored in localStorage. If the deadline is already past,
   * fires immediately (handles tab wake-up after sleep/suspend).
   */
  const scheduleFromDeadline = useCallback(() => {
    clearAllTimers();
    setWarning(false);

    const remaining = msUntilLogout();

    if (remaining <= 0) {
      // Deadline already passed (tab was suspended) — sign out immediately
      void doSignOut();
      return;
    }

    if (remaining <= WARN_BEFORE_MS) {
      // Warning period already started — show banner with remaining time
      setWarning(true);
      setMsLeft(remaining);
      tickIntervalRef.current = setInterval(() => {
        const r = msUntilLogout();
        setMsLeft(r);
        if (r <= 0) {
          if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
          void doSignOut();
        }
      }, 1000);
      // Still schedule the hard logout at the exact remaining time
      logoutTimerRef.current = setTimeout(() => void doSignOut(), remaining);
      return;
    }

    // Normal case: schedule warning then logout
    const warnIn   = remaining - WARN_BEFORE_MS;
    const logoutIn = remaining;

    warnTimerRef.current = setTimeout(() => {
      setWarning(true);
      setMsLeft(WARN_BEFORE_MS);
      tickIntervalRef.current = setInterval(() => {
        const r = msUntilLogout();
        setMsLeft(r);
        if (r <= 0) {
          if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
          void doSignOut();
        }
      }, 1000);
    }, warnIn);

    logoutTimerRef.current = setTimeout(() => void doSignOut(), logoutIn);
  }, [clearAllTimers, doSignOut]);

  useEffect(() => {
    if (!user) {
      clearAllTimers();
      setWarning(false);
      logoutFiredRef.current = false;
      return;
    }

    // Fresh login — stamp activity now
    touchActivity();
    logoutFiredRef.current = false;

    // Debounce: mousemove fires ~60fps — throttle to at most once per second
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const onActivity = () => {
      if (debounce) return;
      debounce = setTimeout(() => {
        debounce = null;
        touchActivity();      // write to localStorage — shared across tabs
        setWarning(false);
        scheduleFromDeadline();
      }, 1000);
    };

    // Tab visibility change — check deadline on restore; pause timers on hide
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Pause timers — JavaScript timers are unreliable when tab is hidden.
        // The deadline in localStorage is the source of truth.
        clearAllTimers();
      } else {
        // Tab restored — immediately check if deadline has passed
        scheduleFromDeadline();
      }
    };

    // Cross-tab logout detection via localStorage 'storage' event
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOGOUT_BROADCAST_KEY && e.newValue) {
        // Another tab broadcast a logout
        void (async () => {
          if (logoutFiredRef.current) return;
          logoutFiredRef.current = true;
          clearAllTimers();
          clearSupabaseSession();
          await signOut();
          navigate('/auth/login?reason=inactivity', { replace: true });
        })();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);
    ACTIVITY_EVENTS.forEach((e) =>
      document.addEventListener(e, onActivity, { passive: true })
    );

    // Start timers from current deadline
    scheduleFromDeadline();

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
      ACTIVITY_EVENTS.forEach((e) => document.removeEventListener(e, onActivity));
      if (debounce) clearTimeout(debounce);
      clearAllTimers();
    };
  }, [user, scheduleFromDeadline, clearAllTimers, signOut, navigate]);

  if (!user || !warning) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-[9990] flex items-center justify-between gap-4 px-4 py-3"
      style={{
        background: 'linear-gradient(90deg, rgba(234,179,8,0.18), rgba(234,179,8,0.08))',
        borderBottom: '1px solid rgba(234,179,8,0.35)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-yellow-400 text-base shrink-0" aria-hidden="true">⏱️</span>
        <div className="min-w-0">
          <p className="font-orbitron text-xs text-yellow-400 font-bold tracking-widest uppercase">
            Session Expiring Soon
          </p>
          <p className="text-yellow-400/70 text-xs font-mono mt-0.5">
            You&apos;ll be signed out in{' '}
            <span className="text-yellow-400 font-bold tabular-nums">{formatCountdown(msLeft)}</span>
            {' '}— move your mouse or tap to stay signed in
          </p>
        </div>
      </div>
      <button
        onClick={() => {
          touchActivity();
          setWarning(false);
          scheduleFromDeadline();
        }}
        className="shrink-0 px-4 py-1.5 rounded-lg font-orbitron text-xs font-bold text-black transition-all"
        style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}
      >
        STAY SIGNED IN
      </button>
    </div>
  );
}
