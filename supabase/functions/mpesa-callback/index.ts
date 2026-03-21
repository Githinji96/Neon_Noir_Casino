// Supabase Edge Function: M-Pesa Callback Handler
// Deploy: supabase functions deploy mpesa-callback
// This URL is what you set as MPESA_CALLBACK_URL

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const callback = body?.Body?.stkCallback;

    if (!callback) {
      return Response.json({ error: 'Invalid callback' }, { status: 400 });
    }

    const checkoutRequestId = callback.CheckoutRequestID;
    const resultCode        = callback.ResultCode; // 0 = success
    const resultDesc        = callback.ResultDesc;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (resultCode === 0) {
      // Extract M-Pesa receipt and amount from callback metadata
      const items: { Name: string; Value: string | number }[] =
        callback.CallbackMetadata?.Item ?? [];
      const get = (name: string) => items.find((i) => i.Name === name)?.Value;

      const mpesaReceipt = get('MpesaReceiptNumber') as string;
      const amount       = Number(get('Amount'));

      // Mark transaction as success
      const { data: txn } = await supabase
        .from('transactions')
        .update({ status: 'success', mpesa_receipt: mpesaReceipt })
        .eq('checkout_request_id', checkoutRequestId)
        .select('user_id, amount')
        .single();

      if (txn) {
        // Credit user balance in profiles table
        const { data: profile } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', txn.user_id)
          .single();

        if (profile) {
          const newBalance = (profile.balance ?? 0) + (amount || txn.amount);
          await supabase
            .from('profiles')
            .update({ balance: newBalance, updated_at: new Date().toISOString() })
            .eq('id', txn.user_id);
        }
      }
    } else {
      // Payment failed or cancelled
      await supabase
        .from('transactions')
        .update({ status: 'failed' })
        .eq('checkout_request_id', checkoutRequestId);

      console.log(`[mpesa-callback] Payment failed: ${resultDesc}`);
    }

    return Response.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    console.error('[mpesa-callback]', err);
    return Response.json({ ResultCode: 0, ResultDesc: 'Accepted' }); // always 200 to Safaricom
  }
});
