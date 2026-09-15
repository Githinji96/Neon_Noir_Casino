import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { getTierForPoints, type VIPTier } from '../config/vipConfig';

export type WeeklyCashbackStatus = 'ACCUMULATING' | 'READY_TO_CLAIM' | 'CLAIMED' | 'EXPIRED';

export interface WeeklyCashback {
  id: string;
  weekStart: string;   // ISO string UTC
  weekEnd: string;     // ISO string UTC
  vipTier: string;
  cashbackRate: number;
  eligibleBets: number;
  eligiblePayouts: number;
  eligibleNetLoss: number;
  cashbackAmount: number;
  status: WeeklyCashbackStatus;
  calculatedAt: string | null;
  claimedAt: string | null;
}

export interface VIPState {
  totalPoints: number;
  monthlyPoints: number;
  currentTier: VIPTier;
  loading: boolean;

  // Weekly cashback
  currentWeekCashback: WeeklyCashback | null;
  cashbackHistory: WeeklyCashback[];
  claimingCashback: boolean;

  loadVIP: (userId: string) => Promise<void>;
  awardPoints: (userId: string, amount: number, source: 'bet' | 'deposit') => Promise<void>;
  claimWeeklyCashback: (userId: string) => Promise<{ ok: boolean; amount: number; error?: string }>;

  // Legacy — kept so existing slot spin logic still compiles
  cashbackAvailable: number;
  recordLoss: (userId: string, lossAmount: number) => Promise<void>;
  claimCashback: (userId: string) => Promise<number>;
}

/** Returns Monday 00:00 EAT and Sunday 23:59:59 EAT for the CURRENT week as UTC Dates. */
function getCurrentEATWeekBounds(): { weekStart: Date; weekEnd: Date } {
  const now = new Date();
  // Shift to EAT (UTC+3)
  const eatNow = new Date(now.getTime() + 3 * 3600_000);
  const dow = eatNow.getUTCDay(); // 0=Sun…6=Sat
  const daysSinceMonday = (dow + 6) % 7;

  const monday = new Date(eatNow);
  monday.setUTCDate(eatNow.getUTCDate() - daysSinceMonday);
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  // Convert back from EAT to UTC
  return {
    weekStart: new Date(monday.getTime() - 3 * 3600_000),
    weekEnd:   new Date(sunday.getTime()  - 3 * 3600_000),
  };
}

function rowToWeeklyCashback(row: Record<string, unknown>): WeeklyCashback {
  return {
    id:               row.id as string,
    weekStart:        row.week_start as string,
    weekEnd:          row.week_end as string,
    vipTier:          row.vip_tier as string,
    cashbackRate:     Number(row.cashback_rate),
    eligibleBets:     Number(row.eligible_bets),
    eligiblePayouts:  Number(row.eligible_payouts),
    eligibleNetLoss:  Number(row.eligible_net_loss),
    cashbackAmount:   Number(row.cashback_amount),
    status:           row.status as WeeklyCashbackStatus,
    calculatedAt:     row.calculated_at as string | null,
    claimedAt:        row.claimed_at as string | null,
  };
}

