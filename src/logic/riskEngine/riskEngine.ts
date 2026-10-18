/**
 * Risk Engine — Main Orchestrator
 *
 * assessPlayer(userId) — full pipeline:
 *   1. Extract PlayerFeatures from DB
 *   2. Run all heuristic rules per category
 *   3. Calculate sub-scores (capped 0-100) and weighted overall score
 *   4. Derive risk level and recommended action
 *   5. Persist result to risk_assessments table
 *   6. Insert admin_alert for HIGH/CRITICAL (24h dedup)
 *   7. Return RiskAssessment
 */
import { supabase } from '../../lib/supabase';
import { extractFeatures } from './featureExtractor';
import { FRAUD_RULES, RG_RULES, ACCOUNT_RULES } from './riskRules';
import {
  SCORE_WEIGHTS,
  RISK_LEVEL_THRESHOLDS,
  type RiskAssessment,
  type RiskSignal,
} from './types';

// ── Score helpers ─────────────────────────────────────────────────────────────

function cap(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function computeSubScore(rules: typeof FRAUD_RULES, features: Parameters<typeof FRAUD_RULES[0]>[0]): {
  score: number;
  signals: RiskSignal[];
} {
  let total = 0;
  const signals: RiskSignal[] = [];
  for (const rule of rules) {
    const result = rule(features);
    total += result.points;
    if (result.signal) signals.push(result.signal);
  }
  return { score: cap(total), signals };
}

function deriveRiskLevel(score: number): RiskAssessment['riskLevel'] {
  if (score >= RISK_LEVEL_THRESHOLDS.CRITICAL) return 'CRITICAL';
  if (score >= RISK_LEVEL_THRESHOLDS.HIGH)     return 'HIGH';
  if (score >= RISK_LEVEL_THRESHOLDS.MEDIUM)   return 'MEDIUM';
  return 'LOW';
}

function deriveRecommendedAction(
  level: RiskAssessment['riskLevel'],
  fraudScore: number,
  rgScore: number,
): string {
  // Overrides take priority
  if (fraudScore >= 80) return 'Investigate fraud';
  if (rgScore >= 80)    return 'Apply responsible gaming limits';

  switch (level) {
    case 'CRITICAL': return 'Immediate account review required';
    case 'HIGH':     return 'Flag for manual review';
    case 'MEDIUM':   return 'Monitor player activity';
    default:         return 'No action required';
  }
}

// ── Alert dedup helper ────────────────────────────────────────────────────────

async function insertAlertIfNeeded(
  userId: string,
  level: RiskAssessment['riskLevel'],
  overallScore: number,
): Promise<void> {
  if (level !== 'HIGH' && level !== 'CRITICAL') return;

  // 24h dedup: skip if a risk alert for this player was inserted recently
  const since = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
  const { data: existing } = await supabase
    .from('admin_alerts')
    .select('id')
    .eq('resolved', false)
    .contains('metadata', { user_id: userId })
    .gte('created_at', since)
    .limit(1);

  if (existing && existing.length > 0) return; // already alerted within 24h

  const severity = level === 'CRITICAL' ? 'high' : 'medium';
  await supabase.from('admin_alerts').insert({
    type: 'fraud_flag',
    severity,
    message: `Player risk assessment: ${level} (score ${overallScore}/100)`,
    metadata: { user_id: userId, risk_level: level, overall_score: overallScore },
    resolved: false,
  });
}

// ── Main assessPlayer function ────────────────────────────────────────────────

/**
 * Run the full risk assessment pipeline for a single player.
 * @param userId — UUID of the player to assess
 * @returns RiskAssessment — complete result including score, level, signals
 */
export async function assessPlayer(userId: string): Promise<RiskAssessment> {
  // Step 1: Extract features
  const features = await extractFeatures(userId);

  // Step 2: Evaluate rules per category
  const fraud   = computeSubScore(FRAUD_RULES,   features);
  const rg      = computeSubScore(RG_RULES,      features);
  const account = computeSubScore(ACCOUNT_RULES, features);

  // Step 3: Weighted overall score
  const overallScore = cap(
    fraud.score   * SCORE_WEIGHTS.fraud +
    rg.score      * SCORE_WEIGHTS.rg +
    account.score * SCORE_WEIGHTS.account,
  );

  // Step 4: Risk level + recommended action
  const riskLevel        = deriveRiskLevel(overallScore);
  const allSignals       = [...fraud.signals, ...rg.signals, ...account.signals];
  const recommendedAction = deriveRecommendedAction(riskLevel, fraud.score, rg.score);

  const assessedAt = new Date().toISOString();

  const assessment: RiskAssessment = {
    userId,
    overallScore,
    fraudRisk:   fraud.score,
    rgRisk:      rg.score,
    accountRisk: account.score,
    riskLevel,
    signals:     allSignals,
    recommendedAction,
    features,
    assessedAt,
  };

  // Step 5: Persist to risk_assessments table (upsert by user_id — keeps latest)
  // Wrapped in try/catch so a missing table or RLS error doesn't block returning the result
  try {
    const { error: upsertErr } = await supabase.from('risk_assessments').upsert(
      {
        user_id:             userId,
        overall_score:       overallScore,
        fraud_risk:          fraud.score,
        rg_risk:             rg.score,
        account_risk:        account.score,
        risk_level:          riskLevel,
        signals:             allSignals,
        recommended_action:  recommendedAction,
        features_metadata:   features as unknown as Record<string, unknown>,
        assessed_at:         assessedAt,
      },
      { onConflict: 'user_id' },
    );
    if (upsertErr) {
      console.warn('[riskEngine] upsert failed (table may not exist yet):', upsertErr.message);
    }
  } catch (persistErr) {
    console.warn('[riskEngine] persist error:', persistErr);
  }

  // Step 6: Insert alert for HIGH/CRITICAL (with 24h dedup)
  try {
    await insertAlertIfNeeded(userId, riskLevel, overallScore);
  } catch (alertErr) {
    console.warn('[riskEngine] alert insert failed:', alertErr);
  }

  return assessment;
}

/**
 * Assess all active players in batches of 20.
 * Reports progress via the onProgress callback.
 * @param onProgress — called with (completed, total) after each player
 */
export async function assessAllPlayers(
  onProgress?: (completed: number, total: number) => void,
): Promise<RiskAssessment[]> {
  // Fetch all non-banned player IDs
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .neq('account_status', 'banned')
    .limit(500); // safety cap — extend when needed

  if (!profiles || profiles.length === 0) return [];

  const results: RiskAssessment[] = [];
  const BATCH = 20;

  for (let i = 0; i < profiles.length; i += BATCH) {
    const batch = profiles.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map((p) => assessPlayer(p.id)));
    results.push(...batchResults);
    onProgress?.(Math.min(i + BATCH, profiles.length), profiles.length);
  }

  return results;
}
