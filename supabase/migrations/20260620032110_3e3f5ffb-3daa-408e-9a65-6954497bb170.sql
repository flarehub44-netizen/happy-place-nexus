
CREATE TABLE public.collection_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  query text,
  country text DEFAULT 'BR',
  niche text DEFAULT 'outros',
  status text NOT NULL DEFAULT 'pending',
  total_collected integer NOT NULL DEFAULT 0,
  error_message text,
  apify_run_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.collection_jobs TO anon;
GRANT SELECT ON public.collection_jobs TO authenticated;
GRANT ALL ON public.collection_jobs TO service_role;

ALTER TABLE public.collection_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collection_jobs public read" ON public.collection_jobs
  FOR SELECT TO public USING (true);

CREATE TRIGGER set_collection_jobs_updated_at
  BEFORE UPDATE ON public.collection_jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
