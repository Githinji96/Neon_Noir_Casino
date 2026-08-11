-- ============================================================
-- Add new profile fields from updated registration
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name    text,
  ADD COLUMN IF NOT EXISTS last_name     text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS country       text NOT NULL DEFAULT 'Kenya',
  ADD COLUMN IF NOT EXISTS currency      text NOT NULL DEFAULT 'KES';

-- Update the signup trigger to capture new fields
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
    id, username, balance, phone, phone_verified,
    first_name, last_name, date_of_birth,
    country, currency, account_status
  )
  VALUES (
    new.id,
    _username,
    0.00,          -- start at KES 0 per spec
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

-- Re-create the trigger (drop + create to pick up new function body)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
