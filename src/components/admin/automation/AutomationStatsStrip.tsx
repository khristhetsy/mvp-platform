import type { AutomationConsoleStats, AutomationCronVisibility } from "@/lib/automation/admin-console-types";

export function AutomationStatsStrip({
  stats,
  cron,
}: Readonly<{ stats: AutomationConsoleStats; cron: AutomationCronVisibility }>) {
  const items = [
    { label: "Runs today", value: stats.runsToday },
    { label: "Failures today", value: stats.failuresToday },
    { label: "Blocked workflows", value: stats.blockedWorkflows },
    { label: "Deps resolved", value: stats.dependenciesResolvedToday },
    { label: "Avg duration", value: `${stats.avgDurationMs}ms` },
    {
      label: "Last cron",
      value: cron.lastOrchestrationAt
        ? new Date(cron.lastOrchestrationAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
          })
        : "—",
      sub: cron.lastOrchestrationStatus ?? undefined,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-[var(--shadow-panel)]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
          <p className="mt-1 font-mono text-lg font-semibold text-slate-950">{item.value}</p>
          {item.sub ? <p className="mt-0.5 text-[10px] text-slate-500">{item.sub}</p> : null}
        </div>
      ))}
    </div>
  );
}
