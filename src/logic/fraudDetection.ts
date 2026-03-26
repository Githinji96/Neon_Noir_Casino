import { supabase } from '../lib/supabase';

interface BetRecord {
  user_id: string;
  amount: number;
  won: boolean;
  timestamp: number; // ms epoch
}

/**
 * Flags a user if they place >20 bets >KES 5,000 within any 60-second window.
 * Inserts into fraud_flags and admin_alerts on detection.
 */
export async function detectRapidHighBets(bets: BetRecord[]): Promise<void> {
  const HIGH_BET = 5000;
  const WINDOW_MS = 60_000;
  const THRESHOLD = 20;

  const highBets = bets.filter((b) => b.amount > HIGH_BET).sort((a, b) => a.timestamp - b.timestamp);

  for (let i = 0; i < highBets.length; i++) {
    const windowEnd = highBets[i].timestamp + WINDOW_MS;
    const count = highBets.filter((b) => b.timestamp >= highBets[i].timestamp && b.timestamp <= windowEnd).length;

    if (count > THRESHOLD) {
      const userId = highBets[i].user_id;
      const metadata = { count, window_start: highBets[i].timestamp, window_end: windowEnd, threshold: THRESHOLD };

      // Check if already flagged recently (avoid duplicates)
      const { data: existing } = await supabase
        .from('fraud_flags')
        .select('id')
        .eq('user_id', userId)
        .eq('reason', 'rapid_high_bets')
        .eq('dismissed', false)
        .limit(1);

      if (existing && existing.length > 0) break;

      await supabase.from('fraud_flags').insert({
        user_id: userId,
        reason: 'rapid_high_bets',
        metadata,
        dismissed: false,
        bet_limit_applied: false,
      });

      await supabase.from('admin_alerts').insert({
        type: 'fraud_flag',
        severity: 'high',
        message: `Rapid high bets detected: ${count} bets >KES ${HIGH_BET.toLocaleString()} in 60s`,
        metadata: { user_id: userId, ...metadata },
        resolved: false,
      });

      break; // one flag per call
    }
  }
}

/**
 * Flags a user if their win rate exceeds 80% over any 50-bet rolling window.
 * Inserts into fraud_flags and admin_alerts on detection.
 */
export async function detectHighWinRate(bets: BetRecord[]): Promise<void> {
  const WINDOW_SIZE = 50;
  const WIN_RATE_THRESHOLD = 0.8;

  if (bets.length < WINDOW_SIZE) return;

  for (let i = 0; i <= bets.length - WINDOW_SIZE; i++) {
    const window = bets.slice(i, i + WINDOW_SIZE);
    const wins = window.filter((b) => b.won).length;
    const winRate = wins / WINDOW_SIZE;

    if (winRate > WIN_RATE_THRESHOLD) {
      const userId = bets[i].user_id;
      const metadata = { win_rate: winRate, wins, window_size: WINDOW_SIZE, window_start_index: i };

      const { data: existing } = await supabase
        .from('fraud_flags')
        .select('id')
        .eq('user_id', userId)
        .eq('reason', 'high_win_rate')
        .eq('dismissed', false)
        .limit(1);

      if (existing && existing.length > 0) break;

      await supabase.from('fraud_flags').insert({
        user_id: userId,
        reason: 'high_win_rate',
        metadata,
        dismissed: false,
        bet_limit_applied: false,
      });

      await supabase.from('admin_alerts').insert({
        type: 'fraud_flag',
        severity: 'high',
        message: `High win rate detected: ${(winRate * 100).toFixed(1)}% over ${WINDOW_SIZE} bets`,
        metadata: { user_id: userId, ...metadata },
        resolved: false,
      });

      break;
    }
  }
}