export const useVIPStore = create<VIPState>()(
  persist(
    (set, get) => ({
      totalPoints: 0,
      monthlyPoints: 0,
      currentTier: getTierForPoints(0),
      loading: false,
      currentWeekCashback: null,
      cashbackHistory: [],
      claimingCashback: false,

      // Legacy field — kept for backward compat
      cashbackAvailable: 0,

      loadVIP: async (userId) => {
        set({ loading: true });
        try {
          // ── VIP row ────────────────────────────────────────────────────
          const { data: vipData, error: vipErr } = await supabase
            .from('vip_users')
            .select('*')
            .eq('user_id', userId)
            .single();

          if (vipData) {
            const tier = getTierForPoints(vipData.total_points ?? 0);
            set({
              totalPoints:   vipData.total_points ?? 0,
              monthlyPoints: vipData.monthly_points ?? 0,
              currentTier:   tier,
            });
          } else if (vipErr?.code === 'PGRST116') {
            await supabase.from('vip_users').insert({
              user_id:       userId,
              level:         'bronze',
              total_points:  0,
              monthly_points: 0,
            });
          }

          // ── Current week cashback ──────────────────────────────────────
          const { weekStart } = getCurrentEATWeekBounds();

          const { data: currentWC } = await supabase
            .from('weekly_cashbacks')
            .select('*')
            .eq('user_id', userId)
            .eq('week_start', weekStart.toISOString())
            .maybeSingle();

          set({
            currentWeekCashback: currentWC ? rowToWeeklyCashback(currentWC as Record<string, unknown>) : null,
          });

          // ── History (last 10 weeks, exclude current) ───────────────────
          const { data: history } = await supabase
            .from('weekly_cashbacks')
            .select('*')
            .eq('user_id', userId)
            .neq('week_start', weekStart.toISOString())
            .order('week_start', { ascending: false })
            .limit(10);

          set({
            cashbackHistory: (history ?? []).map((r) =>
              rowToWeeklyCashback(r as Record<string, unknown>)
            ),
          });

        } catch {
          // Table may not exist yet — silently continue
        } finally {
          set({ loading: false });
        }
      },

      awardPoints: async (userId, amount, source) => {
        const { currentTier, totalPoints, monthlyPoints } = get();
        const rate = source === 'bet'
          ? currentTier.pointsPerBetKES
          : currentTier.pointsPerDepositKES;

        const earned = Math.floor(amount * rate);
        if (earned <= 0) return;

        const newTotal   = totalPoints + earned;
        const newMonthly = monthlyPoints + earned;
        const newTier    = getTierForPoints(newTotal);

        set({ totalPoints: newTotal, monthlyPoints: newMonthly, currentTier: newTier });

        supabase.from('vip_users').upsert({
          user_id:        userId,
          level:          newTier.level,
          total_points:   newTotal,
          monthly_points: newMonthly,
          last_updated:   new Date().toISOString(),
        }, { onConflict: 'user_id' }).then(({ error }) => {
          if (error && import.meta.env.DEV) console.warn('[VIP] upsert failed:', error.message);
        });

        supabase.from('vip_transactions').insert({
          user_id:      userId,
          points_earned: earned,
          source,
        }).then(() => {});
      },

      claimWeeklyCashback: async (userId) => {
        const { currentWeekCashback } = get();
        if (!currentWeekCashback || currentWeekCashback.status !== 'READY_TO_CLAIM') {
          return { ok: false, amount: 0, error: 'not_claimable' };
        }

        set({ claimingCashback: true });
        try {
          const { data, error } = await supabase.rpc('claim_weekly_cashback', {
            p_user_id:   userId,
            p_record_id: currentWeekCashback.id,
          });

          if (error) {
            return { ok: false, amount: 0, error: error.message };
          }

          const result = data as { ok: boolean; amount: number; new_balance: number; error?: string };

          if (result.ok) {
            // Update local cashback record to CLAIMED
            set((s) => ({
              currentWeekCashback: s.currentWeekCashback
                ? { ...s.currentWeekCashback, status: 'CLAIMED', claimedAt: new Date().toISOString() }
                : null,
            }));
            return { ok: true, amount: result.amount };
          }

          return { ok: false, amount: 0, error: result.error ?? 'unknown' };
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unexpected error';
          return { ok: false, amount: 0, error: msg };
        } finally {
          set({ claimingCashback: false });
        }
      },

      // ── Legacy stubs — no-ops; daily cashback replaced by weekly ──────
      recordLoss: async (_userId, _lossAmount) => {
        // No-op: cashback is now calculated weekly by the edge function
      },
      claimCashback: async (_userId) => 0,
    }),
    {
      name: 'neon-noir-vip',
      partialize: (s) => ({
        totalPoints:   s.totalPoints,
        monthlyPoints: s.monthlyPoints,
      }),
    }
  )
);
