import { SparklineChart } from "@/components/ui/charts/SparklineChart";

const DEFAULT_SERIES = [42, 48, 45, 52, 58, 61, 64];

export function DashboardInsightPanel({
  title = "Activity trend",
  subtitle = "Last 7 periods · illustrative",
  series = DEFAULT_SERIES,
}: Readonly<{
  title?: string;
  subtitle?: string;
  series?: number[];
}>) {
  const max = Math.max(...series, 1);

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--navy)]">{title}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <SparklineChart values={series} width={96} height={36} />
      </div>
      <div className="mt-4 flex items-end gap-1.5" style={{ height: 48 }} aria-hidden>
        {series.map((value, i) => (
          <div key={i} className="flex-1 rounded-sm bg-[var(--navy-muted)]" style={{ height: `${Math.max(12, (value / max) * 100)}%` }}>
            <div className="h-full w-full rounded-sm bg-[var(--navy)]/80" />
          </div>
        ))}
      </div>
    </div>
  );
}
