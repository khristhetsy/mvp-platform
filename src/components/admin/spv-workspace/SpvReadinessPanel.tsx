import { StatusBadge } from "@/components/ui/StatusBadge";
import { MetricGrid } from "@/components/ui/workspace-layout";
import { MetricCard } from "@/components/MetricCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import type { AdminSpvWorkspaceData } from "@/lib/admin/spv-workspace-types";

export function SpvReadinessPanel({
  readiness,
}: Readonly<{ readiness: AdminSpvWorkspaceData["readiness"] }>) {
  return (
    <WorkspacePanel title="Operational readiness" subtitle="Derived from existing SPV readiness systems">
      <MetricGrid>
        <MetricCard label="Operational" value={readiness.operationalLabel} detail={readiness.operationalStatus} accent="indigo" />
        <MetricCard label="Checklist" value={`${readiness.checklistPct}%`} detail="SPV checklist readiness" accent="violet" />
        <MetricCard label="Investor reqs" value={`${readiness.investorRequirementsPct}%`} detail="Requirements approved/waived" accent="blue" />
        <MetricCard label="Packages" value={`${readiness.packagePct}%`} detail="Document package readiness" accent="slate" />
      </MetricGrid>

      <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-sm text-indigo-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Next operational action</p>
        <p className="mt-1 font-medium">{readiness.nextAction}</p>
        <p className="mt-1 text-xs text-indigo-800">Closing readiness {readiness.closingPct}%</p>
      </div>

      {readiness.blockers.length === 0 ? (
        <p className="mt-4 text-sm text-emerald-700">All closing readiness criteria met or no blockers detected.</p>
      ) : (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unmet criteria / blockers</p>
          <ul className="mt-2 space-y-2">
            {readiness.unmetCriteria
              .filter((row) => !row.met)
              .map((row) => (
                <li key={row.key} className="flex items-start gap-2 text-sm">
                  <StatusBadge label="Open" status="warning" />
                  <span className="text-slate-800">{row.label}</span>
                </li>
              ))}
          </ul>
        </div>
      )}

    </WorkspacePanel>
  );
}
