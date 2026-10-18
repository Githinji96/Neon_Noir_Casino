/**
 * Feature Extractor — Queries player data from 5 tables and builds PlayerFeatures.
 *
 * Runs all queries in parallel via Promise.all for efficiency.
 * Returns a zeroed PlayerFeatures object if no data is found in the lookback window.
 */
import { supabase } from '../../lib/supabase';
import type { PlayerFeatures } from './types';

const LOOKBACK_DAYS = 90;

/** Zeroed features for players with no activity. */
function emptyFeatures(): PlayerFeatures {
  return {
    depositFrequency: 0,
    withdrawalFrequency: 0,
    averageBet: 0,
    betVelocity: 0,
    sessionDuration: 0,
    numberOfSessions: 0,
    winLossPattern: '',
    deviceChanges: 0,
    loginFrequency: 0,
    transactionFrequency: 0,
    rapidDeposits: 0,
    withdrawalAfterDeposit: false,
    fraudLogCount: 0,
    accountStatus: 'active',
    historicalAvgBet: 0,
    recentLossSession: false,
    betIncreaseAfterLoss: 0,
  };
}

/**
 * Extract behavioral features for a player from existing database tables.
 * @param userId — The player's UUID
 * @param lookbackDays — How many days back to look (default 90)
 */
