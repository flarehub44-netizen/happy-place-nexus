import { useState } from "react";
import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Clock, Repeat, Play, History } from "lucide-react";
import {
  listTrackedKeywords, addTrackedKeyword, toggleTrackedKeyword, deleteTrackedKeyword,
  runKeywordNow, listCronRuns,
} from "@/lib/keywords.functions";

const NICHES = ["emagrecimento","financas","relacionamento","espiritualidade","saude","beleza","culinaria","pets","educacao","marketing","desenvolvimento_pessoal","outros"];

export function KeywordsPanel() {
  const list = useServerFn(listTrackedKeywords);
  const add = useServerFn(addTrackedKeyword);
  const toggle = useServerFn(toggleTrackedKeyword);
  const del = useServerFn(deleteTrackedKeyword);
  const runNow = useServerFn(runKeywordNow);
  const runs = useServerFn(listCronRuns);
  const qc = useQueryClient();

  const q = useQuery(queryOptions({ queryKey: ["tracked_keywords"], queryFn: () => list() }));
  const qRuns = useQuery(queryOptions({ queryKey: ["cron_runs"], queryFn: () => runs(), refetchInterval: 30000 }));

  const [term, setTerm] = useState("");
  const [niche, setNiche] = useState("outros");
  const [freq, setFreq] = useState(24);

  const mAdd = useMutation({
    mutationFn: () => add({ data: { term, source: "meta", country: "BR", niche: niche as never, frequency_hours: freq, limit_per_run: 30 } }),
    onSuccess: () => {
      toast.success("Palavra-chave adicionada");
      setTerm("");
      qc.invalidateQueries({ queryKey: ["tracked_keywords"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mToggle = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracked_keywords"] }),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracked_keywords"] }),
  });
  const mRun = useMutation({
    mutationFn: (id: string) => runNow({ data: { id } }),
    onSuccess: (r) => {
      toast.success(`Coleta concluída: +${r.inserted} anúncios`);
      qc.invalidateQueries({ queryKey: ["tracked_keywords"] });
      qc.invalidateQueries({ queryKey: ["cron_runs"] });
      qc.invalidateQueries({ queryKey: ["ads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const rows = q.data ?? [];

  return (
    <section className="rounded-lg border border-border bg-card/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Repeat className="size-4 text-primary" />
        <h2 className="font-display text-sm font-semibold">Coletas recorrentes</h2>
        <Badge variant="outline" className="ml-auto font-mono text-[10px]">{rows.length} termos</Badge>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="ex: ebook receitas naturais, desafio 7 dias…"
          className="min-w-[240px] flex-1"
        />
        <Select value={niche} onValueChange={setNiche}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {NICHES.map((n) => <SelectItem key={n} value={n} className="capitalize">{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(freq)} onValueChange={(v) => setFreq(Number(v))}>
          <SelectTrigger className="h-9 w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="6">a cada 6h</SelectItem>
            <SelectItem value="12">a cada 12h</SelectItem>
            <SelectItem value="24">1x ao dia</SelectItem>
            <SelectItem value="48">2x na semana</SelectItem>
            <SelectItem value="168">1x na semana</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => mAdd.mutate()} disabled={!term || mAdd.isPending}>
          <Plus className="mr-1 size-4" /> Adicionar
        </Button>
      </div>

      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhuma palavra-chave salva. Adicione termos que devem ser coletados automaticamente pelo cron.
        </p>
      )}

      {rows.length > 0 && (
        <ul className="space-y-1">
          {rows.map((k) => (
            <li key={k.id} className="flex items-center gap-2 rounded border bg-background/40 px-2 py-1.5 text-sm">
              <Switch
                checked={k.enabled}
                onCheckedChange={(v) => mToggle.mutate({ id: k.id, enabled: v })}
              />
              <span className="font-medium">{k.term}</span>
              <Badge variant="outline" className="text-[10px] capitalize">{k.niche}</Badge>
              <Badge variant="outline" className="font-mono text-[10px]">{k.source}</Badge>
              <span className="ml-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="size-3" /> {k.frequency_hours}h
              </span>
              {k.last_run_at && (
                <span className="text-[11px] text-muted-foreground">
                  · última: {new Date(k.last_run_at).toLocaleString("pt-BR")} {k.last_inserted != null && `(+${k.last_inserted})`}
                </span>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-7 px-2"
                onClick={() => mRun.mutate(k.id)}
                disabled={mRun.isPending}
                title="Rodar coleta agora"
              >
                <Play className="size-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => mDel.mutate(k.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {(qRuns.data?.length ?? 0) > 0 && (
        <details className="rounded border border-border/60 bg-background/30 p-2 text-xs">
          <summary className="flex cursor-pointer items-center gap-2 text-muted-foreground">
            <History className="size-3.5" /> Últimas execuções ({qRuns.data!.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {qRuns.data!.map((r) => (
              <li key={r.id} className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-muted-foreground">{new Date(r.last_run_at!).toLocaleString("pt-BR")}</span>
                <span className="font-sans">{r.term}</span>
                <Badge variant={r.last_status === "ok" ? "outline" : "destructive"} className="text-[10px]">
                  {r.last_status === "ok" ? `+${r.last_inserted ?? 0}` : r.last_status}
                </Badge>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-[10px] text-muted-foreground/80">
        O cron precisa ser configurado no Supabase (pg_cron) chamando <code className="font-mono">/api/public/cron-collect</code> com header <code className="font-mono">x-cron-secret</code>.
      </p>
    </section>
  );
}
