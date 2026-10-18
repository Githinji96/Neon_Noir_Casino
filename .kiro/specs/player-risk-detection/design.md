# Design Document: Player Risk & Fraud Detection Engine

## Overview

A rules-based heuristic risk scoring engine that analyzes player behavior from existing data sources (spins, transactions, profiles, player_stats, withdrawal_fraud_logs) and produces a Risk Assessment with an overall score (0-100), three sub-scores (Fraud, RG, Account), risk signals, and recommended actions.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin Panel (React)                      │
│  FraudPage.tsx                                               │
│  ├── Risk Assessment Summary Panel                           │
│  ├── Risk Assessment Table (DataTable)                       │
│  └── Risk Detail View (signals + recommended action)        │
│                                                              │
│  riskAssessmentStore.ts (Zustand)                            │
│  ├── assessments: RiskAssessment[]                           │
│  ├── selectedAssessment: RiskAssessment | null               │
│  ├── loading, error states                                   │
│  ├── fetchAssessments(), selectAssessment(), refresh()       │
│  └── triggerAssessment(userId), triggerBatch()               │
└─────────────────────────────────────────────────────────────┘
          │                                    │
          ▼                                    ▼
┌─────────────────────┐         ┌──────────────────────────────┐
│  riskEngine.ts       │         │  Supabase                     │
│  (pure TypeScript)  │         │  ├── risk_assessments table    │
│  ├── extractFeatures│────────▶│  ├── admin_alerts table        │
│  ├── evaluateRules   │         │  ├── admin_audit_logs table   │
│  ├── generateSignals │         │  └── assess_player_risk RPC   │
│  └── recommendAction │         └──────────────────────────────┘
│                      │
│  riskRules.ts        │
│  ├── Fraud rules (4) │
│  ├── RG rules (3)    │
│  └── Account rules(3)│
└─────────────────────┘
```

## Components

### 1. Risk Engine (`src/logic/riskEngine/`)

#### types.ts
```typescript
interface PlayerFeatures {
  depositFrequency: number;      // deposits per 24h
  withdrawalFrequency: number;   // withdrawals per 24h
  averageBet: number;            // avg bet in lookback window
  betVelocity: number;            // bets per minute
  sessionDuration: number;        // hours
  numberOfSessions: number;
  winLossPattern: string;         // "win_rate_80pct_over_50" etc.
  deviceChanges: number;           // count of new devices
  loginFrequency: number;          // logins per 24h
  transactionFrequency: number;    // total txns per 24h
  rapidDeposits: number;           // deposits in 30-min window
  withdrawalAfterDeposit: boolean; // withdrawal within 10 min of deposit
  fraudLogCount: number;           // entries in withdrawal_fraud_logs
  accountStatus: string;
}

interface RiskSignal {
  description: string;
  category: 'fraud' | 'rg' | 'account';
  severity: 'high' | 'medium' | 'low';
  points: number;
}

