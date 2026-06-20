import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const NICHES = [
  "emagrecimento","financas","relacionamento","espiritualidade","saude",
  "beleza","culinaria","pets","educacao","marketing","desenvolvimento_pessoal","outros",
] as const;

type Niche = (typeof NICHES)[number];

const CollectInput = z.object({
  source: z.enum(["meta", "tiktok"]),
  query: z.string().min(2).max(100),
  country: z.string().length(2).default("BR"),
  niche: z.enum(NICHES).default("outros"),
  limit: z.number().int().min(1).max(200).default(50),
});

const APIFY_BASE = "https://api.apify.com/v2";

// Actor IDs (slug form, "user~actor-name")
const ACTORS = {
  meta: "curious_coder~facebook-ads-library-scraper",
  tiktok: "apify~tiktok-ads-scraper",
  lp: "apify~website-content-crawler",
};

async function runApifyActor(actorId: string, input: unknown, token: string) {
  const resp = await fetch(
    `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=120`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Apify ${actorId} falhou: ${resp.status} ${text.slice(0, 200)}`);
  }
  return (await resp.json()) as unknown[];
}

function pickString(...vals: unknown[]): string | null {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

export const collectAds = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CollectInput.parse(d))
  .handler(async ({ data }) => {
    const token = process.env.APIFY_TOKEN;
    if (!token) throw new Error("APIFY_TOKEN não configurado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create job
    const { data: job, error: jobErr } = await supabaseAdmin
      .from("collection_jobs")
      .insert({
        source: data.source,
        query: data.query,
        country: data.country,
        niche: data.niche,
        status: "running",
      })
      .select()
      .single();
    if (jobErr || !job) throw new Error(jobErr?.message ?? "Falha ao criar job");

    try {
      const actorInput =
        data.source === "meta"
          ? {
              urls: [
                {
                  url: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${data.country}&q=${encodeURIComponent(data.query)}&search_type=keyword_unordered`,
                },
              ],
              count: data.limit,
              "scrapeAdDetails": true,
            }
          : {
              keywords: [data.query],
              region: data.country,
              maxItems: data.limit,
            };

      const items = await runApifyActor(ACTORS[data.source], actorInput, token);

      let inserted = 0;
      for (const raw of items.slice(0, data.limit)) {
        const r = raw as Record<string, unknown>;
        const advertiserName =
          pickString(r.page_name, r.pageName, r.advertiserName, r.brand) ?? "Desconhecido";
        const handle = pickString(r.page_id, r.pageId, r.advertiserId);

        // Upsert advertiser
        const { data: adv } = await supabaseAdmin
          .from("advertisers")
          .upsert(
            { name: advertiserName, handle, niche: data.niche as Niche },
            { onConflict: "handle", ignoreDuplicates: false },
          )
          .select()
          .single();

        // Raw import
        const externalId = pickString(r.ad_archive_id, r.adArchiveId, r.id, r.adId);
        const { data: rawImport } = await supabaseAdmin
          .from("raw_ad_imports")
          .insert({
            source: `apify:${data.source}`,
            platform: data.source,
            external_id: externalId,
            payload: JSON.parse(JSON.stringify(raw)),
          })
          .select()
          .single();

        const headline = pickString(r.headline, r.title, r.ad_title) ?? data.query;
        const primaryText = pickString(r.body, r.ad_text, r.text, r.caption);
        const cta = pickString(r.cta_text, r.ctaText, r.call_to_action);
        const landingUrl = pickString(r.link_url, r.linkUrl, r.landingUrl, r.url);
        const mediaUrl = pickString(r.video_url, r.videoUrl, r.image_url, r.imageUrl);
        const thumb = pickString(r.thumbnail, r.thumbnailUrl, r.image);

        const { error: adErr } = await supabaseAdmin.from("ads").insert({
          advertiser_id: adv?.id ?? null,
          raw_import_id: rawImport?.id ?? null,
          platform: data.source,
          format: mediaUrl?.includes(".mp4") ? "video" : "image",
          niche: data.niche as Niche,
          status: "detected",
          headline,
          primary_text: primaryText,
          cta,
          landing_url: landingUrl,
          media_url: mediaUrl,
          thumbnail_url: thumb,
        });
        if (!adErr) inserted += 1;
      }

      await supabaseAdmin
        .from("collection_jobs")
        .update({ status: "done", total_collected: inserted })
        .eq("id", job.id);

      return { ok: true, jobId: job.id, inserted };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("collection_jobs")
        .update({ status: "error", error_message: msg })
        .eq("id", job.id);
      throw e;
    }
  });

const ScrapeLPInput = z.object({ adId: z.string().uuid() });

export const scrapeLandingPage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ScrapeLPInput.parse(d))
  .handler(async ({ data }) => {
    const token = process.env.APIFY_TOKEN;
    if (!token) throw new Error("APIFY_TOKEN não configurado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ad } = await supabaseAdmin
      .from("ads")
      .select("id, landing_url, ai_summary")
      .eq("id", data.adId)
      .maybeSingle();
    if (!ad?.landing_url) throw new Error("Anúncio sem landing_url");

    const items = await runApifyActor(
      ACTORS.lp,
      { startUrls: [{ url: ad.landing_url }], maxCrawlPages: 1, crawlerType: "cheerio" },
      token,
    );
    const first = (items[0] ?? {}) as Record<string, unknown>;
    const markdown = pickString(first.markdown, first.text, first.html) ?? "";
    const summary = markdown.slice(0, 4000);

    await supabaseAdmin
      .from("ads")
      .update({ ai_summary: summary })
      .eq("id", ad.id);

    return { ok: true, length: summary.length };
  });

export const listJobs = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await sb
    .from("collection_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
});
