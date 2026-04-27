-- 1. Update handle_new_user to use new admin email
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

  IF NEW.email = 'controla.app.oficial@gmail.com' THEN
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

-- 2. Promote existing controla.app.oficial@gmail.com user (if exists) to admin
DO $$
DECLARE
  _new_admin_id uuid;
  _old_admin_id uuid;
BEGIN
  SELECT id INTO _new_admin_id FROM auth.users WHERE email = 'controla.app.oficial@gmail.com' LIMIT 1;
  SELECT id INTO _old_admin_id FROM auth.users WHERE email = 'inglerdantas02@gmail.com' LIMIT 1;

  IF _new_admin_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_new_admin_id, 'admin')
    ON CONFLICT DO NOTHING;

    UPDATE public.profiles SET status = 'active' WHERE id = _new_admin_id;
  END IF;

  IF _old_admin_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = _old_admin_id AND role = 'admin';
  END IF;
END $$;