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
      const insertedAds: Array<{ id: string; landing_url: string | null }> = [];
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

        const { data: insertedAd, error: adErr } = await supabaseAdmin
          .from("ads")
          .insert({
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
          })
          .select("id, landing_url")
          .single();
        if (!adErr && insertedAd) {
          inserted += 1;
          insertedAds.push({ id: insertedAd.id, landing_url: insertedAd.landing_url });
        }
      }

      await supabaseAdmin
        .from("collection_jobs")
        .update({ status: "done", total_collected: inserted })
        .eq("id", job.id);

      // Enriquecimento em lote: analyzeAd + scrapeLandingPage (paralelismo limitado)
      const { analyzeAd } = await import("@/lib/ads.functions");
      const batch = insertedAds.slice(0, 30);
      const concurrency = 4;
      for (let i = 0; i < batch.length; i += concurrency) {
        const chunk = batch.slice(i, i + concurrency);
        await Promise.allSettled(
          chunk.map(async (a) => {
            try { await analyzeAd({ data: { id: a.id } }); } catch {}
            if (a.landing_url) {
              try { await scrapeLandingPage({ data: { adId: a.id } }); } catch {}
              try { await scrapeCheckout({ data: { adId: a.id } }); } catch {}
            }
          }),
        );
      }

      return { ok: true, jobId: job.id, inserted, enriched: batch.length };
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

// ============ CHECKOUT MONITORING ============

const ScrapeCheckoutInput = z.object({
  adId: z.string().uuid(),
  checkoutUrl: z.string().url().optional(),
});

function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("hotmart.com")) return "hotmart";
  if (u.includes("kiwify.")) return "kiwify";
  if (u.includes("monetizze.")) return "monetizze";
  if (u.includes("eduzz.") || u.includes("sun.eduzz")) return "eduzz";
  if (u.includes("cakto.")) return "cakto";
  if (u.includes("ticto.")) return "ticto";
  if (u.includes("pay.kirvano")) return "kirvano";
  if (u.includes("braip.")) return "braip";
  return "unknown";
}

function parseBRL(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.replace(/\s/g, "").match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:[.,]\d{2})?)/);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function sha1(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const scrapeCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ScrapeCheckoutInput.parse(d))
  .handler(async ({ data }) => {
    const token = process.env.APIFY_TOKEN;
    if (!token) throw new Error("APIFY_TOKEN não configurado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let checkoutUrl = data.checkoutUrl ?? null;
    if (!checkoutUrl) {
      const { data: ad } = await supabaseAdmin
        .from("ads")
        .select("landing_url")
        .eq("id", data.adId)
        .maybeSingle();
      checkoutUrl = ad?.landing_url ?? null;
    }
    if (!checkoutUrl) throw new Error("Sem URL de checkout para raspar.");

    const platform = detectPlatform(checkoutUrl);

    // Render JS (checkouts são SPA). website-content-crawler com playwright dá HTML completo.
    const items = await runApifyActor(
      ACTORS.lp,
      {
        startUrls: [{ url: checkoutUrl }],
        maxCrawlPages: 1,
        crawlerType: "playwright:firefox",
        saveHtml: true,
        saveMarkdown: true,
      },
      token,
    );
    const first = (items[0] ?? {}) as Record<string, unknown>;
    const html = pickString(first.html) ?? "";
    const text = pickString(first.text, first.markdown) ?? "";
    const blob = `${text}\n${html}`.toLowerCase();

    // Heurísticas
    const prices = Array.from(blob.matchAll(/r\$\s*([\d.,]+)/g))
      .map((m) => parseBRL(m[1]))
      .filter((n): n is number => n !== null && n >= 7 && n <= 50000)
      .sort((a, b) => a - b);
    const price_brl = prices[0] ?? null;
    const price_original = prices.length > 1 ? prices[prices.length - 1] : null;

    const instMatch = blob.match(/(\d{1,2})\s*x\s*(de\s*)?r\$/);
    const installments_max = instMatch ? Number(instMatch[1]) : null;

    const has_upsell = /upsell|oferta única|one[- ]?time offer|aproveite agora.*adicional/.test(blob);
    const bumpRegex = /(order\s*bump|adicione|leve também|turbine|garanta também)/g;
    const order_bumps = Array.from(blob.matchAll(bumpRegex)).slice(0, 5).map((m) => ({ hint: m[0] }));

    const scarcity = {
      timer: /\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(blob) && /restam|acaba|expira|oferta termina/.test(blob),
      stock: /(últimas?\s+\d+\s+vagas?|estoque\s+limitado|restam\s+\d+)/.test(blob),
      social_proof: /(\d+\s+pessoas?\s+(compraram|adquiriram|estão vendo))/.test(blob),
    };

    const payment_methods: string[] = [];
    if (/\bpix\b/.test(blob)) payment_methods.push("pix");
    if (/cart[ãa]o|credit card/.test(blob)) payment_methods.push("cartao");
    if (/boleto/.test(blob)) payment_methods.push("boleto");

    const producer_name =
      pickString(first.title) ??
      (text.match(/produzido por[:\s]+([^\n]{3,80})/i)?.[1]?.trim() ?? null);

    const raw_html_hash = await sha1(html.slice(0, 50000));

    const { error } = await supabaseAdmin.from("checkouts").insert({
      ad_id: data.adId,
      platform,
      checkout_url: checkoutUrl,
      price_brl,
      price_original,
      installments_max,
      order_bumps,
      has_upsell,
      scarcity,
      payment_methods,
      producer_name,
      raw_html_hash,
    });
    if (error) throw new Error(error.message);

    // Boost signal_score com base nos sinais
    let bonus = 0;
    if (order_bumps.length > 0) bonus += 10;
    if (has_upsell) bonus += 15;
    if (scarcity.timer || scarcity.stock) bonus += 5;
    if (bonus > 0) {
      const { data: cur } = await supabaseAdmin
        .from("ads")
        .select("signal_score")
        .eq("id", data.adId)
        .maybeSingle();
      const next = Math.min(100, (cur?.signal_score ?? 0) + bonus);
      await supabaseAdmin.from("ads").update({ signal_score: next }).eq("id", data.adId);
    }

    return { ok: true, platform, price_brl, has_upsell, bumps: order_bumps.length };
  });

export const listCheckouts = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ adId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: rows, error } = await sb
      .from("checkouts")
      .select("*")
      .eq("ad_id", data.adId)
      .order("scraped_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
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
