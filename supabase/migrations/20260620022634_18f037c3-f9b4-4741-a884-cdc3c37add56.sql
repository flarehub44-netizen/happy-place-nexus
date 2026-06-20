
-- Enums
CREATE TYPE public.ad_status AS ENUM ('detected','analyzing','validated','attention','risk','archived');
CREATE TYPE public.ad_platform AS ENUM ('meta','tiktok','youtube','kwai','other');
CREATE TYPE public.ad_format AS ENUM ('image','video','carousel','text');
CREATE TYPE public.niche AS ENUM ('emagrecimento','financas','relacionamento','espiritualidade','saude','beleza','culinaria','pets','educacao','marketing','desenvolvimento_pessoal','outros');

-- Raw imports (mocked ingestion source of truth)
CREATE TABLE public.raw_ad_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'mock',
  external_id text,
  platform ad_platform NOT NULL DEFAULT 'meta',
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.raw_ad_imports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.raw_ad_imports TO authenticated;
GRANT ALL ON public.raw_ad_imports TO service_role;
ALTER TABLE public.raw_ad_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raw_ad_imports public read" ON public.raw_ad_imports FOR SELECT USING (true);

-- Advertisers
CREATE TABLE public.advertisers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  handle text UNIQUE,
  page_url text,
  avatar_url text,
  niche niche NOT NULL DEFAULT 'outros',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.advertisers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advertisers TO authenticated;
GRANT ALL ON public.advertisers TO service_role;
ALTER TABLE public.advertisers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "advertisers public read" ON public.advertisers FOR SELECT USING (true);

-- Ads (oferta detectada)
CREATE TABLE public.ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid REFERENCES public.advertisers(id) ON DELETE SET NULL,
  raw_import_id uuid REFERENCES public.raw_ad_imports(id) ON DELETE SET NULL,
  platform ad_platform NOT NULL DEFAULT 'meta',
  format ad_format NOT NULL DEFAULT 'video',
  niche niche NOT NULL DEFAULT 'outros',
  status ad_status NOT NULL DEFAULT 'detected',
  headline text,
  primary_text text,
  cta text,
  landing_url text,
  media_url text,
  thumbnail_url text,
  price_brl numeric(10,2),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  days_running int NOT NULL DEFAULT 1,
  variations_count int NOT NULL DEFAULT 1,
  ad_library_url text,
  -- AI fields
  signal_score int CHECK (signal_score BETWEEN 0 AND 100),
  potential_label text, -- "potencial criativo"
  market_pattern text,  -- "padrão de mercado"
  policy_risk_level text CHECK (policy_risk_level IN ('baixo','medio','alto')),
  policy_risk_notes text,
  detected_angle text,  -- "possível ângulo validado"
  ai_summary text,
  ai_tags text[] DEFAULT '{}',
  ai_analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ads_signal_score_idx ON public.ads (signal_score DESC NULLS LAST);
CREATE INDEX ads_niche_idx ON public.ads (niche);
CREATE INDEX ads_status_idx ON public.ads (status);
CREATE INDEX ads_first_seen_idx ON public.ads (first_seen_at DESC);
GRANT SELECT ON public.ads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads TO authenticated;
GRANT ALL ON public.ads TO service_role;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ads public read" ON public.ads FOR SELECT USING (true);

-- Ad creative variations
CREATE TABLE public.ad_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  variation_text text NOT NULL,
  variation_type text NOT NULL DEFAULT 'headline',
  generated_by text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ad_variations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_variations TO authenticated;
GRANT ALL ON public.ad_variations TO service_role;
ALTER TABLE public.ad_variations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad_variations public read" ON public.ad_variations FOR SELECT USING (true);

-- Signal history (timeline of score over time)
CREATE TABLE public.ad_signal_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  signal_score int NOT NULL CHECK (signal_score BETWEEN 0 AND 100),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ad_signal_history_ad_idx ON public.ad_signal_history (ad_id, recorded_at DESC);
GRANT SELECT ON public.ad_signal_history TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_signal_history TO authenticated;
GRANT ALL ON public.ad_signal_history TO service_role;
ALTER TABLE public.ad_signal_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad_signal_history public read" ON public.ad_signal_history FOR SELECT USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER ads_set_updated_at BEFORE UPDATE ON public.ads
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
