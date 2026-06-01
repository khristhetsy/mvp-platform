import type { ActionCenterAnalytics } from "@/lib/actions/types";
import type { NextBestActionRole } from "@/lib/next-best-actions/types";

function Stat({ label, value, tone }: Readonly<{ label: string; value: number; tone?: string }>) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${tone ?? "border-slate-200/80 bg-white"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[var(--navy)]">{value}</p>
    </div>
  );
}

export function ActionAnalyticsStrip({
  analytics,
  role,
}: Readonly<{ analytics: ActionCenterAnalytics; role: NextBestActionRole }>) {
  if (role === "founder") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open" value={analytics.open} />
        <Stat label="Overdue" value={analytics.overdue} tone="border-red-200/80 bg-red-50/50" />
        <Stat label="Completed this week" value={analytics.completedThisWeek} tone="border-emerald-200/80 bg-emerald-50/40" />
        <Stat label="Readiness impact" value={analytics.readinessImpact ?? 0} />
      </div>
    );
  }

  if (role === "investor") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pending requirements" value={analytics.pendingRequirements ?? 0} />
        <Stat label="Overdue" value={analytics.overdue} tone="border-red-200/80 bg-red-50/50" />
        <Stat label="Completed this week" value={analytics.completedThisWeek} />
        <Stat label="Active opportunities" value={analytics.activeOpportunities ?? 0} />
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Stat label="Critical" value={analytics.critical} tone="border-red-200/80 bg-red-50/50" />
      <Stat label="Escalated" value={analytics.escalated} tone="border-amber-200/80 bg-amber-50/40" />
      <Stat label="Overdue" value={analytics.overdue} tone="border-red-200/80 bg-red-50/50" />
      <Stat label="Blocked" value={analytics.blocked} tone="border-orange-200/80 bg-orange-50/40" />
      <Stat label="Completed today" value={analytics.completedToday} />
    </div>
  );
}
