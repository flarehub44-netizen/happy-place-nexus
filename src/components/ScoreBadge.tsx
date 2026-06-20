export function ScoreBadge({ score }: { score: number | null | undefined }) {
  const s = score ?? 0;
  const tone =
    s >= 75 ? "bg-[color:var(--color-signal-high)]/15 text-[color:var(--color-signal-high)] border-[color:var(--color-signal-high)]/30"
    : s >= 55 ? "bg-[color:var(--color-signal-mid)]/15 text-[color:var(--color-signal-mid)] border-[color:var(--color-signal-mid)]/30"
    : "bg-[color:var(--color-signal-low)]/15 text-[color:var(--color-signal-low)] border-[color:var(--color-signal-low)]/30";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs font-semibold ${tone}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {s}
    </span>
  );
}

export function RiskBadge({ level }: { level: string | null | undefined }) {
  const l = (level ?? "baixo") as "baixo" | "medio" | "alto";
  const map = {
    baixo: { label: "risco baixo", cls: "bg-[color:var(--color-signal-high)]/10 text-[color:var(--color-signal-high)]" },
    medio: { label: "risco médio", cls: "bg-[color:var(--color-signal-mid)]/10 text-[color:var(--color-signal-mid)]" },
    alto: { label: "risco alto", cls: "bg-[color:var(--color-signal-low)]/10 text-[color:var(--color-signal-low)]" },
  } as const;
  const { label, cls } = map[l] ?? map.baixo;
  return <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}>{label}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    validated: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    attention: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    risk: "bg-red-500/15 text-red-400 border-red-500/30",
    detected: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    analyzing: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
    archived: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  };
  const labels: Record<string, string> = {
    validated: "validado",
    attention: "atenção",
    risk: "risco",
    detected: "detectado",
    analyzing: "analisando",
    archived: "arquivado",
  };
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${map[status] ?? map.detected}`}>
      {labels[status] ?? status}
    </span>
  );
}
