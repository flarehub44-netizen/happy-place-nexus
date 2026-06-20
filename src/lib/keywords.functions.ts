import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const NICHES = [
  "emagrecimento","financas","relacionamento","espiritualidade","saude",
  "beleza","culinaria","pets","educacao","marketing","desenvolvimento_pessoal","outros",
] as const;

export const listTrackedKeywords = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await sb
    .from("tracked_keywords")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

const AddInput = z.object({
  term: z.string().min(2).max(100),
  source: z.enum(["meta", "tiktok"]).default("meta"),
  country: z.string().length(2).default("BR"),
  niche: z.enum(NICHES).default("outros"),
  frequency_hours: z.number().int().min(1).max(168).default(24),
  limit_per_run: z.number().int().min(5).max(100).default(30),
});

export const addTrackedKeyword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AddInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("tracked_keywords")
      .upsert(data, { onConflict: "term,source,country" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const toggleTrackedKeyword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("tracked_keywords")
      .update({ enabled: data.enabled })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTrackedKeyword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("tracked_keywords").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runKeywordNow = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { collectAds } = await import("@/lib/collection.functions");
    const { data: k, error } = await supabaseAdmin
      .from("tracked_keywords").select("*").eq("id", data.id).single();
    if (error || !k) throw new Error(error?.message ?? "Keyword não encontrada");
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
      await supabaseAdmin.from("tracked_keywords")
        .update({ last_run_at: new Date().toISOString(), last_status: "ok", last_inserted: r.inserted })
        .eq("id", k.id);
      return { ok: true, inserted: r.inserted };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin.from("tracked_keywords")
        .update({ last_run_at: new Date().toISOString(), last_status: `error: ${msg.slice(0, 200)}` })
        .eq("id", k.id);
      throw new Error(msg);
    }
  });

export const listCronRuns = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await sb
    .from("tracked_keywords")
    .select("id, term, source, last_run_at, last_status, last_inserted, frequency_hours, enabled")
    .not("last_run_at", "is", null)
    .order("last_run_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
});

