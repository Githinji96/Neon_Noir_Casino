/**
 * mpesa-reversal — Supabase Edge Function
 *
 * Handles M-Pesa reversal notifications from Safaricom Daraja API.
 * Safaricom POST this to the ResultURL configured in the reversal API call.
 *
 * When a reversal is confirmed:
 *  1. Looks up the original transaction by MpesaReceiptNumber
 *  2. Deducts the reversed amount from the user's wallet (atomically)
 *  3. Inserts an audit record in the transactions table
 *  4. Always returns HTTP 200 — Safaricom retries if they get anything else
 *
 * Reversal API payload shape (Daraja B2C/C2B Reversal Result):
 * {
 *   Result: {
 *     ResultType: 0,
 *     ResultCode: 0,
 *     ResultDesc: "The service request is processed successfully.",
 *     OriginatorConversationID: "...",
 *     ConversationID: "...",
 *     TransactionID: "QGH...",          ← reversal receipt
 *     ReferenceData: {
 *       ReferenceItem: {
 *         Key: "OriginalTransactionID", ← original MpesaReceiptNumber
 *         Value: "QEH..."
 *       }
 *     }
 *   }
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function ok(extra?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted', ...extra }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    console.log('[mpesa-reversal] Raw body:', JSON.stringify(body));

    const result = body?.Result;
    if (!result) {
      console.error('[mpesa-reversal] No Result in payload');
      return ok();
    }

    const resultCode = Number(result.ResultCode ?? -1);
    const resultDesc = result.ResultDesc ?? '';

    // ── Extract original transaction ID and reversal receipt ──────────────
    // Daraja puts them in ReferenceData.ReferenceItem (can be array or object)
    let originalTransactionId: string | null = null;
    const reversalReceipt: string = result.TransactionID ?? '';

    const refData = result.ReferenceData?.ReferenceItem;
    if (Array.isArray(refData)) {
      const item = refData.find(
        (r: { Key: string; Value: string }) => r.Key === 'OriginalTransactionID',
      );
      originalTransactionId = item?.Value ?? null;
    } else if (refData?.Key === 'OriginalTransactionID') {
      originalTransactionId = refData.Value ?? null;
    }

    // Also accept the amount from ResultParameters if present
    const params: { Key: string; Value: unknown }[] =
      result.ResultParameters?.ResultParameter ?? [];
    const getParam = (key: string) =>
      params.find((p) => p.Key === key)?.Value ?? null;

    const reversedAmount = Number(getParam('ReversedAmount') ?? getParam('Amount') ?? 0);

    console.log(
      '[mpesa-reversal] resultCode:', resultCode,
      'originalTxnId:', originalTransactionId,
      'reversalReceipt:', reversalReceipt,
      'reversedAmount:', reversedAmount,
    );

    if (resultCode !== 0) {
      // Reversal request failed or was rejected — no action needed
      console.log(`[mpesa-reversal] Reversal NOT successful (code ${resultCode}): ${resultDesc}`);
      return ok();
    }

    if (!originalTransactionId) {
      console.error('[mpesa-reversal] Could not extract OriginalTransactionID from payload');
      return ok();
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // ── Look up original transaction to get the amount if not in payload ──
    const { data: originalTxn } = await supabase
      .from('transactions')
      .select('id, user_id, amount, status')
      .eq('mpesa_receipt', originalTransactionId)
      .single();

    if (!originalTxn) {
      console.error('[mpesa-reversal] Original transaction not found for receipt:', originalTransactionId);
      return ok();
    }

    // Use confirmed amount from payload; fall back to original transaction amount
    const amountToDeduct = reversedAmount > 0 ? reversedAmount : originalTxn.amount;

    // ── Atomic deduction via database function ─────────────────────────────
    const { data: rpcResult, error: rpcErr } = await supabase.rpc(
      'process_mpesa_reversal',
      {
        p_mpesa_receipt:    originalTransactionId,
        p_reversal_receipt: reversalReceipt,
        p_reversed_amount:  amountToDeduct,
      },
    );

    if (rpcErr) {
      console.error('[mpesa-reversal] RPC error:', rpcErr.message);
      // Still return 200 to Safaricom — we'll investigate via logs
      return ok();
    }

    const res = rpcResult as {
      ok: boolean;
      error?: string;
      skipped?: boolean;
      deducted?: number;
      new_balance?: number;
      user_id?: string;
    };

    if (res.ok) {
      if (res.skipped) {
        console.log('[mpesa-reversal] Already processed (idempotent skip):', originalTransactionId);
      } else {
        console.log(
          `[mpesa-reversal] ✅ Reversed KES ${res.deducted} from user ${res.user_id}.` +
          ` New balance: ${res.new_balance}`,
        );
      }
    } else {
      console.error('[mpesa-reversal] RPC returned not-ok:', res.error, {
        originalTransactionId,
        reversalReceipt,
        amountToDeduct,
      });
    }

    return ok();
  } catch (err) {
    console.error('[mpesa-reversal] Unhandled error:', err);
    // Always 200 so Safaricom doesn't retry indefinitely
    return ok();
  }
});