interface RiskAssessment {
  userId: string;
  overallScore: number;       // 0-100
  fraudRisk: number;           // 0-100
  rgRisk: number;              // 0-100
  accountRisk: number;         // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  signals: RiskSignal[];
  recommendedAction: string;
  features: PlayerFeatures;
  assessedAt: string;         // ISO timestamp
}
```

#### featureExtractor.ts
- `extractFeatures(supabase, userId, lookbackDays = 90): Promise<PlayerFeatures>`
- Queries: spins, transactions, profiles, player_stats, withdrawal_fraud_logs
- All queries run in parallel via Promise.all
- Returns zeroed PlayerFeatures if no data found

#### riskRules.ts
10 rules organized in arrays:

**Fraud Rules (4):**
1. `rapidDepositRule` — 5+ deposits in 30 min → 30 points (high)
2. `withdrawalVelocityRule` — withdrawal within 10 min of deposit → 25 points (high)
3. `winRateAnomalyRule` — win rate >80% over 50 bets → 25 points (medium)
4. `betVelocityRule` — bet velocity >2x baseline → 20 points (medium)

**RG Rules (3):**
5. `depositFrequencyRule` — >10 deposits in 24h → 30 points (high)
6. `sessionDurationRule` — session >4 hours → 25 points (medium)
7. `lossChasingRule` — bet increase ≥50% after loss session → 25 points (medium)

**Account Rules (3):**
8. `deviceChangeRule` — new device login → 25 points (medium)
9. `loginFrequencyRule` — >20 logins in 24h → 25 points (medium)
10. `fraudLogRule` — any withdrawal_fraud_logs entry → 30 points (high)

Each rule: `(features: PlayerFeatures) => { points: number; signal: RiskSignal | null }`
Sub-scores capped at 100.

#### riskEngine.ts
- `assessPlayer(supabase, userId): Promise<RiskAssessment>`
- Orchestrates: extract → evaluate all rules → sum sub-scores (capped 100) → calculate overall (50% fraud + 30% RG + 20% account, capped 0-100) → determine level → generate recommended action → return RiskAssessment

### 2. Database Migration (`supabase/migrations/risk_assessment.sql`)

```sql
CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  overall_score   int NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  fraud_risk      int NOT NULL CHECK (fraud_risk >= 0 AND fraud_risk <= 100),
  rg_risk         int NOT NULL CHECK (rg_risk >= 0 AND rg_risk <= 100),
  account_risk    int NOT NULL CHECK (account_risk >= 0 AND account_risk <= 100),
  risk_level      text NOT NULL CHECK (risk_level IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  signals         jsonb NOT NULL DEFAULT '[]',
  recommended_action text NOT NULL,
  features_metadata jsonb,
  assessed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_risk_assessments_user ON public.risk_assessments(user_id);
CREATE INDEX idx_risk_assessments_level ON public.risk_assessments(risk_level);
CREATE INDEX idx_risk_assessments_time ON public.risk_assessments(assessed_at DESC);

-- RLS: super_admin and support_agent only
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read risk assessments"
  ON public.risk_assessments FOR SELECT
  USING (public.get_my_admin_role() IN ('super_admin','support_agent'));

-- SECURITY DEFINER RPC for batch assessment
CREATE OR REPLACE FUNCTION public.assess_player_risk(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  v_role := public.get_my_admin_role();
  IF v_role NOT IN ('super_admin','support_agent') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  -- Feature extraction + scoring done in application layer
  -- RPC just validates auth; frontend calls riskEngine.assessPlayer()
  RETURN jsonb_build_object('authorized', true);
END;
$$;
```

### 3. Risk Assessment Store (`src/store/riskAssessmentStore.ts`)

```typescript
interface RiskAssessmentState {
  assessments: RiskAssessment[];
  selectedAssessment: RiskAssessment | null;
  loading: boolean;
  error: string | null;
  batchProgress: { current: number; total: number } | null;

  fetchAssessments: () => Promise<void>;
  selectAssessment: (userId: string) => Promise<void>;
  refresh: () => Promise<void>;
  triggerAssessment: (userId: string, adminId: string, adminRole: string) => Promise<RiskAssessment | null>;
  triggerBatch: (adminId: string, adminRole: string) => Promise<void>;
}
```

### 4. Fraud Page Enhancement (`src/pages/admin/FraudPage.tsx`)

Add above existing fraud flags:
- Risk summary panel: 4 StatCards (LOW, MEDIUM, HIGH, CRITICAL counts)
- Risk assessment DataTable: username, score, level, sub-scores, timestamp
- Click row → inline detail view with signals and recommended action
- "Assess All Players" button for batch assessment
- Refresh button
- Preserves existing fraud flags section below

### 5. Admin Store Extension

Add to AuditActionType union:
- `'risk_assessment_manual'`
- `'risk_assessment_batch'`
- `'risk_alert_generated'`

## Data Flow

1. Admin opens Fraud Page → store fetches recent risk_assessments
2. Admin clicks "Assess Player" → store calls riskEngine.assessPlayer(userId)
3. Risk engine extracts features from 5 tables (parallel queries)
4. Risk engine evaluates 10 rules → sub-scores → overall score → level → recommended action
5. Risk assessment persisted to risk_assessments table
6. If HIGH/CRITICAL → admin_alert inserted (with 24h dedup check)
7. Audit log entry created
8. Store updates with new assessment
9. Realtime subscription surfaces alert to all admin sessions

## Security

- RLS on risk_assessments: super_admin + support_agent only
- assess_player_risk RPC: SECURITY DEFINER, checks get_my_admin_role()
- No PII beyond username and user_id in admin displays
- All queries read-only on existing tables (no writes to spins, transactions, profiles, etc.)
