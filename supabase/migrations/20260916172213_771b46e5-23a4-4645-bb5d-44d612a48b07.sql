CREATE TABLE public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  category text,
  due_day integer NOT NULL DEFAULT 1,
  periodicity text NOT NULL DEFAULT 'monthly',
  is_active boolean NOT NULL DEFAULT true,
  start_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bills_due_day_chk CHECK (due_day BETWEEN 1 AND 31),
  CONSTRAINT bills_periodicity_chk CHECK (periodicity IN ('monthly','bimonthly','quarterly','semiannual','annual'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills TO authenticated;
GRANT ALL ON public.bills TO service_role;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own bills" ON public.bills FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own bills" ON public.bills FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own bills" ON public.bills FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own bills" ON public.bills FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.bill_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_id uuid REFERENCES public.bills(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  category text,
  due_date date NOT NULL,
  period_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bill_occurrences_status_chk CHECK (status IN ('pending','paid'))
);

CREATE UNIQUE INDEX bill_occurrences_unique_period ON public.bill_occurrences (bill_id, period_key) WHERE bill_id IS NOT NULL;
CREATE INDEX bill_occurrences_user_due ON public.bill_occurrences (user_id, due_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_occurrences TO authenticated;
GRANT ALL ON public.bill_occurrences TO service_role;
ALTER TABLE public.bill_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own bill occurrences" ON public.bill_occurrences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own bill occurrences" ON public.bill_occurrences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own bill occurrences" ON public.bill_occurrences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own bill occurrences" ON public.bill_occurrences FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON public.bills
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_bill_occurrences_updated_at BEFORE UPDATE ON public.bill_occurrences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.generate_bill_occurrences(_months_ahead integer DEFAULT 3)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  b record;
  i integer;
  step integer;
  m date;
  start_month date;
  diff integer;
  dd integer;
  due date;
  today_br date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF _uid IS NULL THEN
    RETURN;
  END IF;

  FOR b IN SELECT * FROM public.bills WHERE user_id = _uid AND is_active LOOP
    step := CASE b.periodicity
      WHEN 'monthly' THEN 1
      WHEN 'bimonthly' THEN 2
      WHEN 'quarterly' THEN 3
      WHEN 'semiannual' THEN 6
      WHEN 'annual' THEN 12
      ELSE 1 END;

    start_month := date_trunc('month', b.start_date)::date;

    FOR i IN -1.._months_ahead LOOP
      m := (date_trunc('month', today_br) + (i || ' month')::interval)::date;
      CONTINUE WHEN m < start_month;

      diff := (EXTRACT(YEAR FROM m)::int * 12 + EXTRACT(MONTH FROM m)::int)
            - (EXTRACT(YEAR FROM start_month)::int * 12 + EXTRACT(MONTH FROM start_month)::int);
      CONTINUE WHEN diff % step <> 0;

      dd := LEAST(b.due_day, EXTRACT(DAY FROM (m + interval '1 month - 1 day'))::int);
      due := make_date(EXTRACT(YEAR FROM m)::int, EXTRACT(MONTH FROM m)::int, dd);

      INSERT INTO public.bill_occurrences (user_id, bill_id, name, amount, category, due_date, period_key)
      VALUES (_uid, b.id, b.name, b.amount, b.category, due, to_char(m, 'YYYY-MM'))
      ON CONFLICT (bill_id, period_key) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

INSERT INTO public.bills (user_id, name, amount, category, due_day, periodicity, is_active)
SELECT fe.user_id, fe.name, fe.amount, fe.category, LEAST(GREATEST(fe.day_of_month, 1), 31), 'monthly', true
FROM public.fixed_expenses fe;