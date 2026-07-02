import { useTranslations } from "next-intl";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActionablePanelRow } from "@/components/ui/drilldown";
import { StatusBadge, severityToStatus } from "@/components/ui/StatusBadge";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { getAdminCompanyWorkspaceHref } from "@/lib/admin/company-workspace-types";
import {
  formatOperationalEventType,
  formatOperationalTimestamp,
  getOperationalCategoryIcon,
  getOperationalCategoryLabel,
  getOperationalEventIcon,
} from "@/lib/operational-activity/event-display";
import type { OperationalActivityFeedItem } from "@/lib/operational-activity/types";

function getCompanyTimelineHref(item: OperationalActivityFeedItem, companyId: string): string {
  if (item.event_category === "compliance") {
    return `/admin/compliance?company=${companyId}&event=${item.id}`;
  }
  if (item.event_category === "spv" && item.spv_id) {
    return `/admin/spvs?spv=${item.spv_id}`;
  }
  if (item.event_category === "crm" || item.event_category === "investor" || item.event_category === "messaging") {
    return `/admin/crm?company=${companyId}`;
  }
  return getAdminCompanyWorkspaceHref(companyId);
}

export function CompanyTimelinePanel({
  items,
  companyId,
}: Readonly<{ items: OperationalActivityFeedItem[]; companyId: string }>) {
  const t = useTranslations("adminCmp");
  return (
    <WorkspacePanel
      title={t("recent_operational_activity")}
      subtitle={`${items.length} event${items.length === 1 ? "" : "s"} · Source: operational_activity_events`}
    >
      {items.length === 0 ? (
        <EmptyState
          title={t("no_operational_events_yet")}
          description={t("new_platform_actions_involving_this_company")}
          guidance="Investor interests, onboarding milestones, compliance events, and SPV updates will populate this timeline."
          metadata="Limit 25 most recent events"
        />
      ) : (
        <ul className="space-y-3">
          {items.map((row) => (
            <li key={row.id} className="relative border-l border-slate-200 pl-4">
              <span className="absolute -left-[3px] top-2 h-1.5 w-1.5 rounded-full bg-slate-300" aria-hidden />
              <ActionablePanelRow href={getCompanyTimelineHref(row, companyId)} ariaLabel={`View ${row.title}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-slate-400" aria-hidden>
                      {getOperationalEventIcon(row.event_type, row.event_category)}
                    </span>
                    <p className="text-sm font-medium text-slate-900">{row.title}</p>
                    <StatusBadge
                      label={getOperationalCategoryLabel(row.event_category)}
                      status="info"
                    />
                    {row.severity !== "info" ? (
                      <StatusBadge label={row.severity} status={severityToStatus(row.severity)} />
                    ) : null}
                  </div>
                  {row.description ? <p className="mt-1 text-xs text-slate-600 line-clamp-2">{row.description}</p> : null}
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                    {formatOperationalEventType(row.event_type)}
                    {row.actor_name ? ` · ${row.actor_name}` : ""}
                    {" · "}
                    <time>{formatOperationalTimestamp(row.created_at)}</time>
                  </p>
                </div>
              </ActionablePanelRow>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-slate-500">
        Source module: operational activity ·{" "}
        <Link href="/admin/dashboard" className="font-medium text-indigo-600 hover:text-indigo-800">
          Platform timeline
        </Link>
      </p>
    </WorkspacePanel>
  );
}
