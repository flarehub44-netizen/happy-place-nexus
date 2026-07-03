
ALTER TABLE public.ads
  ADD COLUMN IF NOT EXISTS enrichment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS enrichment_error text,
  ADD COLUMN IF NOT EXISTS enrichment_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrichment_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS ads_enrichment_status_idx
  ON public.ads (enrichment_status, enrichment_updated_at NULLS FIRST)
  WHERE enrichment_status IN ('pending','error');

ALTER PUBLICATION supabase_realtime ADD TABLE public.ads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.collection_jobs;
ALTER TABLE public.ads REPLICA IDENTITY FULL;
ALTER TABLE public.collection_jobs REPLICA IDENTITY FULL;
