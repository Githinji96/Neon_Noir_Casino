import { chromium, FullConfig } from '@playwright/test';
import { saveAuthState } from './authHelpers';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/** Load env vars from a dotenv-style file (only sets vars not already in process.env) */
function loadEnvFile(filePath: string): void {
  try {
    const content = readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // File doesn't exist — silently ignore
  }
}

/**
 * Global setup — runs once before the entire test suite.
 *
 * Signs in via Supabase SDK directly (no browser UI — avoids rate limits).
 * Injects the session token into a browser context's localStorage and saves
 * it as auth-state.json for tests that need pre-authenticated state.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  // Load .env.test then .env as fallbacks (in case --env-file wasn't used)
  loadEnvFile(resolve(process.cwd(), '.env.test'));
  loadEnvFile(resolve(process.cwd(), '.env'));

  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:5173';
  const rawChannel = (config.projects[0]?.use as { channel?: string })?.channel;
  const channel = rawChannel || undefined;

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[globalSetup] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set — skipping auth setup.');
    return;
  }

  // Read credentials directly from process.env AFTER loadEnvFile has run
  // (TEST_PLAYER is evaluated at import time, before env vars are loaded)
  const testEmail    = process.env.TEST_USER_EMAIL    ?? '';
  const testPassword = process.env.TEST_USER_PASSWORD ?? '';

  if (!testEmail || !testPassword) {
    console.warn('[globalSetup] TEST_USER_EMAIL or TEST_USER_PASSWORD not set — skipping auth setup.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // ── Strategy 1: Refresh existing session if auth-state.json has a valid refresh token ──
  // This avoids Supabase sign-in rate limits on repeated test runs.
  const authStatePath = resolve(process.cwd(), 'e2e/.auth/auth-state.json');
  // Use Session directly — refreshSession and signInWithPassword return different
  // data shapes (Session | null vs Session non-null), so we only carry the Session.
  let sessionData: import('@supabase/supabase-js').Session | null = null;

  // Computed once, reused in both the Strategy 1 token lookup and the final injection.
  const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  try {
    const existing = JSON.parse(readFileSync(authStatePath, 'utf8'));
    const localStorage = existing?.origins?.[0]?.localStorage ?? [];
    const tokenEntry = localStorage.find((e: { name: string }) => e.name === storageKey);
    if (tokenEntry) {
      const stored = JSON.parse(tokenEntry.value);
      const refreshToken = stored?.refresh_token;
      if (refreshToken) {
        const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
        if (!error && data.session) {
          sessionData = data.session;
          console.log('[globalSetup] Session refreshed from existing auth-state.json');
        } else {
          console.log('[globalSetup] Refresh failed, will sign in:', error?.message);
        }
      }
    }
  } catch {
    // auth-state.json doesn't exist or is malformed — proceed to sign in
  }

  // ── Strategy 2: Sign in with password if refresh didn't work ──
  if (!sessionData) {
    let lastError = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email:    testEmail,
        password: testPassword,
      });
      if (!authError && data.session) {
        sessionData = data.session;
        break;
      }
      lastError = authError?.message ?? 'no session';
      console.warn(`[globalSetup] Login attempt ${attempt}/3 failed: ${lastError}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
    }

    if (!sessionData) {
      console.warn(`[globalSetup] Could not log in after 3 attempts: ${lastError}`);
      console.warn('[globalSetup] Tests requiring auth will fall back to anonymous mode.');
      return;
    }
  }

  const session = sessionData;

  // Inject session into a real browser context so storageState captures it correctly
  const browser = await chromium.launch({ channel });
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  await page.evaluate(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session));
  }, { key: storageKey, session });

  await saveAuthState(context, 'e2e/.auth/auth-state.json');
  console.log(`[globalSetup] Auth state saved for ${testEmail}`);
  await browser.close();
}
