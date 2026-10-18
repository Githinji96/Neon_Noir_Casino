# Implementation Tasks

## Phase 1: Risk Engine Core (TypeScript)

- [ ] 1. Create `src/logic/riskEngine/types.ts` with PlayerFeatures, RiskSignal, RiskAssessment interfaces
- [ ] 2. Create `src/logic/riskEngine/featureExtractor.ts` — extractFeatures() queries 5 tables in parallel, returns PlayerFeatures
- [ ] 3. Create `src/logic/riskEngine/riskRules.ts` — 10 heuristic rules (4 fraud, 3 RG, 3 account) with point scoring and signal generation
- [ ] 4. Create `src/logic/riskEngine/riskEngine.ts` — assessPlayer() orchestrator: extract → score → signals → recommended action → persist → alert

## Phase 2: Database Migration

- [ ] 5. Create `supabase/migrations/risk_assessment.sql` — risk_assessments table, indexes, RLS policies, assess_player_risk RPC

## Phase 3: Risk Assessment Store

- [ ] 6. Create `src/store/riskAssessmentStore.ts` — Zustand store with fetchAssessments, selectAssessment, refresh, triggerAssessment, triggerBatch

## Phase 4: Admin Store Extension

- [ ] 7. Add risk assessment audit action types to `src/store/adminStore.ts` AuditActionType union

## Phase 5: Fraud Page Enhancement

- [ ] 8. Enhance `src/pages/admin/FraudPage.tsx` — add risk summary panel (4 StatCards), risk assessment DataTable, detail view, batch assessment button

## Phase 6: Build & Verify

- [ ] 9. Run `npm run build` to verify TypeScript compilation passes
- [ ] 10. Run `npm run lint` to verify no type errors
