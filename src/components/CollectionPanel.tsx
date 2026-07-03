import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { collectAds, listJobs } from "@/lib/collection.functions";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Radio } from "lucide-react";

const NICHES = ["emagrecimento","financas","relacionamento","espiritualidade","saude","beleza","culinaria","pets","educacao","marketing","desenvolvimento_pessoal","outros"];

export function CollectionPanel() {
  const qc = useQueryClient();
  const collect = useServerFn(collectAds);
  const jobsFn = useServerFn(listJobs);

  const [source, setSource] = useState<"meta" | "tiktok">("meta");
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("BR");
  const [niche, setNiche] = useState("outros");
  const [limit, setLimit] = useState(30);
  const [liveTick, setLiveTick] = useState(0);

  const jobsQ = useQuery(
    queryOptions({
      queryKey: ["collection_jobs"],
      queryFn: () => jobsFn(),
    }),
  );

  // Realtime: escuta jobs + ads pra atualizar feed ao vivo sem polling
  useEffect(() => {
    const ch = supabase
      .channel("live-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collection_jobs" },
        () => {
          qc.invalidateQueries({ queryKey: ["collection_jobs"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ads" },
        () => {
          setLiveTick((t) => t + 1);
          qc.invalidateQueries({ queryKey: ["ads"] });
          qc.invalidateQueries({ queryKey: ["stats"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const mut = useMutation({
    mutationFn: () => collect({ data: { source, query, country, niche: niche as never, limit } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection_jobs"] });
      qc.invalidateQueries({ queryKey: ["ads"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  return (
    <section className="rounded-lg border border-border bg-card/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Radio className="size-4 text-primary" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide">Nova Coleta · Apify</h2>
        <span className="ml-auto flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span className="size-1.5 rounded-full bg-[color:var(--color-signal-high)] animate-pulse" />
          ao vivo{liveTick > 0 ? ` · ${liveTick}` : ""}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">fonte</label>
          <Select value={source} onValueChange={(v) => setSource(v as "meta" | "tiktok")}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="meta">Meta Ads Library</SelectItem>
              <SelectItem value="tiktok">TikTok Ads Library</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">palavra-chave</label>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ex: emagrecer, finanças..." />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">país</label>
          <Input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} className="w-20" maxLength={2} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">nicho</label>
          <Select value={niche} onValueChange={setNiche}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {NICHES.map((n) => <SelectItem key={n} value={n} className="capitalize">{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">limite</label>
          <Input type="number" value={limit} min={1} max={200} onChange={(e) => setLimit(Number(e.target.value))} className="w-20" />
        </div>

        <Button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || query.length < 2}
          className="gap-2"
        >
          {mut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Coletar
        </Button>
      </div>

      {mut.error && (
        <p className="text-xs text-[color:var(--color-signal-low)]">
          {mut.error instanceof Error ? mut.error.message : "Falha na coleta"}
        </p>
      )}
      {mut.data && (
        <p className="text-xs text-[color:var(--color-signal-high)]">
          {mut.data.inserted} anúncios coletados · {mut.data.queued} na fila de enriquecimento.
        </p>
      )}

      {jobsQ.data && jobsQ.data.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {jobsQ.data.slice(0, 6).map((j) => (
            <Badge key={j.id} variant="outline" className="font-mono text-[10px]">
              {j.source}:{j.query} · {j.status}
              {j.status === "done" && ` · ${j.total_collected}`}
            </Badge>
          ))}
        </div>
      )}
    </section>
  );
}
