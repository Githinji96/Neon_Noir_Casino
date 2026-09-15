-- ============================================================
-- Fix: Registered users not visible in admin Users section
-- Safe to re-run. Works whether or not profile_new_fields.sql
-- has been applied (optional columns handled with ADD IF NOT EXISTS).
-- ============================================================

-- ── 0. Ensure optional profile columns exist ─────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name    text,
  ADD COLUMN IF NOT EXISTS last_name     text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS country       text NOT NULL DEFAULT 'Kenya',
  ADD COLUMN IF NOT EXISTS currency      text NOT NULL DEFAULT 'KES',
  ADD COLUMN IF NOT EXISTS phone         text,
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_role    text
    CHECK (admin_role IN ('super_admin','finance_admin','support_agent','game_manager')),
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active','suspended','banned'));

-- ── 1. Harden get_my_admin_role() ────────────────────────────────────────────
--    SECURITY DEFINER runs as DB owner → bypasses RLS → no recursion.
CREATE OR REPLACE FUNCTION public.get_my_admin_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT admin_role
  FROM   public.profiles
  WHERE  id = auth.uid()
  LIMIT  1;
$$;

-- ── 2. Recreate all profiles RLS policies cleanly ────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile"       ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"     ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile"     ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles"     ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles"   ON public.profiles;
DROP POLICY IF EXISTS "Service role full access"         ON public.profiles;
DROP POLICY IF EXISTS "service_role bypass profiles"     ON public.profiles;

-- Service role (Edge Functions / server-side) always has full access
CREATE POLICY "service_role bypass profiles"
  ON public.profiles FOR ALL
  USING     (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Regular users: own row only
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING     (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Admins: read all rows (get_my_admin_role is SECURITY DEFINER → no recursion)
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    public.get_my_admin_role() IN (
      'super_admin','finance_admin','support_agent','game_manager'
    )
  );

-- Admins: update any row
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (
    public.get_my_admin_role() IN ('super_admin','finance_admin')
  )
  WITH CHECK (
    public.get_my_admin_role() IN ('super_admin','finance_admin')
  );

-- ── 3. admin_get_users() RPC — SECURITY DEFINER, admin-gated ─────────────────
--    DROP first because CREATE OR REPLACE cannot change the return type
--    if a previous version exists with a different signature.
DROP FUNCTION IF EXISTS public.admin_get_users(int, int);
DROP FUNCTION IF EXISTS public.admin_get_users();

CREATE FUNCTION public.admin_get_users(
  p_limit  int DEFAULT 500,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id             uuid,
  username       text,
  email          text,
  balance        numeric,
  account_status text,
  admin_role     text,
  phone          text,
  phone_verified boolean,
  first_name     text,
  last_name      text,
  country        text,
  currency       text,
  updated_at     timestamptz,
  registered_at  timestamptz,
  last_sign_in   timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF public.get_my_admin_role() IS NULL THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
    SELECT
      p.id,
      p.username,
      u.email,
      p.balance,
      p.account_status,
      p.admin_role,
      p.phone,
      p.phone_verified,
      p.first_name,
      p.last_name,
      p.country,
      p.currency,
      p.updated_at,
      u.created_at        AS registered_at,
      u.last_sign_in_at   AS last_sign_in
    FROM  public.profiles p
    JOIN  auth.users      u ON u.id = p.id
    ORDER BY p.updated_at DESC NULLS LAST
    LIMIT  p_limit
    OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_users(int, int) TO authenticated;

-- ── 4. Also update the new-user trigger so it captures all fields ─────────────
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
    id, username, balance,
    phone, phone_verified,
    first_name, last_name, date_of_birth,
    country, currency, account_status
  )
  VALUES (
    new.id, _username, 0.00,
    _phone, (_phone <> ''),
    _firstName, _lastName, _dob,
    'Kenya', 'KES', 'active'
  )
  ON CONFLICT (id) DO NOTHING;   -- idempotent: skip if row already exists

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

-- ── 5. Backfill any auth.users rows that have no profiles row yet ─────────────
-- Two-step: compute a collision-free username first, then insert.
DO $$
DECLARE
  r        auth.users%ROWTYPE;
  _name    text;
BEGIN
  FOR r IN
    SELECT u.* FROM auth.users u
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
  LOOP
    -- Preferred name: stored username → email prefix → uuid
    _name := coalesce(
      nullif(trim(r.raw_user_meta_data->>'username'), ''),
      nullif(split_part(r.email, '@', 1), ''),
      r.id::text
    );

    -- If that name is already taken, append the full uuid (guaranteed unique)
    IF EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.username = _name) THEN
      _name := _name || '_' || r.id::text;
    END IF;

    INSERT INTO public.profiles (id, username, balance, account_status, country, currency)
    VALUES (r.id, _name, 0.00, 'active', 'Kenya', 'KES')
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END;
$$;

-- ── 6. Reload PostgREST schema cache ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
