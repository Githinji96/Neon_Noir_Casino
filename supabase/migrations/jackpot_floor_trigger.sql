-- ============================================================
-- Jackpot floor enforcement
--
-- Ensures current_amount never goes below base_amount.
-- Fires on INSERT and UPDATE so both initial seeding and
-- admin edits are covered without extra application logic.
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_jackpot_floor()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If current_amount would drop below base_amount, raise it to the floor
  IF NEW.current_amount < NEW.base_amount THEN
    NEW.current_amount := NEW.base_amount;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jackpot_floor ON public.jackpots;
CREATE TRIGGER trg_jackpot_floor
  BEFORE INSERT OR UPDATE ON public.jackpots
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_jackpot_floor();
