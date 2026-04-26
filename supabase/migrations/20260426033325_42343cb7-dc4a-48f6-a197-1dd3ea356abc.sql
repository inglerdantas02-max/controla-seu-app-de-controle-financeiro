-- 1. Update has_active_subscription to include past_due (grace period)
CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND (
        status IN ('active', 'past_due')
        OR (status = 'trial' AND trial_end_date IS NOT NULL AND trial_end_date >= now())
      )
  ) OR public.has_role(_user_id, 'admin'::public.app_role)
$$;

-- 2. Update sync trigger to handle past_due → keep access, mark profile
CREATE OR REPLACE FUNCTION public.sync_profile_from_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('active', 'trialing')
     AND (NEW.current_period_end IS NULL OR NEW.current_period_end > now()) THEN
    UPDATE public.profiles
       SET status = 'active',
           expires_at = NEW.current_period_end,
           updated_at = now()
     WHERE id = NEW.user_id;
  ELSIF NEW.status = 'past_due' THEN
    -- keep access, but flag the profile
    UPDATE public.profiles
       SET status = 'past_due',
           updated_at = now()
     WHERE id = NEW.user_id;
  ELSIF NEW.status IN ('canceled', 'unpaid', 'incomplete_expired')
        AND (NEW.current_period_end IS NULL OR NEW.current_period_end < now()) THEN
    UPDATE public.profiles
       SET status = 'expired',
           updated_at = now()
     WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Allow 'past_due' through the protect-profile trigger so the sync trigger above can write it
-- The existing protect_profile_sensitive_fields lets SECURITY DEFINER (auth.uid() IS NULL) writes pass.
-- Sync trigger is SECURITY DEFINER and runs in webhook (service-role) context, so it's already allowed.

-- 4. delete_my_account RPC for LGPD self-deletion
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.transactions WHERE user_id = _uid;
  DELETE FROM public.fixed_expenses WHERE user_id = _uid;
  DELETE FROM public.subscriptions WHERE user_id = _uid;
  DELETE FROM public.user_roles WHERE user_id = _uid;
  DELETE FROM public.profiles WHERE id = _uid;
  DELETE FROM auth.users WHERE id = _uid;
END;
$$;