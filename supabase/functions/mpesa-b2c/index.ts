/**
 * mpesa-b2c — Supabase Edge Function
 *
 * Initiates an M-Pesa B2C (Business to Customer) payment to send
 * withdrawal funds to a player's M-Pesa number.
 *
 * Called by the admin WithdrawalsPage when approving a withdrawal.
 * Requires service-role key — not callable by regular users.
 *
 * B2C Result/Timeout callbacks are handled by mpesa-b2c-callback.
 */

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

async function getAccessToken(base: string, key: string, secret: string): Promise<string> {
  const creds = btoa(`${key}:${secret}`);
  const res = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${creds}`, Connection: 'close' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Token fetch failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error('No access_token in response');
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // Read all env vars first
  const serviceKey       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const SANDBOX          = Deno.env.get('MPESA_SANDBOX') === 'true';
  const DARAJA_BASE      = SANDBOX
    ? 'https://sandbox.safaricom.co.ke'
    : 'https://api.safaricom.co.ke';
  const CONSUMER_KEY     = Deno.env.get('MPESA_CONSUMER_KEY') ?? '';
  const CONSUMER_SECRET  = Deno.env.get('MPESA_CONSUMER_SECRET') ?? '';
  const B2C_SHORTCODE    = Deno.env.get('MPESA_B2C_SHORTCODE') ?? Deno.env.get('MPESA_SHORTCODE') ?? '';
  const B2C_INITIATOR    = Deno.env.get('MPESA_B2C_INITIATOR') ?? 'testapi';
  const B2C_SECURITY_CRED = Deno.env.get('MPESA_B2C_SECURITY_CREDENTIAL') ?? '';
  const B2C_RESULT_URL   = Deno.env.get('MPESA_B2C_RESULT_URL')
    ?? `${Deno.env.get('SUPABASE_URL')}/functions/v1/mpesa-b2c-callback`;
  const B2C_TIMEOUT_URL  = Deno.env.get('MPESA_B2C_TIMEOUT_URL')
    ?? `${Deno.env.get('SUPABASE_URL')}/functions/v1/mpesa-b2c-callback`;

  // ── Auth: verify caller is an authenticated admin ────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    serviceKey,
  );

  // Verify the JWT
  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user) return json({ error: 'Invalid token' }, 401);

  // Check admin role on profiles table (not admin_users)
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('admin_role')
    .eq('id', user.id)
    .single();

  if (!profileRow?.admin_role || !['super_admin', 'finance_admin'].includes(profileRow.admin_role)) {
    console.error('[mpesa-b2c] Unauthorized role:', profileRow?.admin_role, 'user:', user.id);
    return json({ error: 'Insufficient permissions' }, 403);
  }

  if (!CONSUMER_KEY || !CONSUMER_SECRET || !B2C_SHORTCODE || !B2C_SECURITY_CRED) {
    console.error('[mpesa-b2c] Missing B2C credentials');
    return json({ error: 'B2C credentials not configured. Set MPESA_B2C_SHORTCODE and MPESA_B2C_SECURITY_CREDENTIAL secrets.' }, 500);
  }

  try {
    const body = await req.json();
    const { transactionId } = body as { transactionId: string };

    if (!transactionId) return json({ error: 'transactionId required' }, 400);

    // ── Load the transaction ──────────────────────────────────────────────
    const { data: txn, error: txnErr } = await supabase
      .from('transactions')
      .select('id, user_id, amount, phone, status')
      .eq('id', transactionId)
      .single();

    if (txnErr || !txn) return json({ error: 'Transaction not found' }, 404);
    if (txn.status !== 'approved') {
      return json({ error: `Transaction status is '${txn.status}', expected 'approved'` }, 400);
    }
    if (!txn.phone) return json({ error: 'No phone number on transaction' }, 400);

    // Normalise phone to 2547XXXXXXXX
    const rawPhone = txn.phone.replace(/\D/g, '');
    const phone = rawPhone.startsWith('254') ? rawPhone : '254' + rawPhone;

    if (!/^2547\d{8}$|^2541\d{8}$/.test(phone)) {
      return json({ error: `Invalid phone number: ${txn.phone}` }, 400);
    }

    // ── Mark as processing to prevent double-payout ───────────────────────
    const { error: lockErr } = await supabase
      .from('transactions')
      .update({ status: 'processing' })
      .eq('id', transactionId)
      .eq('status', 'approved'); // only update if still 'approved'

    if (lockErr) return json({ error: 'Failed to lock transaction' }, 500);

    // ── In sandbox, simulate the B2C (Daraja sandbox B2C is unreliable) ──
    if (SANDBOX) {
      console.log(`[mpesa-b2c] SANDBOX: simulating B2C payout of KES ${txn.amount} to ${phone}`);
      // Mark completed immediately in sandbox
      await supabase
        .from('transactions')
        .update({
          status: 'completed',
          approved_at: new Date().toISOString(),
          mpesa_receipt: `SANDBOX-B2C-${Date.now()}`,
        })
        .eq('id', transactionId);

      console.log(`[mpesa-b2c] SANDBOX: withdrawal ${transactionId} marked completed`);
      return json({ ok: true, sandbox: true, message: 'Sandbox: payout simulated and marked completed.' });
    }

    // ── Production: call Daraja B2C API ───────────────────────────────────
    const token = await getAccessToken(DARAJA_BASE, CONSUMER_KEY, CONSUMER_SECRET);
    const timestamp = getTimestamp();
    const originatorConversationId = `NNW-${transactionId.slice(0, 8).toUpperCase()}-${timestamp}`;

    const b2cPayload = {
      OriginatorConversationID: originatorConversationId,
      InitiatorName:            B2C_INITIATOR,
      SecurityCredential:       B2C_SECURITY_CRED,
      CommandID:                'BusinessPayment',
      Amount:                   Math.floor(txn.amount),
      PartyA:                   B2C_SHORTCODE,
      PartyB:                   phone,
      Remarks:                  'NeonNoir Casino Withdrawal',
      QueueTimeOutURL:          B2C_TIMEOUT_URL,
      ResultURL:                B2C_RESULT_URL,
      Occasion:                 'Withdrawal',
    };

    console.log('[mpesa-b2c] B2C payload (no creds):', { ...b2cPayload, SecurityCredential: '[REDACTED]' });

    const b2cRes = await fetch(`${DARAJA_BASE}/mpesa/b2c/v3/paymentrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Connection: 'close',
      },
      body: JSON.stringify(b2cPayload),
    });

    const b2cData = await b2cRes.json();
    console.log('[mpesa-b2c] Daraja B2C response:', b2cData);

    if (b2cData.ResponseCode !== '0') {
      // Revert to approved so admin can retry
      await supabase
        .from('transactions')
        .update({ status: 'approved' })
        .eq('id', transactionId);
      return json({
        error: b2cData.errorMessage ?? b2cData.ResponseDescription ?? 'B2C request failed',
        daraja: b2cData,
      }, 400);
    }

    // Store the ConversationID so the B2C callback can match the result
    await supabase
      .from('transactions')
      .update({ checkout_request_id: b2cData.ConversationID })
      .eq('id', transactionId);

    console.log(`[mpesa-b2c] B2C initiated. ConversationID: ${b2cData.ConversationID}`);
    return json({
      ok: true,
      conversationId: b2cData.ConversationID,
      message: 'B2C payment initiated. Awaiting Daraja result callback.',
    });

  } catch (err) {
    console.error('[mpesa-b2c] Unhandled error:', err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
