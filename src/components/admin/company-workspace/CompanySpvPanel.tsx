import { useTranslations } from "next-intl";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { buildCompanyFilteredHref, type AdminCompanyWorkspaceSpvSummary } from "@/lib/admin/company-workspace-types";

export function CompanySpvPanel({
  spvs,
  companyId,
}: Readonly<{ spvs: AdminCompanyWorkspaceSpvSummary[]; companyId: string }>) {
  const t = useTranslations("adminCmp");
  return (
    <WorkspacePanel
      title={t("spv_opportunities")}
      subtitle={`${spvs.length} SPV${spvs.length === 1 ? "" : "s"} linked to this company`}
    >
      {spvs.length === 0 ? (
        <EmptyState
          title={t("no_spv_opportunities")}
          description={t("this_company_does_not_have_spv_opportunities")}
          actionLabel="View all SPVs"
          actionHref="/admin/spvs"
        />
      ) : (
        <div className="space-y-3">
          {spvs.map((spv) => (
            <div key={spv.id} className="rounded-xl border border-slate-200 p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/admin/spvs?spv=${spv.id}`} className="font-semibold text-indigo-700 hover:text-indigo-900">
                    {spv.name}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    Status {spv.status} · {spv.participantCount} participants · {spv.indicativeTotal} indicative
                  </p>
                </div>
                <StatusBadge label={spv.operationalReadinessLabel} status="info" />
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                <p>Checklist {spv.checklistPct}%</p>
                <p>Packages {spv.packagePct}%</p>
                <p>Closing {spv.closingPct}%</p>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {spv.pendingRequirements > 0 ? `${spv.pendingRequirements} pending investor requirements · ` : ""}
                Next: {spv.nextAction}
              </p>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-slate-500">
        Source: spv_opportunities ·{" "}
        <Link href={buildCompanyFilteredHref("/admin/spvs", companyId)} className="font-medium text-indigo-600 hover:text-indigo-800">
          Filter SPVs for this company
        </Link>
      </p>
    </WorkspacePanel>
  );
}
