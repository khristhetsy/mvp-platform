export function MetricCard({
  label,
  value,
  detail,
  accent = "charcoal",
}: Readonly<{
  label: string;
  value: string;
  detail: string;
  accent?: "charcoal" | "graphite" | "slate" | "neutral" | "indigo" | "violet" | "blue";
}>) {
  const accentBar = {
    charcoal: "from-zinc-600 via-zinc-500 to-zinc-700",
    graphite: "from-zinc-700 via-zinc-600 to-zinc-800",
    slate: "from-zinc-500 to-zinc-600",
    neutral: "from-neutral-600 to-neutral-700",
    indigo: "from-zinc-600 via-zinc-500 to-zinc-700",
    violet: "from-zinc-700 via-zinc-600 to-zinc-800",
    blue: "from-zinc-500 to-zinc-700",
  }[accent];

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900 to-zinc-950 shadow-sm transition hover:shadow-md">
      <div className={`h-px bg-gradient-to-r ${accentBar}`} />
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">{value}</p>
        <p className="mt-2 text-sm leading-6 text-zinc-400">{detail}</p>
      </div>
    </div>
  );
}
