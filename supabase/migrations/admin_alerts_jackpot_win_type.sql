-- Add 'jackpot_win' to the admin_alerts type CHECK constraint
-- so jackpot wins can be stored as admin alerts.

ALTER TABLE public.admin_alerts
  DROP CONSTRAINT IF EXISTS admin_alerts_type_check;

ALTER TABLE public.admin_alerts
  ADD CONSTRAINT admin_alerts_type_check
    CHECK (type IN ('rtp_deviation', 'large_payout', 'fraud_flag', 'jackpot_win'));
