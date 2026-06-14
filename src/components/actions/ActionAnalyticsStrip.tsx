import type { ActionCenterAnalytics } from "@/lib/actions/types";
import type { NextBestActionRole } from "@/lib/next-best-actions/types";

function Stat({
  label,
  value,
  accentColor,
  valueColor,
}: Readonly<{
  label: string;
  value: number;
  accentColor?: string;
  valueColor?: string;
}>) {
  return (
    <div
      className="rounded-xl border border-slate-200/80 bg-white py-3 pl-4 pr-3"
      style={
        accentColor
          ? { borderLeft: `3px solid ${accentColor}`, borderRadius: "0 0.75rem 0.75rem 0" }
          : undefined
      }
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold" style={{ color: valueColor ?? "#0f172a" }}>
        {value}
      </p>
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
        <Stat label="Active" value={analytics.open} accentColor="#534AB7" valueColor="#3C3489" />
        <Stat label="Overdue" value={analytics.overdue} accentColor="#A32D2D" valueColor="#A32D2D" />
        <Stat label="Escalated" value={analytics.escalated} accentColor="#854F0B" valueColor="#854F0B" />
        <Stat label="Completed this week" value={analytics.completedThisWeek} accentColor="#3B6D11" valueColor="#3B6D11" />
      </div>
    );
  }

  if (role === "investor") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pending requirements" value={analytics.pendingRequirements ?? 0} accentColor="#534AB7" valueColor="#3C3489" />
        <Stat label="Overdue" value={analytics.overdue} accentColor="#A32D2D" valueColor="#A32D2D" />
        <Stat label="Completed this week" value={analytics.completedThisWeek} accentColor="#3B6D11" valueColor="#3B6D11" />
        <Stat label="Active opportunities" value={analytics.activeOpportunities ?? 0} />
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Stat label="Critical" value={analytics.critical} accentColor="#A32D2D" valueColor="#A32D2D" />
      <Stat label="Escalated" value={analytics.escalated} accentColor="#854F0B" valueColor="#854F0B" />
      <Stat label="Overdue" value={analytics.overdue} accentColor="#A32D2D" valueColor="#A32D2D" />
      <Stat label="Blocked" value={analytics.blocked} accentColor="#854F0B" />
      <Stat label="Completed today" value={analytics.completedToday} accentColor="#3B6D11" valueColor="#3B6D11" />
    </div>
  );
}
