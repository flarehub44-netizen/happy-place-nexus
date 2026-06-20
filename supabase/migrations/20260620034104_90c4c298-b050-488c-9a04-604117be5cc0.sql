
CREATE TABLE public.checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL,
  platform text,
  checkout_url text NOT NULL,
  price_brl numeric,
  price_original numeric,
  installments_max integer,
  order_bumps jsonb NOT NULL DEFAULT '[]'::jsonb,
  has_upsell boolean NOT NULL DEFAULT false,
  scarcity jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_methods text[] NOT NULL DEFAULT '{}'::text[],
  producer_name text,
  raw_html_hash text,
  scraped_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX checkouts_ad_id_idx ON public.checkouts(ad_id);
CREATE INDEX checkouts_url_idx ON public.checkouts(checkout_url);

GRANT SELECT ON public.checkouts TO anon, authenticated;
GRANT ALL ON public.checkouts TO service_role;

ALTER TABLE public.checkouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkouts public read" ON public.checkouts
  FOR SELECT USING (true);

CREATE TRIGGER checkouts_set_updated_at
  BEFORE UPDATE ON public.checkouts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
