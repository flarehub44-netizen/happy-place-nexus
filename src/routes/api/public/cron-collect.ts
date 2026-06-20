import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron-collect")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("x-cron-secret");
        if (!auth || auth !== process.env.CRON_SECRET) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { collectAds } = await import("@/lib/collection.functions");

        // Buscar palavras due
        const { data: keywords, error } = await supabaseAdmin
          .from("tracked_keywords")
          .select("*")
          .eq("enabled", true);
        if (error) return new Response(error.message, { status: 500 });

        const now = Date.now();
        const due = (keywords ?? []).filter((k) => {
          if (!k.last_run_at) return true;
          const next = new Date(k.last_run_at).getTime() + k.frequency_hours * 3600_000;
          return now >= next;
        });

        const results: Array<{ id: string; term: string; inserted?: number; error?: string }> = [];
        // Limite 5 por execução pra não estourar timeout
        for (const k of due.slice(0, 5)) {
          try {
            const r = await collectAds({
              data: {
                source: k.source as "meta" | "tiktok",
                query: k.term,
                country: k.country,
                niche: k.niche as never,
                limit: k.limit_per_run,
              },
            });
            await supabaseAdmin
              .from("tracked_keywords")
              .update({ last_run_at: new Date().toISOString(), last_status: "ok", last_inserted: r.inserted })
              .eq("id", k.id);
            results.push({ id: k.id, term: k.term, inserted: r.inserted });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            await supabaseAdmin
              .from("tracked_keywords")
              .update({ last_run_at: new Date().toISOString(), last_status: `error: ${msg.slice(0, 200)}` })
              .eq("id", k.id);
            results.push({ id: k.id, term: k.term, error: msg });
          }
        }

        return Response.json({ ran: results.length, total_due: due.length, results });
      },
    },
  },
});
