import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// sessionStorage scopes the auth token to the current browser tab/window.
// A new browser or incognito window has no token → forces re-login.
// Falls back to in-memory storage if sessionStorage is unavailable.
const getStorage = () => {
  try {
    return window.sessionStorage;
  } catch {
    return undefined; // Supabase will use in-memory fallback
  }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: getStorage(),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Profile = {
  id: string;
  username: string;
  balance: number;
  updated_at: string;
};

export type LeaderboardEntry = {
  id: string;
  user_id: string;
  username: string;
  win_amount: number;
  game_title: string;
  created_at: string;
};
