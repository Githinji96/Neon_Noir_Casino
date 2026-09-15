/**
 * mpesa-b2c-callback — handles Daraja B2C Result and QueueTimeout callbacks.
 * Marks the withdrawal transaction as completed or failed.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    console.log('[mpesa-b2c-callback] Raw body:', JSON.stringify(body));

    const result = body?.Result;
    if (!result) {
      console.error('[mpesa-b2c-callback] No Result in body');
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), { status: 200 });
    }

    const resultCode        = Number(result.ResultCode ?? -1);
    const conversationId    = result.ConversationID as string;
    const transactionId     = result.TransactionID as string; // M-Pesa receipt

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    if (resultCode === 0) {
      // Success — mark completed and store receipt
      const { error } = await supabase
        .from('transactions')
        .update({
          status:        'completed',
          approved_at:   new Date().toISOString(),
          mpesa_receipt: transactionId,
        })
        .eq('checkout_request_id', conversationId)
        .in('status', ['processing', 'approved']);

      if (error) console.error('[mpesa-b2c-callback] Update failed:', error.message);
      else console.log(`[mpesa-b2c-callback] ✅ Withdrawal completed. ConversationID: ${conversationId}`);
    } else {
      // Failed — revert to approved so admin can retry
      console.warn(`[mpesa-b2c-callback] B2C failed (code ${resultCode}). Reverting to approved.`);
      await supabase
        .from('transactions')
        .update({ status: 'approved' })
        .eq('checkout_request_id', conversationId)
        .eq('status', 'processing');
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), { status: 200 });
  } catch (err) {
    console.error('[mpesa-b2c-callback] Error:', err);
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), { status: 200 });
  }
});
