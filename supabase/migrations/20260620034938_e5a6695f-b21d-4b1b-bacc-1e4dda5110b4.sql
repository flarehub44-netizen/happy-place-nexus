
CREATE TABLE public.tracked_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL,
  source text NOT NULL DEFAULT 'meta',
  country text NOT NULL DEFAULT 'BR',
  niche text NOT NULL DEFAULT 'outros',
  frequency_hours integer NOT NULL DEFAULT 24,
  limit_per_run integer NOT NULL DEFAULT 30,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_status text,
  last_inserted integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (term, source, country)
);

GRANT SELECT ON public.tracked_keywords TO anon, authenticated;
GRANT ALL ON public.tracked_keywords TO service_role;

ALTER TABLE public.tracked_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tracked_keywords public read" ON public.tracked_keywords
  FOR SELECT USING (true);

CREATE TRIGGER tracked_keywords_set_updated_at
  BEFORE UPDATE ON public.tracked_keywords
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
