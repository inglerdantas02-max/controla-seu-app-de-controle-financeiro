CREATE OR REPLACE FUNCTION public.generate_bill_occurrences(_months_ahead integer DEFAULT 3)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
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

    FOR i IN -1..LEAST(GREATEST(_months_ahead, 0), 24) LOOP
      m := (date_trunc('month', today_br) + (i || ' month')::interval)::date;
      CONTINUE WHEN m < start_month;
      diff := (EXTRACT(YEAR FROM m)::int * 12 + EXTRACT(MONTH FROM m)::int)
            - (EXTRACT(YEAR FROM start_month)::int * 12 + EXTRACT(MONTH FROM start_month)::int);
      CONTINUE WHEN diff % step <> 0;
      dd := LEAST(b.due_day, EXTRACT(DAY FROM (m + interval '1 month - 1 day'))::int);
      due := make_date(EXTRACT(YEAR FROM m)::int, EXTRACT(MONTH FROM m)::int, dd);

      INSERT INTO public.bill_occurrences (user_id, bill_id, name, amount, category, due_date, period_key)
      SELECT _uid, b.id, b.name, b.amount, b.category, due, to_char(m, 'YYYY-MM')
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.bill_occurrences existing
        WHERE existing.bill_id = b.id
          AND existing.period_key = to_char(m, 'YYYY-MM')
      );
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_bill_occurrences(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_bill_occurrences(integer) TO authenticated;