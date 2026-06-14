const DEFAULT_SERIES = [42, 48, 45, 52, 58, 61, 64];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function DashboardInsightPanel({
  title = "Engagement trend",
  subtitle = "Workspace activity — last 7 days",
  series = DEFAULT_SERIES,
  profileViews,
  docOpens,
  introRequests,
}: Readonly<{
  title?: string;
  subtitle?: string;
  series?: number[];
  profileViews?: number;
  docOpens?: number;
  introRequests?: number;
}>) {
  const max = Math.max(...series, 1);
  const total = series.reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          {total} total
        </span>
      </div>

      {/* Stat boxes */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100 text-center">
          <p className="font-mono text-xl font-semibold text-slate-950">{profileViews ?? series.at(-1) ?? 0}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Profile views</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100 text-center">
          <p className="font-mono text-xl font-semibold text-slate-950">{docOpens ?? Math.round((series.at(-1) ?? 0) * 0.4)}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Doc opens</p>
        </div>
        <div className="rounded-lg px-3 py-2.5 ring-1 ring-[#EEEDFE] text-center" style={{ background: "#EEEDFE" }}>
          <p className="font-mono text-xl font-semibold" style={{ color: "#3C3489" }}>{introRequests ?? 0}</p>
          <p className="mt-0.5 text-[11px]" style={{ color: "#534AB7" }}>Intro requests</p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-1.5" style={{ height: 48 }} aria-hidden>
        {series.map((value, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm"
            style={{
              height: `${Math.max(10, (value / max) * 100)}%`,
              background: i === series.length - 1 ? "#534AB7" : "#EEEDFE",
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between">
        {DAY_LABELS.map((d) => (
          <span key={d} className="flex-1 text-center text-[10px] text-slate-400">{d}</span>
        ))}
      </div>
    </div>
  );
}
