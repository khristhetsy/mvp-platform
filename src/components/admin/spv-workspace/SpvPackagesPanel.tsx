import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MetricGrid } from "@/components/ui/workspace-layout";
import { MetricCard } from "@/components/MetricCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import type { AdminSpvWorkspaceData } from "@/lib/admin/spv-workspace-types";

export function SpvPackagesPanel({
  packages,
}: Readonly<{ packages: AdminSpvWorkspaceData["packages"] }>) {
  return (
    <WorkspacePanel title="Document packages" subtitle={`${packages.totalCount} packages · ${packages.readinessPct}% ready`}>
      <MetricGrid>
        <MetricCard label="Complete" value={String(packages.completeCount)} detail={`of ${packages.totalCount}`} accent="indigo" />
        <MetricCard label="Approved" value={String(packages.approvedCount)} detail="Approved packages" accent="violet" />
        <MetricCard label="Issued" value={String(packages.issuedCount)} detail="Issued to investors" accent="blue" />
        <MetricCard label="Pending prep" value={String(packages.pendingCount)} detail="Not started / preparing" accent="slate" />
      </MetricGrid>

      {packages.blockers.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Package blockers</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {packages.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {packages.rows.length === 0 ? (
        <EmptyState title="No document packages" description="Packages seed when SPV readiness sync runs." />
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {packages.rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <p className="font-medium capitalize text-slate-900">{row.label}</p>
                <p className="text-xs text-slate-500">
                  Updated {new Date(row.updatedAt).toLocaleString("en-US", { timeZone: "UTC" })}
                </p>
              </div>
              <StatusBadge label={row.status.replace(/_/g, " ")} status="neutral" />
            </li>
          ))}
        </ul>
      )}
    </WorkspacePanel>
  );
}
