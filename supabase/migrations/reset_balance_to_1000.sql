-- Migration: Reset current user's balance to KES 1,000
-- Run this in Supabase SQL Editor while logged in, or adjust the WHERE clause as needed

update public.profiles
set balance = 1000.00
where id = auth.uid();
