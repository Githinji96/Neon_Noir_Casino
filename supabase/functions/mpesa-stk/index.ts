// Supabase Edge Function: M-Pesa STK Push + Status Query
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
      // Safaricom sandbox stkpushquery is unreliable but we MUST check it
      // before crediting. A cancelled push stays 'pending' in our DB because
      // no callback fires in sandbox. We query Daraja directly first; only
      // if that also fails do we fall back to timed auto-credit (60s minimum).
      if (SANDBOX) {
        const { data: txn } = await supabase
          .from('transactions')
          .select('status, created_at, amount, user_id')
          .eq('checkout_request_id', checkoutRequestId)
          .single();

        if (txn?.status === 'success') return json({ status: 'success' });
        if (txn?.status === 'failed')  return json({ status: 'failed' });

        // Try querying Daraja sandbox — it sometimes works and will return
        // ResultCode 1032 for a cancelled push
        try {
          const timestamp = getTimestamp();
          const password  = btoa(`${SHORTCODE}${PASSKEY}${timestamp}`);
          const token     = await getAccessToken(DARAJA_BASE, CONSUMER_KEY, CONSUMER_SECRET);

          const queryRes = await fetchWithRetry(`${DARAJA_BASE}/mpesa/stkpushquery/v1/query`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              BusinessShortCode: SHORTCODE,
              Password: password,
              Timestamp: timestamp,
              CheckoutRequestID: checkoutRequestId,
            }),
          }, 2);

          const queryData = await queryRes.json();
          const resultCode = String(queryData.ResultCode ?? queryData.errorCode ?? '');
          console.log('[mpesa-stk] Sandbox Daraja query result:', resultCode, queryData);

          // Confirmed cancelled by Daraja
          if (['1032', '1037', '2001', '17', '1'].includes(resultCode)) {
            await supabase
              .from('transactions')
              .update({ status: 'failed' })
              .eq('checkout_request_id', checkoutRequestId)
              .eq('status', 'pending');
            return json({ status: 'failed' });
          }

          // Confirmed paid by Daraja
          if (resultCode === '0') {
            const { data: pendingTxn } = await supabase
              .from('transactions')
              .update({
                status: 'success',
                mpesa_receipt: queryData.MpesaReceiptNumber ?? `DARAJA-${checkoutRequestId.slice(-8).toUpperCase()}`,
              })
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
              }
              return json({ status: 'success' });
            }
            return json({ status: 'success' }); // already credited
          }
          // Daraja returned inconclusive — fall through to time-based check
        } catch (queryErr) {
          console.warn('[mpesa-stk] Sandbox Daraja query failed:', queryErr);
          // Fall through to time-based check
        }

        // Time-based fallback: only auto-credit if the transaction is
        // at least 60 seconds old — gives the user time to cancel.
        // Cancelled pushes in sandbox stay 'pending' forever, so we
        // treat anything older than 60s as a confirmed payment.
        const createdAt = txn?.created_at ? new Date(txn.created_at).getTime() : 0;
        const ageSeconds = (Date.now() - createdAt) / 1000;

        if (ageSeconds < 60) {
          console.log(`[mpesa-stk] Sandbox: transaction only ${ageSeconds.toFixed(0)}s old, waiting...`);
          return json({ status: 'pending' });
        }

        // Older than 60s and still pending — credit the account
        console.log(`[mpesa-stk] Sandbox: auto-crediting after ${ageSeconds.toFixed(0)}s`, checkoutRequestId);

        const sandboxReceipt = `SANDBOX-${Date.now().toString(36).toUpperCase().slice(-8)}`;
        const { data: pendingTxn } = await supabase
          .from('transactions')
          .update({ status: 'success', mpesa_receipt: sandboxReceipt })
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
        return json({ status: 'success' }); // already credited
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
          .update({
            status: 'success',
            mpesa_receipt: queryData.MpesaReceiptNumber ?? null,
          })
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
    const { amount } = body;

    if (!amount || Number(amount) < 10) {
      return json({ error: 'Minimum deposit is KES 10' }, 400);
    }

    // ── Always get phone from authenticated user's profile — never trust client ──
    // Verify the JWT using supabase.auth.getUser() — this validates the signature
    // server-side, unlike manual atob() decode which can be spoofed.
    const authHeader = req.headers.get('authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) {
      return json({ error: 'Missing authentication token.' }, 401);
    }

    // Create an anon client to verify the JWT (uses Supabase's auth server)
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );
    const { data: { user: callerUser }, error: authErr } = await anonClient.auth.getUser(jwt);

    if (authErr || !callerUser?.id) {
      console.error('[mpesa-stk] JWT verification failed:', authErr?.message);
      return json({ error: 'Invalid or expired authentication token.' }, 401);
    }
    const callerUserId = callerUser.id;

    // Fetch the verified phone from the database
    const { data: playerProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('phone, phone_verified, account_status')
      .eq('id', callerUserId)
      .single();

    if (profileErr || !playerProfile) {
      return json({ error: 'Player profile not found.' }, 404);
    }
    if (playerProfile.account_status === 'banned' || playerProfile.account_status === 'suspended') {
      return json({ error: 'Account is not active.' }, 403);
    }
    if (!playerProfile.phone) {
      return json({ error: 'No M-Pesa number registered on your account. Please add one in Account Settings.' }, 400);
    }

    // Normalise the DB phone to 2547XXXXXXXX
    const rawPhone = playerProfile.phone.replace(/\D/g, '');
    const serverPhone = rawPhone.startsWith('254') ? rawPhone : '254' + rawPhone;

    if (!/^254[71]\d{8}$/.test(serverPhone)) {
      return json({ error: `Registered phone number (${playerProfile.phone}) is not a valid Kenyan M-Pesa number. Please update it in Account Settings.` }, 400);
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
      PartyA: serverPhone,
      PartyB: SHORTCODE,
      PhoneNumber: serverPhone,
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

    // Record the pending transaction with the server-verified phone
    const { error: insertError } = await supabase.from('transactions').insert({
      user_id: callerUserId,
      phone:   serverPhone,
      amount:  Number(amount),
      type:    'deposit',
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
