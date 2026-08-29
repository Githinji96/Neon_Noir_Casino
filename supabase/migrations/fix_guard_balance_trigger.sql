-- ============================================================
-- Fix: guard_balance_update trigger incorrectly blocks wins from
-- SECURITY DEFINER RPCs (apply_spin_result, admin_credit_player, etc.)
--
-- Root cause: current_setting('role') returns the SESSION role
-- ('authenticated'), not the function owner role. So SECURITY DEFINER
-- functions were not being exempted and balance increases were rejected.
--
-- Fix: also exempt when current_user <> session_user, which is the
-- canonical PostgreSQL way to detect you are inside a SECURITY DEFINER
-- function (the function owner differs from the session caller).
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_balance_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Exempt 1: service role (edge functions, admin operations)
  IF current_setting('role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Exempt 2: SECURITY DEFINER context — current_user (function owner)
  -- differs from session_user (the authenticated caller) only when
  -- executing inside a SECURITY DEFINER function such as apply_spin_result.
  IF current_user <> session_user THEN
    RETURN NEW;
  END IF;

  -- Authenticated users calling directly may ONLY decrease their balance
  IF NEW.balance > OLD.balance THEN
    RAISE EXCEPTION 'Balance increases must be performed by the server';
  END IF;

  -- Prevent negative balance
  IF NEW.balance < 0 THEN
    NEW.balance := 0;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-create the trigger (function body updated above)
DROP TRIGGER IF EXISTS trg_guard_balance ON public.profiles;
CREATE TRIGGER trg_guard_balance
  BEFORE UPDATE OF balance ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_balance_update();

NOTIFY pgrst, 'reload schema';
