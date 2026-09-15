// Supabase Edge Function: M-Pesa Callback Handler
// Deploy: supabase functions deploy mpesa-callback
// Set MPESA_CALLBACK_URL to: https://<project>.supabase.co/functions/v1/mpesa-callback

import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  // Safaricom always expects HTTP 200. Never return 4xx/5xx to Daraja.
  try {
    const body = await req.json();
    console.log('[mpesa-callback] Raw body:', JSON.stringify(body));

    const callback = body?.Body?.stkCallback;
    if (!callback) {
      console.error('[mpesa-callback] No stkCallback in body');
      return Response.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const checkoutRequestId = callback.CheckoutRequestID as string;
    const resultCode        = Number(callback.ResultCode);
    const resultDesc        = callback.ResultDesc as string;

    console.log('[mpesa-callback] checkoutRequestId:', checkoutRequestId, 'resultCode:', resultCode);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    if (resultCode === 0) {
      // Extract metadata from callback
      const items: { Name: string; Value: string | number }[] =
        callback.CallbackMetadata?.Item ?? [];
      const getMeta = (name: string) => items.find((i) => i.Name === name)?.Value;

      const mpesaReceipt = getMeta('MpesaReceiptNumber') as string | undefined;
      const paidAmount   = Number(getMeta('Amount') ?? 0);
      // Always provide a receipt — use callback receipt or generate a reference
      const receiptToSave = mpesaReceipt || `CB-${checkoutRequestId.slice(-10).toUpperCase()}`;

      console.log('[mpesa-callback] Payment success. Receipt:', receiptToSave, 'Amount:', paidAmount);

      // Guard against double-credit: only update if still pending
      const { data: txn, error: txnErr } = await supabase
        .from('transactions')
        .update({
          status: 'success',
          mpesa_receipt: receiptToSave,
        })
        .eq('checkout_request_id', checkoutRequestId)
        .eq('status', 'pending')    // ← idempotency guard
        .select('user_id, amount')
        .single();

      if (txnErr) {
        console.warn('[mpesa-callback] Transaction update issue (may be already credited):', txnErr.message);
        // Not a hard failure — may mean query endpoint already credited this
        return Response.json({ ResultCode: 0, ResultDesc: 'Accepted' });
      }

      if (txn) {
        // Use the confirmed paid amount from callback; fall back to DB amount
        const creditAmount = paidAmount > 0 ? paidAmount : txn.amount;

        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', txn.user_id)
          .single();

        if (profileErr) {
          console.error('[mpesa-callback] Profile fetch failed:', profileErr.message);
        } else if (profile) {
          const newBalance = Math.round(((profile.balance ?? 0) + creditAmount) * 100) / 100;
          const { error: updateErr } = await supabase
            .from('profiles')
            .update({ balance: newBalance, updated_at: new Date().toISOString() })
            .eq('id', txn.user_id);

          if (updateErr) {
            console.error('[mpesa-callback] Balance update failed:', updateErr.message);
          } else {
            console.log(`[mpesa-callback] Credited KES ${creditAmount} to user ${txn.user_id}. New balance: ${newBalance}`);
          }
        }
      }
    } else {
      // Payment failed, was cancelled (1032), or reversed
      console.log(`[mpesa-callback] Payment not successful: ${resultDesc} (code ${resultCode})`);

      // Mark as failed — only if still pending (don't overwrite 'success' or 'reversed')
      await supabase
        .from('transactions')
        .update({ status: 'failed' })
        .eq('checkout_request_id', checkoutRequestId)
        .eq('status', 'pending');

      // Result code 2 = Mpesa system reverse — deduct if already credited
      // Result code 17 = Limit exceeded reversal
      if ([2, 17].includes(resultCode)) {
        const { data: creditedTxn } = await supabase
          .from('transactions')
          .select('id, user_id, amount, mpesa_receipt')
          .eq('checkout_request_id', checkoutRequestId)
          .eq('status', 'success')
          .single();

        if (creditedTxn) {
          console.log(`[mpesa-callback] System reversal for already-credited txn ${creditedTxn.id}, deducting KES ${creditedTxn.amount}`);
          await supabase.rpc('process_mpesa_reversal', {
            p_mpesa_receipt:    creditedTxn.mpesa_receipt ?? checkoutRequestId,
            p_reversal_receipt: `AUTO-REVERSAL-${checkoutRequestId}`,
            p_reversed_amount:  creditedTxn.amount,
          });
        }
      }
    }

    // Always respond 200 with this exact shape — Safaricom retries if we don't
    return Response.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  } catch (err) {
    console.error('[mpesa-callback] Unhandled error:', err);
    // Still return 200 so Safaricom doesn't retry endlessly
    return Response.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});
