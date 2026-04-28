-- Add initial_balance column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS initial_balance NUMERIC NOT NULL DEFAULT 0;

-- Allow users to update their own initial_balance (the protect trigger only blocks specific monetization fields, so this passes through)
-- No new policy needed: existing "Users update own profile" policy already covers it.