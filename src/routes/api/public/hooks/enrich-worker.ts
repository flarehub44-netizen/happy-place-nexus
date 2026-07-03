import { createFileRoute } from "@tanstack/react-router";

// Worker de enriquecimento assíncrono. Pega N ads com enrichment_status='pending'
// (ou 'error' com attempts < 3), roda analyzeAd + scrapeLandingPage + scrapeCheckout,
// marca 'done' ou 'error'. Chamado por pg_cron.
export const Route = createFileRoute("/api/public/hooks/enrich-worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { analyzeAd } = await import("@/lib/ads.functions");
        const { scrapeLandingPage, scrapeCheckout } = await import("@/lib/collection.functions");

        // Reset rows presas em 'running' há mais de 5min
        await supabaseAdmin
          .from("ads")
          .update({ enrichment_status: "pending" })
          .eq("enrichment_status", "running")
          .lt("enrichment_updated_at", new Date(Date.now() - 5 * 60_000).toISOString());

        const BATCH = 8;
        const { data: pending, error } = await supabaseAdmin
          .from("ads")
          .select("id, landing_url, enrichment_attempts")
          .in("enrichment_status", ["pending", "error"])
          .lt("enrichment_attempts", 3)
          .order("enrichment_updated_at", { ascending: true, nullsFirst: true })
          .limit(BATCH);
        if (error) return new Response(error.message, { status: 500 });
        if (!pending || pending.length === 0) {
          return Response.json({ ok: true, processed: 0 });
        }

        const ids = pending.map((a) => a.id);
        await supabaseAdmin
          .from("ads")
          .update({ enrichment_status: "running", enrichment_updated_at: new Date().toISOString() })
          .in("id", ids);

        const results = await Promise.allSettled(
          pending.map(async (a) => {
            try { await analyzeAd({ data: { id: a.id } }); } catch {}
            if (a.landing_url) {
              try { await scrapeLandingPage({ data: { adId: a.id } }); } catch {}
              try { await scrapeCheckout({ data: { adId: a.id } }); } catch {}
            }
            return a.id;
          }),
        );

        const okIds: string[] = [];
        const errIds: { id: string; err: string; attempts: number }[] = [];
        results.forEach((r, i) => {
          const src = pending[i];
          if (r.status === "fulfilled") {
            okIds.push(src.id);
          } else {
            errIds.push({
              id: src.id,
              err: r.reason instanceof Error ? r.reason.message : String(r.reason),
              attempts: (src.enrichment_attempts ?? 0) + 1,
            });
          }
        });

        if (okIds.length) {
          await supabaseAdmin
            .from("ads")
            .update({ enrichment_status: "done", enrichment_updated_at: new Date().toISOString(), enrichment_error: null })
            .in("id", okIds);
        }
        for (const e of errIds) {
          await supabaseAdmin
            .from("ads")
            .update({
              enrichment_status: "error",
              enrichment_error: e.err.slice(0, 500),
              enrichment_attempts: e.attempts,
              enrichment_updated_at: new Date().toISOString(),
            })
            .eq("id", e.id);
        }

        return Response.json({ ok: true, processed: pending.length, done: okIds.length, errored: errIds.length });
      },
    },
  },
});
