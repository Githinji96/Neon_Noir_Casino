-- ============================================================
-- Fix: New accounts start with KES 0.00 balance
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Change the column default from 1000 to 0
ALTER TABLE public.profiles
  ALTER COLUMN balance SET DEFAULT 0.00;

-- 2. Update the trigger so new signups start at 0
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _username  text;
  _phone     text;
  _firstName text;
  _lastName  text;
  _dob       date;
BEGIN
  _username  := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1),
    new.id::text
  );
  _phone     := coalesce(new.raw_user_meta_data->>'phone', '');
  _firstName := coalesce(new.raw_user_meta_data->>'first_name', '');
  _lastName  := coalesce(new.raw_user_meta_data->>'last_name', '');

  BEGIN
    _dob := (new.raw_user_meta_data->>'date_of_birth')::date;
  EXCEPTION WHEN others THEN
    _dob := NULL;
  END;

  -- Ensure username uniqueness
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = _username) THEN
    _username := _username || '_' || floor(random() * 9000 + 1000)::text;
  END IF;

  INSERT INTO public.profiles (
    id, username,
    balance,          -- starts at 0
    phone, phone_verified,
    first_name, last_name, date_of_birth,
    country, currency,
    account_status
  )
  VALUES (
    new.id,
    _username,
    0.00,             -- KES 0.00 on registration
    _phone,
    (_phone != ''),
    _firstName,
    _lastName,
    _dob,
    'Kenya',
    'KES',
    'active'
  );

  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'handle_new_user error: %', sqlerrm;
    RETURN new;
END;
$$;

-- Re-attach the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
