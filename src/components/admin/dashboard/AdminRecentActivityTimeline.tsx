import { EmptyState } from "@/components/ui/EmptyState";
import { ActionablePanelRow } from "@/components/ui/drilldown";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import {
  formatOperationalEventType,
  formatOperationalTimestamp,
  getOperationalCategoryIcon,
  getOperationalCategoryLabel,
  getOperationalEventHref,
  getOperationalEventIcon,
  getOperationalEventSubtitle,
  groupOperationalFeedByCategory,
} from "@/lib/operational-activity/event-display";
import type { OperationalActivityFeedItem } from "@/lib/operational-activity/types";

export function AdminRecentActivityTimeline({
  activities,
}: Readonly<{ activities: OperationalActivityFeedItem[] }>) {
  const grouped = groupOperationalFeedByCategory(activities);

  return (
    <WorkspacePanel
      title="Recent activity timeline"
      subtitle="Unified operational events across CRM, SPV, compliance, imports, and onboarding"
    >
      {activities.length === 0 ? (
        <EmptyState
          title="No operational activity yet"
          description="Platform events will appear here as investors, founders, and admins take action."
        />
      ) : (
        <div className="space-y-5">
          {grouped.map(([category, rows]) => (
            <section key={category} className="space-y-2">
              <header className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-semibold text-slate-700"
                  aria-hidden
                >
                  {getOperationalCategoryIcon(category)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-900">{getOperationalCategoryLabel(category)}</p>
                  <p className="text-[10px] text-slate-500">
                    {rows.length} event{rows.length === 1 ? "" : "s"}
                  </p>
                </div>
              </header>
              <ul className="space-y-2 pl-8">
                {rows.slice(0, 5).map((row) => {
                  const href = getOperationalEventHref(row);
                  const subtitle = getOperationalEventSubtitle(row);
                  return (
                    <li key={row.id} className="relative border-l border-slate-200 pl-4">
                      <span className="absolute -left-[3px] top-2 h-1.5 w-1.5 rounded-full bg-slate-300" aria-hidden />
                      <ActionablePanelRow
                        href={href}
                        ariaLabel={`View ${row.title}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900 group-hover:text-slate-950">
                              <span className="text-[10px] text-slate-400" aria-hidden>
                                {getOperationalEventIcon(row.event_type, row.event_category)}
                              </span>
                              {row.title}
                            </p>
                            <time className="font-mono text-[10px] text-slate-500">
                              {formatOperationalTimestamp(row.created_at)}
                            </time>
                          </div>
                          {subtitle ? <p className="text-xs text-slate-600">{subtitle}</p> : null}
                          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                            {formatOperationalEventType(row.event_type)}
                            {row.severity !== "info" ? ` · ${row.severity}` : ""}
                          </p>
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
