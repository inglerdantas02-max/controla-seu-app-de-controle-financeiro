-- Add trial dates
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ;

-- Ensure CONTROLA PRO plan exists
INSERT INTO public.plans (name, price, benefits, is_active, sort_order)
SELECT 'CONTROLA PRO', 19.90,
  '["Acesso completo ao app","Assistente com IA","Relatórios financeiros","Movimentações ilimitadas"]'::jsonb,
  true, 1
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE name = 'CONTROLA PRO');

UPDATE public.plans
SET price = 19.90,
    benefits = '["Acesso completo ao app","Assistente com IA","Relatórios financeiros","Movimentações ilimitadas"]'::jsonb,
    is_active = true,
    sort_order = 1
WHERE name = 'CONTROLA PRO';

-- Move all profiles to PRO plan, then remove other plans
UPDATE public.profiles
SET plan_id = (SELECT id FROM public.plans WHERE name = 'CONTROLA PRO' LIMIT 1);

DELETE FROM public.plans WHERE name <> 'CONTROLA PRO';

-- Updated trigger: trial 7 days for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pro_plan_id UUID;
  user_role public.app_role;
  user_status TEXT;
BEGIN
  SELECT id INTO pro_plan_id FROM public.plans WHERE name = 'CONTROLA PRO' LIMIT 1;

  IF NEW.email = 'inglerdantas02@gmail.com' THEN
    user_role := 'admin';
    user_status := 'active';
  ELSE
    user_role := 'user';
    user_status := 'trial';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, plan_id, status, trial_start_date, trial_end_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    pro_plan_id,
    user_status,
    CASE WHEN user_status = 'trial' THEN now() ELSE NULL END,
    CASE WHEN user_status = 'trial' THEN now() + interval '7 days' ELSE NULL END
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, user_role);
  RETURN NEW;
END;
$function$;

-- Backfill existing users
UPDATE public.profiles
SET trial_start_date = COALESCE(trial_start_date, created_at),
    trial_end_date = COALESCE(trial_end_date, created_at + interval '7 days')
WHERE email <> 'inglerdantas02@gmail.com';

UPDATE public.profiles
SET status = CASE
  WHEN email = 'inglerdantas02@gmail.com' THEN 'active'
  WHEN status = 'active' THEN 'active'
  WHEN trial_end_date < now() THEN 'expired'
  ELSE 'trial'
END;