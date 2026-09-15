/**
 * weekly-cashback — Supabase Edge Function
 *
 * Calculates weekly cashback for all eligible users after the
 * Monday–Sunday EAT period closes (triggered Sunday night via pg_cron
 * or an external scheduler).
 *
 * Can also be called manually: POST /functions/v1/weekly-cashback
 * with { "force": true } to recalculate the just-closed week.
 *
 * Auth: requires service-role key in Authorization header.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// VIP cashback rates — must match src/config/vipConfig.ts
const CASHBACK_RATES: Record<string, number> = {
  bronze:   0.01,
  silver:   0.02,
  gold:     0.03,
  platinum: 0.04,
  diamond:  0.05,
};

const EAT_TZ = 'Africa/Nairobi'; // UTC+3, no DST

/** Returns Monday 00:00 EAT and Sunday 23:59:59 EAT for the PREVIOUS week (UTC). */
function getPreviousEATWeek(): { weekStart: Date; weekEnd: Date } {
  const now = new Date();
  // Convert to EAT by adding 3 hours
  const eatNow = new Date(now.getTime() + 3 * 3600_000);

  // Day of week: 0=Sun, 1=Mon … 6=Sat
  const dow = eatNow.getUTCDay();
  // Days since last Monday (in EAT)
  const daysSinceMonday = (dow + 6) % 7;

  // Previous Monday 00:00 EAT
  const prevMonday = new Date(eatNow);
  prevMonday.setUTCDate(eatNow.getUTCDate() - daysSinceMonday - 7);
  prevMonday.setUTCHours(0, 0, 0, 0);

  // Previous Sunday 23:59:59 EAT
  const prevSunday = new Date(prevMonday);
  prevSunday.setUTCDate(prevMonday.getUTCDate() + 6);
  prevSunday.setUTCHours(23, 59, 59, 999);

  // Convert back to UTC (EAT = UTC+3)
  const weekStart = new Date(prevMonday.getTime() - 3 * 3600_000);
  const weekEnd   = new Date(prevSunday.getTime()  - 3 * 3600_000);

  return { weekStart, weekEnd };
}

Deno.serve(async (req) => {
  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // ── Auth check — strict constant-time equality against service role key ──
    // Using includes() was insecure (substring match). We extract the Bearer token
    // and compare it byte-by-byte to prevent timing attacks.
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    // Constant-time comparison to prevent timing-based secret extraction
    const encoder = new TextEncoder();
    const tokenBytes = encoder.encode(token);
    const keyBytes   = encoder.encode(serviceKey);
    let match = tokenBytes.length === keyBytes.length;
    for (let i = 0; i < keyBytes.length; i++) {
      if (tokenBytes[i] !== keyBytes[i]) match = false;
    }
    if (!match || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceKey,
    );

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const { weekStart, weekEnd } = getPreviousEATWeek();

    console.log(`[weekly-cashback] Processing week ${weekStart.toISOString()} → ${weekEnd.toISOString()}`);

    // ── Fetch all vip_users ──────────────────────────────────────────────
    const { data: vipUsers, error: vipErr } = await supabase
      .from('vip_users')
      .select('user_id, level');

    if (vipErr) throw vipErr;
    if (!vipUsers?.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), { status: 200 });
    }

    let processed = 0;
    let skipped   = 0;
    const errors: string[] = [];

    for (const vipUser of vipUsers) {
      try {
        const userId = vipUser.user_id;
        const tier   = (vipUser.level ?? 'bronze').toLowerCase();
        const rate   = CASHBACK_RATES[tier] ?? CASHBACK_RATES.bronze;

        // Skip if record already exists for this week (idempotency)
        const { data: existing } = await supabase
          .from('weekly_cashbacks')
          .select('id, status')
          .eq('user_id', userId)
          .eq('week_start', weekStart.toISOString())
          .maybeSingle();

        if (existing && !body.force) {
          skipped++;
          continue;
        }

        // ── Aggregate eligible transactions for the week ───────────────
        // Eligible bets: type='bet' or type='spin', status='completed'
        const { data: betTxns } = await supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', userId)
          .in('type', ['bet', 'spin'])
          .eq('status', 'completed')
          .gte('created_at', weekStart.toISOString())
          .lte('created_at', weekEnd.toISOString());

        // Eligible payouts: type='win', status='completed'
        const { data: payoutTxns } = await supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', userId)
          .in('type', ['win', 'payout'])
          .eq('status', 'completed')
          .gte('created_at', weekStart.toISOString())
          .lte('created_at', weekEnd.toISOString());

        // Exclude: bonuses, refunds, cancelled, jackpot payouts
        const { data: excludedTxns } = await supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', userId)
          .in('type', ['bonus', 'refund', 'jackpot'])
          .gte('created_at', weekStart.toISOString())
          .lte('created_at', weekEnd.toISOString());

        const totalBets     = (betTxns ?? []).reduce((s, t) => s + (t.amount ?? 0), 0);
        const totalPayouts  = (payoutTxns ?? []).reduce((s, t) => s + (t.amount ?? 0), 0);
        const totalExcluded = (excludedTxns ?? []).reduce((s, t) => s + (t.amount ?? 0), 0);

        const eligibleNetLoss   = Math.max(0, totalBets - totalPayouts - totalExcluded);
        const cashbackAmount    = Math.round(eligibleNetLoss * rate * 100) / 100;

        const recordData = {
          user_id:           userId,
          week_start:        weekStart.toISOString(),
          week_end:          weekEnd.toISOString(),
          vip_tier:          tier,
          cashback_rate:     rate,
          eligible_bets:     Math.round(totalBets * 100) / 100,
          eligible_payouts:  Math.round(totalPayouts * 100) / 100,
          eligible_net_loss: Math.round(eligibleNetLoss * 100) / 100,
          cashback_amount:   cashbackAmount,
          status:            cashbackAmount > 0 ? 'READY_TO_CLAIM' : 'EXPIRED',
          calculated_at:     new Date().toISOString(),
          updated_at:        new Date().toISOString(),
        };

        if (existing) {
          // Update existing (force mode)
          await supabase
            .from('weekly_cashbacks')
            .update(recordData)
            .eq('id', existing.id);
        } else {
          await supabase
            .from('weekly_cashbacks')
            .insert(recordData);
        }

        processed++;
      } catch (userErr) {
        const msg = userErr instanceof Error ? userErr.message : String(userErr);
        errors.push(`${vipUser.user_id}: ${msg}`);
        console.error(`[weekly-cashback] error for user ${vipUser.user_id}:`, msg);
      }
    }

    console.log(`[weekly-cashback] Done. processed=${processed} skipped=${skipped} errors=${errors.length}`);

    return new Response(JSON.stringify({ ok: true, processed, skipped, errors }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[weekly-cashback] fatal:', msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500 });
  }
});
