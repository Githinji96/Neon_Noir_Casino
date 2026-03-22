// Supabase Edge Function: M-Pesa STK Push
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DARAJA_BASE = Deno.env.get('MPESA_SANDBOX') === 'true'
  ? 'https://sandbox.safaricom.co.ke'
  : 'https://api.safaricom.co.ke';

const CONSUMER_KEY    = Deno.env.get('MPESA_CONSUMER_KEY') ?? '';
const CONSUMER_SECRET = Deno.env.get('MPESA_CONSUMER_SECRET') ?? '';
const SHORTCODE       = Deno.env.get('MPESA_SHORTCODE') ?? '';
const PASSKEY         = Deno.env.get('MPESA_PASSKEY') ?? '';
const CALLBACK_URL    = Deno.env.get('MPESA_CALLBACK_URL') ?? '';

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

async function getAccessToken(): Promise<string> {
  const creds = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`);
  const res = await fetch(
    `${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${creds}` } }
  );
  if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

function getTimestamp(): string {
  return new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  try {
    const { phone, amount, userId } = await req.json();

    if (!/^2547\d{8}$/.test(phone)) {
      return json({ error: 'Invalid phone. Use format 2547XXXXXXXX' }, 400);
    }
    if (!amount || amount < 10) {
      return json({ error: 'Minimum deposit is KES 10' }, 400);
    }

    const timestamp = getTimestamp();
    const password  = btoa(`${SHORTCODE}${PASSKEY}${timestamp}`);
    const token     = await getAccessToken();

    const stkRes = await fetch(`${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.floor(amount),
        PartyA: phone,
        PartyB: SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: CALLBACK_URL,
        AccountReference: phone,
        TransactionDesc: 'NeonNoir Casino Deposit',
      }),
    });

    const stkData = await stkRes.json();

    if (stkData.ResponseCode !== '0') {
      return json({ error: stkData.ResponseDescription ?? 'STK push failed' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabase.from('transactions').insert({
      user_id: userId,
      phone,
      amount,
      status: 'pending',
      checkout_request_id: stkData.CheckoutRequestID,
    });

    return json({ checkoutRequestId: stkData.CheckoutRequestID, message: 'STK push sent' });
  } catch (err) {
    console.error('[mpesa-stk]', err);
    return json({ error: String(err) }, 500);
  }
});
