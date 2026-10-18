/**
 * Session Manager — Centralized Inactivity Session Enforcement
 *
 * Shared logic used by both PlayerInactivityGuard and AdminAuthGuard.
 *
 * Strategy:
 *  - Stores `lastActivity` timestamp in localStorage under a well-known key.
 *  - Activity events (mouse, key, touch, scroll) update the timestamp.
 *  - On tab visibility restore, compares timestamp to now — if deadline
 *    already passed, fires logout immediately (handles browser sleep/suspend).
 *  - A localStorage 'storage' event listener detects logout in other tabs
 *    and triggers the same logout path in every open tab.
 *  - Warning fires WARN_BEFORE_MS before the deadline so users can stay active.
 *  - Background polls, API calls, and Realtime events do NOT update the key.
 */

export const INACTIVITY_TIMEOUT_MS = 60 * 60_000;  // 60 minutes
export const WARN_BEFORE_MS        =  5 * 60_000;  //  5 minutes warning

/** localStorage key storing last-activity timestamp as a numeric string */
export const LAST_ACTIVITY_KEY = 'nn-last-activity';

/** localStorage key set to '1' when a logout is broadcast to other tabs */
export const LOGOUT_BROADCAST_KEY = 'nn-session-logout';

/** Meaningful user activity events — NOT background API/Realtime events */
export const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'touchstart',
  'scroll',
  'click',
] as const;

/** Write current timestamp as last activity */
export function touchActivity(): void {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch { /* localStorage unavailable */ }
}

/** Read the last-activity timestamp; returns Date.now() if not set */
export function getLastActivity(): number {
  try {
    const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (stored) return parseInt(stored, 10);
  } catch { /* ignore */ }
  return Date.now();
}

/** Returns ms until the logout deadline from the last activity timestamp */
export function msUntilLogout(): number {
  return Math.max(0, getLastActivity() + INACTIVITY_TIMEOUT_MS - Date.now());
}

/** Broadcast a logout event to all other tabs */
export function broadcastLogout(): void {
  try {
    localStorage.setItem(LOGOUT_BROADCAST_KEY, String(Date.now()));
    // Remove immediately — the 'storage' event only fires on OTHER tabs,
    // and we don't want the key to persist after the current tab reloads.
    setTimeout(() => {
      try { localStorage.removeItem(LOGOUT_BROADCAST_KEY); } catch { /* ignore */ }
    }, 500);
  } catch { /* ignore */ }
}

/** Clear the activity key on logout */
export function clearActivity(): void {
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch { /* ignore */ }
}

/** Derive the Supabase project ref from the URL for localStorage key access */
export function getSupabaseProjectRef(): string {
  return (import.meta.env.VITE_SUPABASE_URL as string)
    .replace('https://', '')
    .split('.')[0];
}

/** Immediately wipe the Supabase auth token from localStorage */
export function clearSupabaseSession(): void {
  try {
    const key = `sb-${getSupabaseProjectRef()}-auth-token`;
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}
