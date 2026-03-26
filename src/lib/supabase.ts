import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});

/** Ping Supabase auth health endpoint — resolves true if reachable, false otherwise */
export async function pingSupabase(): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

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
