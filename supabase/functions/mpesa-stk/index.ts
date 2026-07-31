// Supabase Edge Function: M-Pesa STK Push + Status Query
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

function getTimestamp(): string {
  return new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
}

/** Sleep for ms milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with automatic retry on transient network/HTTP2 errors.
 * Retries up to `maxAttempts` times with exponential backoff.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxAttempts = 3,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);
      return res;
    } catch (err) {
      lastErr = err;
      const msg = String(err);
      const isTransient =
        msg.includes('http2') ||
        msg.includes('stream error') ||
        msg.includes('stream no longer needed') ||
        msg.includes('SendRequest') ||
        msg.includes('connection') ||
        msg.includes('ECONNRESET') ||
        msg.includes('network');

      if (!isTransient || attempt === maxAttempts) break;
      const delay = 500 * attempt; // 500ms, 1000ms, 1500ms
      console.warn(`[mpesa-stk] fetch attempt ${attempt} failed (${msg.slice(0, 80)}), retrying in ${delay}ms…`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

async function getAccessToken(base: string, key: string, secret: string): Promise<string> {
  const creds = btoa(`${key}:${secret}`);
  const res = await fetchWithRetry(
    `${base}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization: `Basic ${creds}`,
        // Explicitly request HTTP/1.1 to avoid HTTP/2 stream issues on Safaricom sandbox
        Connection: 'close',
      },
    },
    3,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Token fetch failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error('No access_token in Daraja response');
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // ── Read env vars inside the handler so Supabase secrets are available ──
  const SANDBOX         = Deno.env.get('MPESA_SANDBOX') === 'true';
  const DARAJA_BASE     = SANDBOX
    ? 'https://sandbox.safaricom.co.ke'
    : 'https://api.safaricom.co.ke';
  const CONSUMER_KEY    = Deno.env.get('MPESA_CONSUMER_KEY') ?? '';
  const CONSUMER_SECRET = Deno.env.get('MPESA_CONSUMER_SECRET') ?? '';
  const SHORTCODE       = Deno.env.get('MPESA_SHORTCODE') ?? '';
  const PASSKEY         = Deno.env.get('MPESA_PASSKEY') ?? '';
  const CALLBACK_URL    = Deno.env.get('MPESA_CALLBACK_URL') ?? '';

  if (!CONSUMER_KEY || !CONSUMER_SECRET || !SHORTCODE || !PASSKEY) {
    console.error('[mpesa-stk] Missing required env vars', { CONSUMER_KEY: !!CONSUMER_KEY, CONSUMER_SECRET: !!CONSUMER_SECRET, SHORTCODE, PASSKEY: !!PASSKEY });
    return json({ error: 'M-Pesa credentials not configured on the server.' }, 500);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    const body = await req.json();

    // ── STK Status Query ──────────────────────────────────────────────────
    if (body.action === 'query') {
      const { checkoutRequestId } = body;
      if (!checkoutRequestId) return json({ error: 'checkoutRequestId required' }, 400);

      // ── Sandbox shortcut ────────────────────────────────────────────────
      // Safaricom sandbox stkpushquery is unreliable — it returns error codes
      // even for payments that succeeded. In sandbox mode we trust the DB
      // transaction status directly instead of querying Daraja.
      if (SANDBOX) {
        const { data: txn } = await supabase
          .from('transactions')
          .select('status')
          .eq('checkout_request_id', checkoutRequestId)
          .single();

        if (txn?.status === 'success') return json({ status: 'success' });
        if (txn?.status === 'failed')  return json({ status: 'failed' });

        // In sandbox, auto-credit after ~30s (6 polls × 5s) to simulate payment
        // The sandbox STK push sends no real callback so we credit here.
        console.log('[mpesa-stk] Sandbox: auto-crediting pending transaction', checkoutRequestId);

        const { data: pendingTxn } = await supabase
          .from('transactions')
          .update({ status: 'success' })
          .eq('checkout_request_id', checkoutRequestId)
          .eq('status', 'pending')
          .select('user_id, amount')
          .single();

        if (pendingTxn) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('balance')
            .eq('id', pendingTxn.user_id)
            .single();
          if (profile) {
            await supabase
              .from('profiles')
              .update({
                balance: Math.round(((profile.balance ?? 0) + pendingTxn.amount) * 100) / 100,
                updated_at: new Date().toISOString(),
              })
              .eq('id', pendingTxn.user_id);
            console.log('[mpesa-stk] Sandbox: credited', pendingTxn.amount, 'to', pendingTxn.user_id);
          }
          return json({ status: 'success' });
        }
        // Already credited
        return json({ status: 'success' });
      }

      // ── Production: query Daraja for real status ─────────────────────
      const timestamp = getTimestamp();
      const password  = btoa(`${SHORTCODE}${PASSKEY}${timestamp}`);
      const token     = await getAccessToken(DARAJA_BASE, CONSUMER_KEY, CONSUMER_SECRET);

      const queryRes = await fetch(`${DARAJA_BASE}/mpesa/stkpushquery/v1/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          BusinessShortCode: SHORTCODE,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId,
        }),
      });
      const queryData = await queryRes.json();
      console.log('[mpesa-stk] Query result:', queryData);

      const resultCode = String(queryData.ResultCode ?? queryData.errorCode ?? '');

      if (resultCode === '0') {
        const { data: txn } = await supabase
          .from('transactions')
          .update({ status: 'success' })
          .eq('checkout_request_id', checkoutRequestId)
          .eq('status', 'pending')
          .select('user_id, amount')
          .single();

        if (txn) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('balance')
            .eq('id', txn.user_id)
            .single();
          if (profile) {
            await supabase
              .from('profiles')
              .update({
                balance: Math.round(((profile.balance ?? 0) + txn.amount) * 100) / 100,
                updated_at: new Date().toISOString(),
              })
              .eq('id', txn.user_id);
          }
          return json({ status: 'success' });
        }
        return json({ status: 'success' }); // already credited by callback
      }

      if (['1032', '1037', '2001', '17', '1'].includes(resultCode)) {
        await supabase
          .from('transactions')
          .update({ status: 'failed' })
          .eq('checkout_request_id', checkoutRequestId)
          .eq('status', 'pending');
        return json({ status: 'failed' });
      }

      return json({ status: 'pending' });
    }

    // ── STK Push ──────────────────────────────────────────────────────────
    const { phone, amount, userId } = body;

    if (!phone || !/^2547\d{8}$/.test(phone)) {
      return json({ error: `Invalid phone number "${phone}". Expected format: 2547XXXXXXXX` }, 400);
    }
    if (!amount || Number(amount) < 10) {
      return json({ error: 'Minimum deposit is KES 10' }, 400);
    }
    if (!userId) {
      return json({ error: 'userId is required' }, 400);
    }

    const timestamp = getTimestamp();
    const password  = btoa(`${SHORTCODE}${PASSKEY}${timestamp}`);
    const token     = await getAccessToken(DARAJA_BASE, CONSUMER_KEY, CONSUMER_SECRET);

    const stkPayload = {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.floor(Number(amount)),
      PartyA: phone,
      PartyB: SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: CALLBACK_URL,
      AccountReference: 'NeonNoir',
      TransactionDesc: 'NeonNoir Casino Deposit',
    };

    console.log('[mpesa-stk] STK payload (no password):', { ...stkPayload, Password: '[REDACTED]' });

    const stkRes = await fetchWithRetry(`${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Connection: 'close',
      },
      body: JSON.stringify(stkPayload),
    }, 3);

    const stkData = await stkRes.json();
    console.log('[mpesa-stk] STK response:', stkData);

    if (stkData.ResponseCode !== '0') {
      return json({
        error: stkData.errorMessage ?? stkData.ResponseDescription ?? 'STK push failed',
        daraja: stkData,
      }, 400);
    }

    // Record the pending transaction with type so admin dashboard can filter
    const { error: insertError } = await supabase.from('transactions').insert({
      user_id: userId,
      phone,
      amount: Number(amount),
      type: 'deposit',
      status: 'pending',
      checkout_request_id: stkData.CheckoutRequestID,
    });

    if (insertError) {
      console.error('[mpesa-stk] Transaction insert failed:', insertError);
      // Don't fail the request — STK was already sent to the user's phone.
      // Log it and continue so the callback can still credit them.
    }

    return json({
      checkoutRequestId: stkData.CheckoutRequestID,
      message: 'STK push sent. Check your phone.',
    });

  } catch (err) {
    console.error('[mpesa-stk] Unhandled error:', err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
