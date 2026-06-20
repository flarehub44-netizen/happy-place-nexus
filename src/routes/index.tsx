import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listAds, getStats } from "@/lib/ads.functions";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge, RiskBadge, StatusBadge } from "@/components/ScoreBadge";
import { AdDetailDialog } from "@/components/AdDetailDialog";
import { Radar, Search, TrendingUp, ShieldAlert, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Offer Radar AI — Inteligência de ofertas low ticket" },
      { name: "description", content: "Plataforma de inteligência que coleta, classifica e analisa ofertas digitais de baixo ticket (R$9,90 a R$97) com sinais de validação." },
      { property: "og:title", content: "Offer Radar AI" },
      { property: "og:description", content: "Sinais de validação, padrão de mercado e possíveis ângulos validados de ofertas low ticket." },
    ],
  }),
  component: Dashboard,
});

const NICHES = ["all","emagrecimento","financas","relacionamento","espiritualidade","saude","beleza","culinaria","pets","educacao","marketing","desenvolvimento_pessoal","outros"];
const STATUSES = ["all","detected","analyzing","validated","attention","risk","archived"];

function Dashboard() {
  const fetchAds = useServerFn(listAds);
  const fetchStats = useServerFn(getStats);

  const [niche, setNiche] = useState("all");
  const [status, setStatus] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"score" | "recent" | "days">("score");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const adsQ = useQuery(
    queryOptions({
      queryKey: ["ads", { niche, status, minScore, search, sort }],
      queryFn: () => fetchAds({ data: { niche, status, minScore, search, sort } }),
    }),
  );
  const statsQ = useQuery(queryOptions({ queryKey: ["stats"], queryFn: () => fetchStats() }));

  const ads = adsQ.data ?? [];
  const topNiche = useMemo(() => {
    const b = statsQ.data?.byNiche ?? {};
    return Object.entries(b).sort((a, c) => c[1] - a[1])[0]?.[0] ?? "—";
  }, [statsQ.data]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-md bg-primary/15 text-primary">
              <Radar className="size-5" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold leading-none">Offer Radar <span className="text-primary">AI</span></h1>
              <p className="text-[11px] text-muted-foreground">Inteligência de ofertas low ticket · R$9,90–R$97</p>
            </div>
          </div>
          <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wide">
            modo análise — dados mockados
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* Stats */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Radar className="size-4" />} label="Ofertas detectadas" value={statsQ.data?.total ?? "—"} />
          <StatCard icon={<Sparkles className="size-4" />} label="Score médio (sinais)" value={statsQ.data?.avgScore ?? "—"} tone="high" />
          <StatCard icon={<TrendingUp className="size-4" />} label="Padrão validado" value={statsQ.data?.validated ?? "—"} tone="high" />
          <StatCard icon={<ShieldAlert className="size-4" />} label="Atenção / Risco" value={statsQ.data?.risk ?? "—"} tone="low" />
        </section>

        <p className="text-xs text-muted-foreground">
          Nicho com mais ofertas detectadas: <span className="font-mono text-foreground/80">{topNiche}</span>
        </p>

        {/* Filters */}
        <section className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card/40 p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="buscar por headline…"
              className="pl-8"
            />
          </div>
          <FilterSelect label="nicho" value={niche} onChange={setNiche} options={NICHES} />
          <FilterSelect label="status" value={status} onChange={setStatus} options={STATUSES} />
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">score mín. {minScore}</label>
            <input
              type="range" min={0} max={100} value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-32 accent-[color:var(--color-signal-high)]"
            />
          </div>
          <FilterSelect label="ordenar" value={sort} onChange={(v) => setSort(v as "score"|"recent"|"days")}
            options={["score","recent","days"]}
            labels={{ score: "maior score", recent: "mais recentes", days: "mais dias rodando" }}
          />
          <Badge variant="outline" className="ml-auto font-mono">
            {adsQ.isLoading ? "…" : `${ads.length} ofertas`}
          </Badge>
        </section>

        {/* Table */}
        <section className="overflow-hidden rounded-lg border border-border bg-card/40">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Score</th>
                  <th className="px-3 py-2 text-left">Oferta detectada</th>
                  <th className="px-3 py-2 text-left">Anunciante</th>
                  <th className="px-3 py-2 text-left">Nicho</th>
                  <th className="px-3 py-2 text-left">Plat.</th>
                  <th className="px-3 py-2 text-right">Preço</th>
                  <th className="px-3 py-2 text-right">Dias</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Risco</th>
                </tr>
              </thead>
              <tbody>
                {ads.map((ad) => (
                  <tr
                    key={ad.id}
                    onClick={() => setSelectedId(ad.id)}
                    className="cursor-pointer border-t border-border/60 transition-colors hover:bg-primary/5"
                  >
                    <td className="px-3 py-2"><ScoreBadge score={ad.signal_score} /></td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground/95">{ad.headline}</div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">{ad.primary_text}</div>
                    </td>
                    <td className="px-3 py-2 text-foreground/80">
                      {/* @ts-expect-error joined */}
                      {ad.advertiser?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-foreground/70 capitalize">{ad.niche}</td>
                    <td className="px-3 py-2 font-mono text-xs uppercase text-foreground/70">{ad.platform}</td>
                    <td className="px-3 py-2 text-right font-mono">R$ {Number(ad.price_brl ?? 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-foreground/70">{ad.days_running}</td>
                    <td className="px-3 py-2"><StatusBadge status={ad.status} /></td>
                    <td className="px-3 py-2"><RiskBadge level={ad.policy_risk_level} /></td>
                  </tr>
                ))}
                {!adsQ.isLoading && ads.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">Nenhuma oferta detectada com esses filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-center text-[11px] text-muted-foreground">
          Os termos exibidos seguem o protocolo de análise: sinais de validação, potencial criativo, padrão de mercado, possível ângulo validado e risco de política. Nenhum dado representa garantia de resultado.
        </p>
      </main>

      <AdDetailDialog adId={selectedId} onOpenChange={(o) => !o && setSelectedId(null)} />
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone?: "high" | "low" }) {
  const toneCls =
    tone === "high" ? "text-[color:var(--color-signal-high)]"
    : tone === "low" ? "text-[color:var(--color-signal-low)]"
    : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card/60 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}<span className="text-[11px] uppercase tracking-wide">{label}</span>
      </div>
      <div className={`mt-1 font-display text-2xl font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, labels }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; labels?: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o} className="capitalize">{labels?.[o] ?? (o === "all" ? "todos" : o)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
