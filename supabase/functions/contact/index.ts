// Supabase Edge Function: Contact Form Handler
// Stores ticket in DB + sends email via Resend (free tier, no card required)
// Deploy: npx supabase functions deploy contact
// Secrets: RESEND_API_KEY, SUPPORT_EMAIL (optional, defaults to bonfacegithinji64@gmail.com)

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

/** Generate ticket number: SUP-YYYYMMDD-HHMMSS */
function generateTicketNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toISOString().slice(11, 19).replace(/:/g, '');
  return `SUP-${date}-${time}`;
}

/** Send email via Resend API */
async function sendEmail(apiKey: string, payload: {
  from: string;
  to: string[];
  subject: string;
  html: string;
}): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error('[contact] Resend error:', res.status, err.slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[contact] Email send failed:', err);
    return false;
  }
}

// Simple in-memory rate limit: max 5 per IP per hour
// Resets on cold start — sufficient for basic abuse prevention
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 3_600_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // ── Read config ──────────────────────────────────────────────────────────
  const RESEND_API_KEY  = Deno.env.get('RESEND_API_KEY') ?? '';
  const SUPPORT_EMAIL   = Deno.env.get('SUPPORT_EMAIL') ?? 'bonfacegithinji64@gmail.com';
  const SUPABASE_URL    = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // ── Rate limit ────────────────────────────────────────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return json({ success: false, error: 'Too many requests. Please try again later.' }, 429);
  }

  try {
    const body = await req.json();
    const { name, email, subject, message } = body ?? {};

    // ── Server-side validation ────────────────────────────────────────────
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      return json({ success: false, error: 'Name must be 2–100 characters.' }, 400);
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ success: false, error: 'Invalid email address.' }, 400);
    }
    if (!subject || typeof subject !== 'string' || subject.trim().length < 5 || subject.trim().length > 100) {
      return json({ success: false, error: 'Subject must be 5–100 characters.' }, 400);
    }
    if (!message || typeof message !== 'string' || message.trim().length < 20 || message.trim().length > 2000) {
      return json({ success: false, error: 'Message must be 20–2000 characters.' }, 400);
    }

    // Sanitise inputs (strip HTML tags)
    const safe = (s: string) => s.replace(/<[^>]*>/g, '').trim();
    const safeName    = safe(name);
    const safeEmail   = safe(email).toLowerCase();
    const safeSubject = safe(subject);
    const safeMessage = safe(message);

    // ── Generate ticket number ─────────────────────────────────────────────
    const ticketNumber = generateTicketNumber();
    const submittedAt  = new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });

    // ── Store in database ─────────────────────────────────────────────────
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { error: dbError } = await supabase.from('support_tickets').insert({
      ticket_number: ticketNumber,
      name: safeName,
      email: safeEmail,
      subject: safeSubject,
      message: safeMessage,
      status: 'new',
      priority: 'medium',
    });

    if (dbError) {
      console.error('[contact] DB insert failed:', dbError.message);
      // Don't fail the whole request — still try to send email
    }

    // ── Email to support inbox ────────────────────────────────────────────
    if (RESEND_API_KEY) {
      const supportHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0f;color:#fff;padding:24px;border-radius:12px;border:1px solid rgba(255,215,0,0.2)">
          <h2 style="color:#FFD700;font-family:monospace;letter-spacing:2px;margin-bottom:20px">
            🎰 NEW SUPPORT TICKET — ${ticketNumber}
          </h2>
          <table style="width:100%;border-collapse:collapse">
            ${[
              ['Ticket ID',  ticketNumber],
              ['Name',       safeName],
              ['Email',      safeEmail],
              ['Subject',    safeSubject],
              ['Submitted',  submittedAt],
            ].map(([label, value]) => `
              <tr>
                <td style="padding:8px 12px;background:rgba(255,255,255,0.05);border-radius:4px;color:rgba(255,255,255,0.5);font-size:12px;width:110px;vertical-align:top">${label}</td>
                <td style="padding:8px 12px;color:#fff;font-size:14px">${value}</td>
              </tr>`).join('')}
            <tr>
              <td style="padding:8px 12px;background:rgba(255,255,255,0.05);border-radius:4px;color:rgba(255,255,255,0.5);font-size:12px;vertical-align:top">Message</td>
              <td style="padding:8px 12px;color:#fff;font-size:14px;line-height:1.6;white-space:pre-wrap">${safeMessage}</td>
            </tr>
          </table>
          <p style="margin-top:20px;font-size:11px;color:rgba(255,255,255,0.3)">Neon Noir Casino — Support System</p>
        </div>`;

      await sendEmail(RESEND_API_KEY, {
        from: 'noreply@neonnoircasino.com',
        to: [SUPPORT_EMAIL],
        subject: `[Support Ticket] ${safeSubject} — ${ticketNumber}`,
        html: supportHtml,
      });

      // ── Auto-reply to player ─────────────────────────────────────────────
      const playerHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0f;color:#fff;padding:24px;border-radius:12px;border:1px solid rgba(255,215,0,0.2)">
          <h2 style="color:#FFD700;font-family:monospace;letter-spacing:2px">🎰 NEON NOIR CASINO</h2>
          <h3 style="color:#fff;font-weight:normal">We've received your support request</h3>
          <p style="color:rgba(255,255,255,0.7)">Hello ${safeName},</p>
          <p style="color:rgba(255,255,255,0.7);line-height:1.6">
            Thank you for contacting Neon Noir Casino. Your request has been received and logged in our system.
          </p>
          <div style="background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.2);border-radius:8px;padding:16px;margin:20px 0">
            <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0 0 4px">Ticket Number</p>
            <p style="color:#FFD700;font-family:monospace;font-size:18px;font-weight:bold;margin:0">${ticketNumber}</p>
          </div>
          <p style="color:rgba(255,255,255,0.7);line-height:1.6">
            Our support team will review your issue and respond within <strong style="color:#FFD700">24 hours</strong>.
            Please keep this email for your reference.
          </p>
          <p style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:24px">
            Neon Noir Casino — Support Team<br>
            📧 ${SUPPORT_EMAIL}<br>
            📞 +254 703 302 801
          </p>
        </div>`;

      await sendEmail(RESEND_API_KEY, {
        from: 'support@neonnoircasino.com',
        to: [safeEmail],
        subject: `We've received your support request — ${ticketNumber}`,
        html: playerHtml,
      });
    } else {
      console.warn('[contact] RESEND_API_KEY not set — emails not sent. Ticket stored in DB only.');
    }

    return json({ success: true, ticketId: ticketNumber });

  } catch (err) {
    console.error('[contact] Unhandled error:', err);
    return json({ success: false, error: 'Internal server error. Please try again.' }, 500);
  }
});
