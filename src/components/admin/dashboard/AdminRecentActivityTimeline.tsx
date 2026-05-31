import { EmptyState } from "@/components/ui/EmptyState";
import { ActionablePanelRow } from "@/components/ui/drilldown";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { getTimelineActivityHref } from "@/lib/ui/drilldown-links";
import type { AdminCrmActivityRow } from "@/lib/data/investor-crm";

const ACTIVITY_ICONS: Record<string, string> = {
  saved_deal: "◆",
  expressed_interest: "●",
  requested_intro: "→",
  follow_up_requested: "↻",
  pledge_amount_submitted: "$",
  message_thread_created: "✉",
  message_sent: "✉",
  meeting_requested: "◷",
  meeting_accepted: "✓",
  meeting_declined: "×",
  report_viewed: "▣",
  spv_interest_expressed: "SPV",
};

function formatActivityLabel(type: string) {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function groupActivities(activities: AdminCrmActivityRow[]) {
  const groups = new Map<string, AdminCrmActivityRow[]>();

  for (const row of activities) {
    const key = row.activity_type;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  return [...groups.entries()].sort((a, b) => {
    const aTime = a[1][0]?.created_at ?? "";
    const bTime = b[1][0]?.created_at ?? "";
    return bTime.localeCompare(aTime);
  });
}

export function AdminRecentActivityTimeline({
  activities,
}: Readonly<{ activities: AdminCrmActivityRow[] }>) {
  const grouped = groupActivities(activities);

  return (
    <WorkspacePanel
      title="Recent activity timeline"
      subtitle="Operational CRM events grouped by activity type"
    >
      {activities.length === 0 ? (
        <EmptyState
          title="No recent activity"
          description="Investor CRM events will appear here as platform activity is recorded."
        />
      ) : (
        <div className="space-y-5">
          {grouped.map(([type, rows]) => (
            <section key={type} className="space-y-2">
              <header className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-semibold text-slate-700"
                  aria-hidden
                >
                  {ACTIVITY_ICONS[type] ?? "·"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-900">{formatActivityLabel(type)}</p>
                  <p className="text-[10px] text-slate-500">{rows.length} event{rows.length === 1 ? "" : "s"}</p>
                </div>
              </header>
              <ul className="space-y-2 pl-8">
                {rows.slice(0, 5).map((row) => {
                  const investor = row.investor_name ?? row.investor_email ?? "Unknown investor";
                  const href = getTimelineActivityHref(row.activity_type);
                  return (
                    <li key={row.id} className="relative border-l border-slate-200 pl-4">
                      <span className="absolute -left-[3px] top-2 h-1.5 w-1.5 rounded-full bg-slate-300" aria-hidden />
                      <ActionablePanelRow href={href} ariaLabel={`View ${formatActivityLabel(row.activity_type)} for ${investor}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-sm font-medium text-slate-900 group-hover:text-[var(--navy)]">{investor}</p>
                            <time className="font-mono text-[10px] text-slate-400">{formatTimestamp(row.created_at)}</time>
                          </div>
                          <p className="text-xs text-slate-600">{row.company_name ?? "Unknown company"}</p>
                          {row.pipeline_stage ? (
                            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                              Pipeline · {formatActivityLabel(row.pipeline_stage)}
                            </p>
                          ) : null}
                        </div>
                      </ActionablePanelRow>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </WorkspacePanel>
  );
}
