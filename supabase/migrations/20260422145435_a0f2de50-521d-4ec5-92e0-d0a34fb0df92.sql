-- Update handle_new_user to auto-assign admin role to specific email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  free_plan_id UUID;
  user_role public.app_role;
BEGIN
  SELECT id INTO free_plan_id FROM public.plans WHERE price = 0 ORDER BY sort_order LIMIT 1;
  
  INSERT INTO public.profiles (id, full_name, email, plan_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    free_plan_id
  );
  
  IF NEW.email = 'inglerdantas02@gmail.com' THEN
    user_role := 'admin';
  ELSE
    user_role := 'user';
  END IF;
  
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, user_role);
  
  RETURN NEW;
END;
$function$;

-- Make sure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: assign admin role to existing user with that email if exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'inglerdantas02@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Add expires_at column to profiles for future billing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Allow admins to view all profiles (already partly covered) and update plan/status
-- Existing policies already include has_role checks; ensure admins can also view via list
-- The "Users view own profile" already includes admin check. Good.