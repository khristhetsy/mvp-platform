import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MetricGrid } from "@/components/ui/workspace-layout";
import { MetricCard } from "@/components/MetricCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import type { AdminSpvWorkspaceData } from "@/lib/admin/spv-workspace-types";
import { getInvestorWorkspaceHref } from "@/lib/ui/drilldown-links";

function formatStatusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export function SpvInvestorParticipationPanel({
  participation,
  spvId,
}: Readonly<{
  participation: AdminSpvWorkspaceData["participation"];
  spvId: string;
}>) {
  return (
    <WorkspacePanel title="Investor participation" subtitle={`${participation.activeCount} active · limit ${25}`}>
      <MetricGrid>
        <MetricCard label="Active investors" value={String(participation.activeCount)} detail={`${participation.totalCount} total rows`} accent="indigo" />
        <MetricCard label="Indicative total" value={participation.indicativeTotal} detail="Non-binding totals" accent="violet" />
        <MetricCard label="Document-ready" value={String(participation.documentReadyCount)} detail="Investors marked ready" accent="blue" />
      </MetricGrid>

      {participation.rows.length === 0 ? (
        <EmptyState title="No participations" description="Seed or invite investors from SPV management below." />
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {participation.rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
              <div>
                <Link href={getInvestorWorkspaceHref(row.investorId)} className="font-medium text-indigo-700 hover:text-indigo-900">
                  {row.investorName}
                </Link>
                <p className="mt-1 text-xs text-slate-500">
                  {row.indicativeAmount} · Document readiness {row.documentReadinessPct}%
                  {row.pendingRequirements > 0 ? ` · ${row.pendingRequirements} pending reqs` : ""}
                </p>
              </div>
              <StatusBadge label={formatStatusLabel(row.status)} status="info" />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Source: spv_participations ·{" "}
        <Link href={`/admin/spvs/${spvId}`} className="font-medium text-indigo-600 hover:text-indigo-800">
          Refresh workspace
        </Link>
      </p>
    </WorkspacePanel>
  );
}
