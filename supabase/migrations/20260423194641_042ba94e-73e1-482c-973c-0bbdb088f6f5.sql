-- 1. Restrict profile self-updates to safe display fields only.
-- Users must NOT be able to flip their own subscription status, plan, trial dates, etc.
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass all checks
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  -- Allow system-level/no-auth contexts (triggers like handle_new_user) to pass through
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Block any change to monetization / identity fields by regular users
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
     OR NEW.trial_start_date IS DISTINCT FROM OLD.trial_start_date
     OR NEW.trial_end_date IS DISTINCT FROM OLD.trial_end_date
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.id IS DISTINCT FROM OLD.id
  THEN
    RAISE EXCEPTION 'Não permitido alterar este campo do perfil';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_sensitive_fields_trg ON public.profiles;
CREATE TRIGGER protect_profile_sensitive_fields_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_sensitive_fields();

-- Recreate the user update policy with explicit WITH CHECK for defense-in-depth.
CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 2. Server-side trial expiry: when reading a profile, mark trial as expired automatically
-- via a SECURITY DEFINER function the client can call (replaces the client-side write).
CREATE OR REPLACE FUNCTION public.expire_trial_if_needed(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only the owner (or admin) can trigger their own check
  IF auth.uid() IS NULL OR (auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RETURN;
  END IF;

  UPDATE public.profiles
     SET status = 'expired'
   WHERE id = _user_id
     AND status = 'trial'
     AND trial_end_date IS NOT NULL
     AND trial_end_date < now();
END;
$$;

-- 3. Prevent privilege escalation: even though the existing policy requires admin to write
-- user_roles, add a hard trigger guard so that no future policy mistake can allow self-promotion.
CREATE OR REPLACE FUNCTION public.prevent_role_self_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow inserts when there's no auth context (e.g. signup trigger handle_new_user)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admins can do anything
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  -- Otherwise block any role-table write
  RAISE EXCEPTION 'Apenas administradores podem alterar papéis de usuários';
END;
$$;

DROP TRIGGER IF EXISTS prevent_role_self_assignment_trg ON public.user_roles;
CREATE TRIGGER prevent_role_self_assignment_trg
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_role_self_assignment();

-- 4. Subscription enforcement at the data layer: block transactions/fixed_expenses
-- writes when a non-admin user's subscription has expired.
CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND (
        status = 'active'
        OR (status = 'trial' AND trial_end_date IS NOT NULL AND trial_end_date >= now())
      )
  ) OR public.has_role(_user_id, 'admin'::public.app_role)
$$;

-- Restrict transaction inserts/updates to active subscribers
DROP POLICY IF EXISTS "Users manage own transactions" ON public.transactions;
CREATE POLICY "Users read own transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Active users insert own transactions"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_active_subscription(auth.uid()));

CREATE POLICY "Active users update own transactions"
ON public.transactions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND public.has_active_subscription(auth.uid()));

CREATE POLICY "Users delete own transactions"
ON public.transactions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Same for fixed_expenses
DROP POLICY IF EXISTS "Users manage own fixed expenses" ON public.fixed_expenses;
CREATE POLICY "Users read own fixed expenses"
ON public.fixed_expenses FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Active users insert own fixed expenses"
ON public.fixed_expenses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_active_subscription(auth.uid()));

CREATE POLICY "Active users update own fixed expenses"
ON public.fixed_expenses FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND public.has_active_subscription(auth.uid()));

CREATE POLICY "Users delete own fixed expenses"
ON public.fixed_expenses FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
