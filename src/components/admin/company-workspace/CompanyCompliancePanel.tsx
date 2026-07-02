import { useTranslations } from "next-intl";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge, severityToStatus } from "@/components/ui/StatusBadge";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { DraftEmailPanel } from "@/components/email/DraftEmailPanel";
import { buildCompanyFilteredHref, type AdminCompanyWorkspaceData } from "@/lib/admin/company-workspace-types";

export function CompanyCompliancePanel({
  compliance,
  companyId,
}: Readonly<{
  compliance: AdminCompanyWorkspaceData["compliance"];
  companyId: string;
}>) {
  const t = useTranslations("adminCmp");
  return (
    <WorkspacePanel title={t("compliance_summary")} subtitle={t("open_and_recent_events_for_this_company")}>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
          <p className="text-lg font-semibold text-slate-900">{compliance.openCount}</p>
          <p className="text-xs text-slate-500">{t("open_under_review")}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
          <p className="text-lg font-semibold text-red-700">{compliance.criticalCount}</p>
          <p className="text-xs text-slate-500">{t("critical")}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
          <p className="text-lg font-semibold text-amber-700">{compliance.highCount}</p>
          <p className="text-xs text-slate-500">{t("high_severity")}</p>
        </div>
      </div>
      {compliance.nextAction ? (
        <p className="mb-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">
          {compliance.nextAction}
        </p>
      ) : null}
      <div className="mb-4">
        <DraftEmailPanel
          role="admin"
          entityType="company"
          entityId={companyId}
          defaultTemplate="compliance_followup"
          compact
        />
      </div>
      {compliance.recentEvents.length === 0 ? (
        <EmptyState title={t("no_compliance_events")} description={t("no_compliance_events_recorded_for_this_compa")} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {compliance.recentEvents.map((event) => (
            <li key={event.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-slate-900">{event.title}</p>
                <StatusBadge label={event.severity} status={severityToStatus(event.severity)} />
                <StatusBadge label={event.status} status="neutral" />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {event.event_type} · {new Date(event.created_at).toLocaleString("en-US", { timeZone: "UTC" })}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-slate-500">
        Source: compliance_events ·{" "}
        <Link href={buildCompanyFilteredHref("/admin/compliance", companyId)} className="font-medium text-indigo-600 hover:text-indigo-800">
          Open compliance queue
        </Link>
      </p>
    </WorkspacePanel>
  );
}
