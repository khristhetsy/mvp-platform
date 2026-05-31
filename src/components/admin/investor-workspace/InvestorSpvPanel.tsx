import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { getAdminCompanyWorkspaceHref } from "@/lib/admin/company-workspace-types";
import { buildInvestorFilteredHref } from "@/lib/admin/investor-workspace-types";
import { getAdminSpvWorkspaceHref } from "@/lib/admin/spv-workspace-types";
import type { AdminInvestorWorkspaceSpvSummary } from "@/lib/admin/investor-workspace-types";

export function InvestorSpvPanel({
  participations,
  profileId,
}: Readonly<{
  participations: AdminInvestorWorkspaceSpvSummary[];
  profileId: string;
}>) {
  return (
    <WorkspacePanel
      title="SPV participations"
      subtitle={`${participations.length} participation${participations.length === 1 ? "" : "s"} · limit ${25}`}
    >
      {participations.length === 0 ? (
        <EmptyState
          title="No SPV participations"
          description="This investor is not yet participating in any SPV opportunities."
          actionLabel="View all SPVs"
          actionHref="/admin/spvs"
        />
      ) : (
        <div className="space-y-3">
          {participations.map((row) => (
            <div key={row.participationId} className="rounded-xl border border-slate-200 p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link
                    href={getAdminSpvWorkspaceHref(row.id)}
                    className="font-semibold text-indigo-700 hover:text-indigo-900"
                  >
                    {row.name}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    <Link href={getAdminCompanyWorkspaceHref(row.companyId)} className="text-indigo-600 hover:text-indigo-800">
                      {row.companyName}
                    </Link>
                    {" · "}
                    {row.indicativeAmount} indicative
                  </p>
                </div>
                <StatusBadge label={row.status.replace(/_/g, " ")} status="info" />
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                <p>Document readiness {row.documentReadinessPct}%</p>
                <p>{row.pendingRequirements} pending requirements</p>
                <p>Next: {row.nextAction}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-slate-500">
        Source: spv_participations ·{" "}
        <Link href={buildInvestorFilteredHref("/admin/spvs", profileId)} className="font-medium text-indigo-600 hover:text-indigo-800">
          Filter SPVs for this investor
        </Link>
      </p>
    </WorkspacePanel>
  );
}
