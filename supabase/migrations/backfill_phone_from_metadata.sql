-- ============================================================
-- Backfill phone numbers from auth.users metadata into profiles
-- Run in: Supabase Dashboard → SQL Editor
--
-- Why this is needed:
--   The handle_new_user() trigger ran before the phone column existed,
--   so phone was never written. The data is still in auth.users
--   raw_user_meta_data->>'phone' — this migration copies it across.
-- ============================================================

-- 1. Ensure phone columns exist (safe no-op if already present)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone          text,
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;

-- 2. Backfill: copy phone from auth metadata where profile phone is null/empty
UPDATE public.profiles p
SET
  phone          = trim(u.raw_user_meta_data->>'phone'),
  phone_verified = (trim(u.raw_user_meta_data->>'phone') <> '')
FROM auth.users u
WHERE p.id = u.id
  AND (p.phone IS NULL OR trim(p.phone) = '')
  AND trim(coalesce(u.raw_user_meta_data->>'phone', '')) <> '';

-- Show how many rows were updated (visible in Supabase SQL Editor output)
DO $$
DECLARE
  updated_count integer;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.phone IS NOT NULL AND trim(p.phone) <> '';

  RAISE NOTICE 'Profiles with phone number: %', updated_count;
END;
$$;

-- 3. Harden the trigger so phone is always captured going forward
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
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    split_part(new.email, '@', 1),
    new.id::text
  );
  _phone     := coalesce(nullif(trim(new.raw_user_meta_data->>'phone'), ''), '');
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
    id, username, balance,
    phone, phone_verified,
    first_name, last_name, date_of_birth,
    country, currency, account_status
  )
  VALUES (
    new.id,
    _username,
    0.00,
    _phone,
    (_phone <> ''),
    _firstName,
    _lastName,
    _dob,
    'Kenya',
    'KES',
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    -- If the profile already exists (race condition), merge in any missing fields
    phone          = CASE WHEN excluded.phone <> '' THEN excluded.phone ELSE public.profiles.phone END,
    phone_verified = CASE WHEN excluded.phone <> '' THEN true ELSE public.profiles.phone_verified END,
    first_name     = coalesce(public.profiles.first_name, excluded.first_name),
    last_name      = coalesce(public.profiles.last_name,  excluded.last_name),
    date_of_birth  = coalesce(public.profiles.date_of_birth, excluded.date_of_birth);

  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'handle_new_user error: %', sqlerrm;
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

NOTIFY pgrst, 'reload schema';
