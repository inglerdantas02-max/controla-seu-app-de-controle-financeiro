-- Subscriptions table populated by Stripe webhooks
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- Update profile status when subscription becomes active/expires
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

CREATE TRIGGER subscription_sync_profile
AFTER INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_from_subscription();

-- Allow the sync trigger (SECURITY DEFINER, no auth.uid()) to update protected fields.
-- The existing protect_profile_sensitive_fields function already returns NEW when auth.uid() IS NULL.