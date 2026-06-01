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
  return (
    <WorkspacePanel title="Compliance summary" subtitle="Open and recent events for this company">
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
          <p className="text-lg font-semibold text-slate-900">{compliance.openCount}</p>
          <p className="text-xs text-slate-500">Open / under review</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
          <p className="text-lg font-semibold text-red-700">{compliance.criticalCount}</p>
          <p className="text-xs text-slate-500">Critical</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
          <p className="text-lg font-semibold text-amber-700">{compliance.highCount}</p>
          <p className="text-xs text-slate-500">High severity</p>
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
        <EmptyState title="No compliance events" description="No compliance events recorded for this company." />
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
