import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function serverSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

const ListInput = z.object({
  niche: z.string().optional(),
  status: z.string().optional(),
  minScore: z.number().int().min(0).max(100).optional(),
  maxPrice: z.number().optional(),
  search: z.string().optional(),
  sort: z.enum(["score", "recent", "days"]).default("score"),
});

export const listAds = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => ListInput.parse(d ?? {}))
  .handler(async ({ data }) => {
    const sb = serverSupabase();
    let q = sb
      .from("ads")
      .select("*, advertiser:advertisers(name, handle, niche)")
      .limit(200);
    if (data.niche && data.niche !== "all") q = q.eq("niche", data.niche as Database["public"]["Enums"]["niche"]);
    if (data.status && data.status !== "all") q = q.eq("status", data.status as Database["public"]["Enums"]["ad_status"]);
    if (typeof data.minScore === "number") q = q.gte("signal_score", data.minScore);
    if (typeof data.maxPrice === "number") q = q.lte("price_brl", data.maxPrice);
    if (data.search) q = q.ilike("headline", `%${data.search}%`);
    if (data.sort === "score") q = q.order("signal_score", { ascending: false, nullsFirst: false });
    if (data.sort === "recent") q = q.order("first_seen_at", { ascending: false });
    if (data.sort === "days") q = q.order("days_running", { ascending: false });
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getAdDetail = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = serverSupabase();
    const [ad, variations, history] = await Promise.all([
      sb.from("ads").select("*, advertiser:advertisers(*)").eq("id", data.id).maybeSingle(),
      sb.from("ad_variations").select("*").eq("ad_id", data.id).order("created_at"),
      sb.from("ad_signal_history").select("*").eq("ad_id", data.id).order("recorded_at"),
    ]);
    if (ad.error) throw new Error(ad.error.message);
    return { ad: ad.data, variations: variations.data ?? [], history: history.data ?? [] };
  });

export const getStats = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverSupabase();
  const { data: ads } = await sb.from("ads").select("signal_score, status, niche, price_brl, days_running");
  const list = ads ?? [];
  const total = list.length;
  const avgScore = total ? Math.round(list.reduce((s, a) => s + (a.signal_score ?? 0), 0) / total) : 0;
  const validated = list.filter((a) => a.status === "validated").length;
  const risk = list.filter((a) => a.status === "risk" || a.status === "attention").length;
  const byNiche: Record<string, number> = {};
  for (const a of list) byNiche[a.niche] = (byNiche[a.niche] ?? 0) + 1;
  return { total, avgScore, validated, risk, byNiche };
});

const AnalyzeInput = z.object({ id: z.string().uuid() });

export const analyzeAd = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AnalyzeInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");
    const sb = serverSupabase();
    const { data: ad, error } = await sb.from("ads").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!ad) throw new Error("Anúncio não encontrado");

    const system = `Você é um analista de tráfego pago especializado em ofertas digitais de baixo ticket no Brasil (R$9,90 a R$97).
Use linguagem técnica e neutra. NUNCA prometa resultado. NUNCA diga que um anúncio é "vencedor", "garantido" ou "comprovado".
Trabalhe SEMPRE com "sinais de validação" observáveis: tempo ativo, repetição de variações, clareza da oferta, preço low ticket detectado, landing page ativa, consistência do ângulo.
Use os termos: "sinais de validação", "potencial criativo", "oferta detectada", "risco de política", "padrão de mercado", "possível ângulo validado".
Responda APENAS com JSON válido seguindo o schema solicitado.`;

    const prompt = `Analise esta oferta detectada e devolva JSON. O signal_score deve refletir QUANTOS sinais de validação foram observados (não é previsão de vendas):
{
 "signal_score": int 0-100 (soma ponderada dos sinais de validação observados),
 "potential_label": "baixo"|"médio"|"alto" (potencial criativo observado),
 "market_pattern": string curta (padrão de mercado recorrente neste nicho),
 "policy_risk_level": "baixo"|"medio"|"alto" (risco de política de anúncios),
 "policy_risk_notes": string curta,
 "detected_angle": string curta (possível ângulo validado),
 "ai_summary": 1-2 frases neutras descrevendo SINAIS, sem prometer resultado,
 "ai_tags": [3-5 strings de sinais observados, ex: "tempo-ativo-alto", "low-ticket-claro", "lp-ativa"],
 "variations": [3 strings de headlines alternativos baseados no padrão observado]
}

Sinais de validação a considerar:
- tempo ativo: ${ad.days_running} dias (≥7 é sinal forte)
- variações repetidas: ${ad.variations_count} (≥2 indica teste validado)
- preço low ticket: R$${ad.price_brl ?? "?"} (entre R$9,90 e R$97 é o alvo)
- landing page: ${ad.landing_url ? "ativa" : "ausente"}
- clareza da oferta: headline + CTA ${ad.headline && ad.cta ? "presentes" : "incompletos"}

Dados do criativo:
- Nicho: ${ad.niche}
- Plataforma: ${ad.platform}
- Formato: ${ad.format}
- Headline: ${ad.headline ?? ""}
- Texto: ${ad.primary_text ?? ""}
- CTA: ${ad.cta ?? ""}`;


    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (resp.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
    if (resp.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    if (!resp.ok) throw new Error(`AI Gateway falhou: ${resp.status}`);
    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    const policyMap: Record<string, "baixo" | "medio" | "alto"> = { baixo: "baixo", médio: "medio", medio: "medio", alto: "alto" };
    const update = {
      signal_score: Math.max(0, Math.min(100, Number(parsed.signal_score ?? 0))),
      potential_label: String(parsed.potential_label ?? "médio"),
      market_pattern: String(parsed.market_pattern ?? ""),
      policy_risk_level: policyMap[String(parsed.policy_risk_level ?? "baixo").toLowerCase()] ?? "baixo",
      policy_risk_notes: String(parsed.policy_risk_notes ?? ""),
      detected_angle: String(parsed.detected_angle ?? ""),
      ai_summary: String(parsed.ai_summary ?? ""),
      ai_tags: Array.isArray(parsed.ai_tags) ? parsed.ai_tags.map(String) : [],
      ai_analyzed_at: new Date().toISOString(),
    };
    const { error: upErr } = await sb.from("ads").update(update).eq("id", ad.id);
    if (upErr) throw new Error(upErr.message);

    await sb.from("ad_signal_history").insert({ ad_id: ad.id, signal_score: update.signal_score });

    if (Array.isArray(parsed.variations) && parsed.variations.length) {
      await sb.from("ad_variations").insert(
        parsed.variations.slice(0, 5).map((v: unknown) => ({
          ad_id: ad.id,
          variation_text: String(v),
          variation_type: "headline",
          generated_by: "ai",
        })),
      );
    }
    return { ok: true, ...update };
  });
