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
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email:    testEmail,
    password: testPassword,
  });

  if (authError || !authData.session) {
    console.warn(`[globalSetup] Could not log in via API: ${authError?.message ?? 'no session'}`);
    console.warn('[globalSetup] Tests requiring auth will fall back to anonymous mode.');
    return;
  }

  // Inject session into a real browser context so storageState captures it correctly
  const browser = await chromium.launch({ channel });
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  await page.evaluate(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session));
  }, { key: storageKey, session: authData.session });

  await saveAuthState(context, 'e2e/.auth/auth-state.json');
  console.log(`[globalSetup] Auth state saved for ${testEmail}`);
  await browser.close();
}
