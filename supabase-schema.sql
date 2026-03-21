-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Safe to re-run — uses IF NOT EXISTS and OR REPLACE

-- ============================================================
-- PROFILES TABLE
-- ============================================================
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  balance numeric(12, 2) not null default 1000.00,
  country text,
  currency text default 'KES',
  updated_at timestamptz default now()
);

-- ============================================================
-- LEADERBOARD TABLE
-- ============================================================
create table if not exists leaderboard (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  username text not null,
  win_amount numeric(12, 2) not null,
  game_title text not null default 'Cyber Strike 777',
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table leaderboard enable row level security;

-- Drop existing policies before recreating (safe re-run)
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Users can insert own profile" on profiles;
drop policy if exists "Anyone can view leaderboard" on leaderboard;
drop policy if exists "Authenticated users can insert wins" on leaderboard;

create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Anyone can view leaderboard"
  on leaderboard for select using (true);

create policy "Authenticated users can insert wins"
  on leaderboard for insert with check (auth.uid() = user_id);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP TRIGGER
-- ============================================================
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _username text;
begin
  -- Use provided username, fall back to email prefix, then user id
  _username := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1),
    new.id::text
  );

  -- Ensure username is unique by appending random suffix if needed
  if exists (select 1 from public.profiles where username = _username) then
    _username := _username || '_' || floor(random() * 9000 + 1000)::text;
  end if;

  insert into public.profiles (id, username, balance)
  values (new.id, _username, 1000.00);

  return new;
exception
  when others then
    -- Log error but don't block signup
    raise warning 'handle_new_user error: %', sqlerrm;
    return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- M-PESA TRANSACTIONS
-- ============================================================
create table if not exists public.transactions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references public.profiles(id) on delete cascade,
  phone                text not null,
  amount               numeric(12, 2) not null,
  status               text not null default 'pending', -- pending | success | failed
  mpesa_receipt        text,
  checkout_request_id  text unique,
  created_at           timestamptz default now()
);

alter table public.transactions enable row level security;

-- Users can only read their own transactions
create policy "Users read own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

-- Only service role can insert/update (done via Edge Function)
create policy "Service role manages transactions"
  on public.transactions for all
  using (auth.role() = 'service_role');
