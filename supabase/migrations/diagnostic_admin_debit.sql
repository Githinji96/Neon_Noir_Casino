-- ============================================================
-- DIAGNOSTIC: Run this first to find the exact failure reason
-- before applying fix_admin_debit_rls.sql
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Check your admin role
SELECT id, username, admin_role, account_status
FROM public.profiles
WHERE admin_role IS NOT NULL;

-- 2. Check casino_account exists and has the seed row
SELECT * FROM public.casino_account;

-- 3. Check which RLS policies exist on casino_account
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'casino_account';

-- 4. Check which version of admin_debit_player is active
--    (look at prosrc for the function body)
SELECT proname, prosecdef, proowner::regrole
FROM pg_proc
WHERE proname IN ('admin_debit_player', 'admin_credit_player', 'get_my_admin_role');

-- 5. Check which guard_balance_update trigger version is active
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'guard_balance_update';

-- 6. Check transactions table has the notes column
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'transactions'
  AND column_name IN ('notes', 'casino_impact', 'previous_player_balance', 'new_player_balance');

-- 7. Quick test call (replace the UUIDs with real values from your DB)
-- SELECT public.admin_debit_player(
--   '<player_uuid>',   -- p_player_id
--   1.00,              -- p_amount
--   'diagnostic test', -- p_reason
--   '<admin_uuid>'     -- p_admin_id
-- );
