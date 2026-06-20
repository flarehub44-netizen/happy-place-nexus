import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge, RiskBadge, StatusBadge } from "./ScoreBadge";
import { getAdDetail, analyzeAd } from "@/lib/ads.functions";
import { Sparkles, ExternalLink, Loader2 } from "lucide-react";

export function AdDetailDialog({ adId, onOpenChange }: { adId: string | null; onOpenChange: (o: boolean) => void }) {
  const open = !!adId;
  const fetchDetail = useServerFn(getAdDetail);
  const runAnalyze = useServerFn(analyzeAd);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["ad-detail", adId],
    queryFn: () => fetchDetail({ data: { id: adId! } }),
    enabled: open,
  });

  const analyze = useMutation({
    mutationFn: () => runAnalyze({ data: { id: adId! } }),
    onSuccess: () => {
      toast.success("Análise de IA atualizada");
      qc.invalidateQueries({ queryKey: ["ad-detail", adId] });
      qc.invalidateQueries({ queryKey: ["ads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ad = data?.ad;
  const history = (data?.history ?? []).map((h) => ({
    t: new Date(h.recorded_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    score: h.signal_score,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {ad?.headline ?? (isLoading ? "Carregando…" : "Oferta detectada")}
          </DialogTitle>
        </DialogHeader>

        {ad && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <ScoreBadge score={ad.signal_score} />
              <StatusBadge status={ad.status} />
              <RiskBadge level={ad.policy_risk_level} />
              <Badge variant="outline" className="font-mono">{ad.platform}</Badge>
              <Badge variant="outline">{ad.niche}</Badge>
              <Badge variant="outline" className="font-mono">R$ {Number(ad.price_brl ?? 0).toFixed(2)}</Badge>
              <span className="ml-auto text-xs text-muted-foreground">
                {ad.days_running}d ativo · {ad.variations_count} variações
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
              <div className="space-y-2">
                <div className="aspect-video overflow-hidden rounded-lg border bg-muted">
                  {ad.thumbnail_url && (
                    <img src={ad.thumbnail_url} alt="" className="size-full object-cover" />
                  )}
                </div>
                {ad.landing_url && (
                  <a href={ad.landing_url} target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="size-3" /> ver página da oferta
                  </a>
                )}
              </div>

              <div className="space-y-3 text-sm">
                <p className="leading-relaxed text-foreground/90">{ad.primary_text}</p>

                <SignalsChecklist ad={ad} />

                <div className="rounded-md border bg-background/40 p-3 space-y-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Leitura da IA (sinais, não garantia)</p>
                  <p className="text-foreground/90">{ad.ai_summary || "Ainda não analisado pela IA."}</p>
                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <Info label="potencial criativo" value={ad.potential_label} />
                    <Info label="padrão de mercado" value={ad.market_pattern} />
                    <Info label="possível ângulo validado" value={ad.detected_angle} />
                    <Info label="risco de política" value={ad.policy_risk_notes} />
                  </div>
                  {ad.ai_tags?.length ? (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {ad.ai_tags.map((t) => (
                        <span key={t} className="rounded bg-muted px-2 py-0.5 font-mono text-[10px]">{t}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-md border bg-background/40 p-3">
              <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                Sinais ao longo do tempo
              </p>
              <div className="h-32">
                <ResponsiveContainer>
                  <LineChart data={history}>
                    <XAxis dataKey="t" stroke="var(--muted-foreground)" fontSize={10} />
                    <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={10} width={28} />
                    <Tooltip
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="score" stroke="var(--signal-high)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {data?.variations.length ? (
              <div className="rounded-md border bg-background/40 p-3">
                <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Variações criativas geradas
                </p>
                <ul className="space-y-1 text-sm">
                  {data.variations.map((v) => (
                    <li key={v.id} className="rounded bg-muted/50 px-2 py-1 font-mono text-xs">{v.variation_text}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <Button onClick={() => analyze.mutate()} disabled={analyze.isPending}>
                {analyze.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
                {ad.ai_analyzed_at ? "Re-analisar com IA" : "Analisar com IA"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-foreground/85">{value}</p>
    </div>
  );
}