export async function extractFeatures(
  userId: string,
  lookbackDays: number = LOOKBACK_DAYS,
): Promise<PlayerFeatures> {
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);
  const lookbackIso = lookbackDate.toISOString();

  // Run all 5 data source queries in parallel
  const [spinsRes, txRes, profileRes, statsRes, fraudRes] = await Promise.all([
    // 1. Spins — bet/payout records
    supabase
      .from('spins')
      .select('bet, payout, created_at')
      .eq('user_id', userId)
      .gte('created_at', lookbackIso)
      .order('created_at', { ascending: true }),

    // 2. Transactions — deposits and withdrawals
    supabase
      .from('transactions')
      .select('type, status, amount, created_at')
      .eq('user_id', userId)
      .gte('created_at', lookbackIso)
      .order('created_at', { ascending: true }),

    // 3. Profile — account status, phone verified, registration
    supabase
      .from('profiles')
      .select('account_status, phone_verified, created_at')
      .eq('id', userId)
      .single(),

    // 4. Player stats — cumulative betting stats
    supabase
      .from('player_stats')
      .select('total_bets, total_bet_amount, total_wins, current_session_bets')
      .eq('user_id', userId)
      .maybeSingle(),

    // 5. Withdrawal fraud logs — recorded fraud attempts
    supabase
      .from('withdrawal_fraud_logs')
      .select('id, created_at')
      .eq('user_id', userId),
  ]);

  const features = emptyFeatures();

  // ── Process spins data ──────────────────────────────────────────────
  const spins = spinsRes.data ?? [];
  if (spins.length > 0) {
    const totalBet = spins.reduce((s, r) => s + (r.bet ?? 0), 0);
    features.averageBet = spins.length > 0 ? totalBet / spins.length : 0;

    // Bet velocity: bets per minute (using time span of all spins)
    if (spins.length >= 2) {
      const firstTime = new Date(spins[0].created_at).getTime();
      const lastTime = new Date(spins[spins.length - 1].created_at).getTime();
      const minutesSpan = Math.max(1, (lastTime - firstTime) / 60000);
      features.betVelocity = spins.length / minutesSpan;
    }

    // Win/loss pattern: check for >80% win rate over 50-bet rolling window
    if (spins.length >= 50) {
      let maxWinRate = 0;
      for (let i = 0; i <= spins.length - 50; i++) {
        const window = spins.slice(i, i + 50);
        const wins = window.filter((s) => (s.payout ?? 0) > (s.bet ?? 0)).length;
        const winRate = wins / 50;
        if (winRate > maxWinRate) maxWinRate = winRate;
      }
      if (maxWinRate > 0.8) {
        features.winLossPattern = `win_rate_${Math.round(maxWinRate * 100)}pct_over_50`;
      }
    }

    // Detect loss session (recent)
    const recentSpins = spins.slice(-20);
    const recentNet = recentSpins.reduce((s, r) => s + ((r.payout ?? 0) - (r.bet ?? 0)), 0);
    features.recentLossSession = recentNet < 0;

    // Bet increase after loss — compare avg bet of last 20 vs previous 20
    if (spins.length >= 40 && features.recentLossSession) {
      const prevAvg = spins.slice(-40, -20).reduce((s, r) => s + (r.bet ?? 0), 0) / 20;
      const recentAvg = recentSpins.reduce((s, r) => s + (r.bet ?? 0), 0) / 20;
      if (prevAvg > 0) {
        features.betIncreaseAfterLoss = ((recentAvg - prevAvg) / prevAvg) * 100;
      }
    }

    // Session count — estimate by gaps >30 min between spins
    let sessionCount = 1;
    for (let i = 1; i < spins.length; i++) {
      const gap = new Date(spins[i].created_at).getTime() - new Date(spins[i - 1].created_at).getTime();
      if (gap > 30 * 60_000) sessionCount++;
    }
    features.numberOfSessions = sessionCount;

    // Session duration — estimate from first to last spin per session
    if (spins.length >= 2) {
      const totalMs = new Date(spins[spins.length - 1].created_at).getTime() - new Date(spins[0].created_at).getTime();
      features.sessionDuration = totalMs / (1000 * 60 * 60); // hours
    }

    // Historical avg bet (baseline) — use earlier half of spins
    const midpoint = Math.floor(spins.length / 2);
    if (midpoint > 0) {
      features.historicalAvgBet = spins.slice(0, midpoint).reduce((s, r) => s + (r.bet ?? 0), 0) / midpoint;
    }
  }

  // ── Process transactions data ───────────────────────────────────────
  const transactions = txRes.data ?? [];
  if (transactions.length > 0) {
    const successfulTx = transactions.filter((t) => t.status === 'success');

    // Deposit frequency: deposits per 24h (average over lookback window)
    const deposits = successfulTx.filter((t) => t.type === 'deposit');
    const lookbackHours = lookbackDays * 24;
    features.depositFrequency = deposits.length / (lookbackHours / 24);

    // Withdrawal frequency: withdrawals per 24h
    const withdrawals = successfulTx.filter((t) => t.type === 'withdrawal');
    features.withdrawalFrequency = withdrawals.length / (lookbackHours / 24);

    // Transaction frequency: total txns per 24h
    features.transactionFrequency = successfulTx.length / (lookbackHours / 24);

    // Rapid deposits: max deposits in any 30-minute window
    if (deposits.length >= 5) {
      for (let i = 0; i < deposits.length; i++) {
        const windowEnd = new Date(deposits[i].created_at).getTime() + 30 * 60_000;
        const count = deposits.filter(
          (d) => new Date(d.created_at).getTime() >= new Date(deposits[i].created_at).getTime()
            && new Date(d.created_at).getTime() <= windowEnd,
        ).length;
        if (count > features.rapidDeposits) features.rapidDeposits = count;
      }
    }

    // Withdrawal after deposit: withdrawal within 10 min of a deposit
    for (const dep of deposits) {
      const depTime = new Date(dep.created_at).getTime();
      const hasQuickWithdrawal = withdrawals.some(
        (w) => Math.abs(new Date(w.created_at).getTime() - depTime) <= 10 * 60_000,
      );
      if (hasQuickWithdrawal) {
        features.withdrawalAfterDeposit = true;
        break;
      }
    }
  }

  // ── Process profile data ────────────────────────────────────────────
  const profile = profileRes.data;
  if (profile) {
    features.accountStatus = profile.account_status ?? 'active';
  }

  // ── Process player stats ───────────────────────────────────────────
  const stats = statsRes.data;
  if (stats) {
    // Use current_session_bets for login frequency approximation
    features.loginFrequency = (stats.current_session_bets ?? 0) / lookbackDays;
  }

  // ── Process fraud logs ─────────────────────────────────────────────
  features.fraudLogCount = fraudRes.data?.length ?? 0;

  return features;
}
