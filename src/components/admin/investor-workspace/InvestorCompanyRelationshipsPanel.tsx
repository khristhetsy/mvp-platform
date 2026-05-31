import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { getAdminCompanyWorkspaceHref } from "@/lib/admin/company-workspace-types";
import type { AdminInvestorWorkspaceCompanyRelation } from "@/lib/admin/investor-workspace-types";

function formatSource(source: string) {
  return source
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function InvestorCompanyRelationshipsPanel({
  companies,
}: Readonly<{ companies: AdminInvestorWorkspaceCompanyRelation[] }>) {
  return (
    <WorkspacePanel title="Connected companies" subtitle={`${companies.length} unique compan${companies.length === 1 ? "y" : "ies"}`}>
      {companies.length === 0 ? (
        <EmptyState
          title="No company relationships"
          description="This investor has not yet connected to companies through saves, interests, intros, messages, or SPVs."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {companies.map((row) => (
            <li key={row.companyId} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
              <div>
                <Link
                  href={getAdminCompanyWorkspaceHref(row.companyId)}
                  className="font-medium text-indigo-700 hover:text-indigo-900"
                >
                  {row.companyName}
                </Link>
                <div className="mt-1 flex flex-wrap gap-1">
                  {row.sources.map((source) => (
                    <StatusBadge key={source} label={formatSource(source)} status="neutral" />
                  ))}
                </div>
              </div>
              <Link
                href={getAdminCompanyWorkspaceHref(row.companyId)}
                className="text-xs font-medium text-slate-500 hover:text-indigo-700"
              >
                Open company workspace →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WorkspacePanel>
  );
}
