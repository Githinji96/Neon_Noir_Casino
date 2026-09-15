// Supabase Edge Function: Newsletter Subscribe
// Validates email server-side, prevents duplicates, stores in newsletter_subscribers table.
// Deploy: npx supabase functions deploy newsletter-subscribe

import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** RFC-5322-inspired email regex — rejects all the edge cases listed in the spec */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateEmail(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.includes(' ')) return null;
  if (!EMAIL_REGEX.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

// Simple in-memory rate limit: max 3 subscribe attempts per IP per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 3_600_000 });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ success: false, message: 'Method not allowed.' }, 405);

  const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // ── Rate limit ────────────────────────────────────────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return json({ success: false, message: 'Too many requests. Please try again later.' }, 429);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { email: rawEmail, source = 'footer' } = body ?? {};

    // ── Server-side email validation ──────────────────────────────────────
    const email = validateEmail(rawEmail);
    if (!email) {
      return json({ success: false, message: 'Please enter a valid email address.' }, 400);
    }

    // ── Persist to DB using service role (bypasses RLS) ───────────────────
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Check for duplicate before inserting so we can return a clear message
    const { data: existing } = await supabase
      .from('newsletter_subscribers')
      .select('id, status')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'unsubscribed') {
        // Re-activate the subscription
        await supabase
          .from('newsletter_subscribers')
          .update({ status: 'active' })
          .eq('id', existing.id);
        return json({ success: true, message: 'Subscription successful.' });
      }
      // Already active duplicate
      return json({ success: false, message: 'This email is already subscribed.' }, 409);
    }

    const { error: dbError } = await supabase
      .from('newsletter_subscribers')
      .insert({ email, status: 'active', source: String(source).slice(0, 50) });

    if (dbError) {
      // Unique constraint violation — race condition safety net
      if (dbError.code === '23505') {
        return json({ success: false, message: 'This email is already subscribed.' }, 409);
      }
      console.error('[newsletter-subscribe] DB insert error:', dbError.message);
      return json({ success: false, message: 'Something went wrong. Please try again.' }, 500);
    }

    return json({ success: true, message: 'Subscription successful.' });

  } catch (err) {
    console.error('[newsletter-subscribe] Unhandled error:', err);
    return json({ success: false, message: 'Internal server error. Please try again.' }, 500);
  }
});
