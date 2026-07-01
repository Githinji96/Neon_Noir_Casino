import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { getTierForPoints, type VIPTier } from '../config/vipConfig';

export interface VIPState {
  totalPoints: number;
  monthlyPoints: number;
  currentTier: VIPTier;
  cashbackAvailable: number;
  loading: boolean;

  loadVIP: (userId: string) => Promise<void>;
  awardPoints: (userId: string, amount: number, source: 'bet' | 'deposit') => Promise<void>;
  claimCashback: (userId: string) => Promise<number>;
  recordLoss: (userId: string, lossAmount: number) => Promise<void>;
}

export const useVIPStore = create<VIPState>()(
  persist(
    (set, get) => ({
      totalPoints: 0,
      monthlyPoints: 0,
      currentTier: getTierForPoints(0),
      cashbackAvailable: 0,
      loading: false,

      loadVIP: async (userId) => {
        set({ loading: true });
        try {
          const { data, error } = await supabase
            .from('vip_users')
            .select('*')
            .eq('user_id', userId)
            .single();

          if (data) {
            const tier = getTierForPoints(data.total_points ?? 0);
            set({
              totalPoints: data.total_points ?? 0,
              monthlyPoints: data.monthly_points ?? 0,
              currentTier: tier,
              cashbackAvailable: data.cashback_available ?? 0,
            });
          } else if (error?.code === 'PGRST116') {
            // Row not found — create it
            await supabase.from('vip_users').insert({
              user_id: userId,
              level: 'bronze',
              total_points: 0,
              monthly_points: 0,
              cashback_available: 0,
            });
          }
        } catch {
          // Table may not exist yet — silently continue with local state
        } finally {
          set({ loading: false });
        }
      },

      awardPoints: async (userId, amount, source) => {
        const { currentTier, totalPoints, monthlyPoints, cashbackAvailable } = get();
        const rate = source === 'bet'
          ? currentTier.pointsPerBetKES
          : currentTier.pointsPerDepositKES;

        const earned = Math.floor(amount * rate);
        if (earned <= 0) return;

        const newTotal = totalPoints + earned;
        const newMonthly = monthlyPoints + earned;
        const newTier = getTierForPoints(newTotal);

        // Update local state immediately
        set({ totalPoints: newTotal, monthlyPoints: newMonthly, currentTier: newTier });

        // Persist full row to Supabase (include all fields to avoid partial overwrites)
        supabase.from('vip_users').upsert({
          user_id: userId,
          level: newTier.level,
          total_points: newTotal,
          monthly_points: newMonthly,
          cashback_available: cashbackAvailable,
          last_updated: new Date().toISOString(),
        }, { onConflict: 'user_id' }).then(({ error }) => {
          if (error && import.meta.env.DEV) console.warn('[VIP] upsert failed:', error.message);
        });

        supabase.from('vip_transactions').insert({
          user_id: userId,
          points_earned: earned,
          source,
        }).then(() => {});
      },

      recordLoss: async (userId, lossAmount) => {
        if (lossAmount <= 0) return;
        const { currentTier, cashbackAvailable, totalPoints, monthlyPoints } = get();
        const cashback = Math.round(lossAmount * (currentTier.cashbackRate / 100) * 100) / 100;
        const newCashback = Math.round((cashbackAvailable + cashback) * 100) / 100;
        set({ cashbackAvailable: newCashback });

        supabase.from('vip_users').upsert({
          user_id: userId,
          level: currentTier.level,
          total_points: totalPoints,
          monthly_points: monthlyPoints,
          cashback_available: newCashback,
        }, { onConflict: 'user_id' }).then(() => {});
      },

      claimCashback: async (userId) => {
        const { cashbackAvailable, totalPoints, monthlyPoints, currentTier } = get();
        if (cashbackAvailable <= 0) return 0;

        const amount = cashbackAvailable;
        set({ cashbackAvailable: 0 });

        await supabase.from('vip_users').upsert({
          user_id: userId,
          level: currentTier.level,
          total_points: totalPoints,
          monthly_points: monthlyPoints,
          cashback_available: 0,
        }, { onConflict: 'user_id' });

        supabase.from('vip_benefits_log').insert({
          user_id: userId,
          benefit_type: 'cashback',
          amount,
        }).then(() => {});

        return amount;
      },
    }),
    {
      name: 'neon-noir-vip',
      // Persist points locally so they show even if DB is unavailable
      partialize: (s) => ({
        totalPoints: s.totalPoints,
        monthlyPoints: s.monthlyPoints,
        cashbackAvailable: s.cashbackAvailable,
      }),
    }
  )
);
