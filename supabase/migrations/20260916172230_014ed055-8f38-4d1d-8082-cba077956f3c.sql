REVOKE ALL ON FUNCTION public.generate_bill_occurrences(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_bill_occurrences(integer) TO authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;