import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MetricGrid } from "@/components/ui/workspace-layout";
import {
  buildCompanyFilteredHref,
  buildCompanyReportHref,
  type AdminCompanyWorkspaceData,
} from "@/lib/admin/company-workspace-types";

function reviewStatusToBadge(status: string | null): "neutral" | "info" | "success" | "warning" | "danger" | "pending" {
  switch (status) {
    case "approved":
      return "success";
    case "pending":
    case "submitted":
      return "pending";
    case "changes_requested":
      return "warning";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}

export function CompanyWorkspaceHeader({ data }: Readonly<{ data: AdminCompanyWorkspaceData }>) {
  const { company, founder, readiness } = data;
  const companyId = company.id;
  const isLive = company.is_published && company.marketplace_visible;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Company workspace"
        title={company.company_name}
        description={company.industry ? `${company.industry} · Operational command surface` : "Operational command surface"}
        metadata={`Company ID ${companyId.slice(0, 8)}… · Last loaded ${new Date().toLocaleString("en-US", { timeZone: "UTC" })} UTC`}
        queueIndicator={
          data.queueItems.length > 0 ? (
            <StatusBadge label={`${data.queueItems.length} queue item${data.queueItems.length === 1 ? "" : "s"}`} status="warning" dot />
          ) : null
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/companies?company=${companyId}`}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Review company
            </Link>
            <Link
              href={buildCompanyReportHref(companyId, "due_diligence")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Open reports
            </Link>
            <Link
              href={buildCompanyFilteredHref("/admin/spvs", companyId)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              View SPVs
            </Link>
            <Link
              href={buildCompanyFilteredHref("/admin/crm", companyId)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Open CRM
            </Link>
            <Link
              href={`/admin/audit?company=${companyId}`}
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-900 hover:bg-indigo-100"
            >
              Audit trail
            </Link>
            <Link
              href={buildCompanyFilteredHref("/admin/compliance", companyId)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Open compliance
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          label={`Review: ${company.review_status ?? "unknown"}`}
          status={reviewStatusToBadge(company.review_status)}
          dot
        />
        <StatusBadge
          label={isLive ? "Published on marketplace" : "Not published"}
          status={isLive ? "success" : "neutral"}
        />
        {readiness.latestScore != null ? (
          <StatusBadge label={`Readiness ${readiness.latestScore}`} status="info" />
        ) : null}
        <StatusBadge label={`Onboarding ${readiness.onboardingPercent}%`} status="neutral" />
      </div>

      {founder ? (
        <p className="text-sm text-slate-600">
          Founder contact: {founder.full_name ?? "Unknown"} · {founder.email ?? "—"}
        </p>
      ) : null}

      <MetricGrid>
        <MetricCard
          label="Readiness score"
          value={readiness.latestScore != null ? String(readiness.latestScore) : "—"}
          detail={readiness.milestoneLabel}
          accent="indigo"
        />
        <MetricCard
          label="Open remediation"
          value={String(readiness.remediation.active)}
          detail={`${readiness.remediation.highPriorityOpen} high priority`}
          accent="violet"
          status={readiness.remediation.active > 0 ? "warning" : "success"}
        />
        <MetricCard
          label="Investor interests"
          value={String(data.investorActivity.interests)}
          detail={`${data.investorActivity.introRequests} intro requests`}
          accent="blue"
        />
        <MetricCard
          label="Open compliance"
          value={String(data.compliance.openCount)}
          detail={`${data.compliance.criticalCount} critical`}
          accent="slate"
          status={data.compliance.criticalCount > 0 ? "danger" : data.compliance.openCount > 0 ? "warning" : "success"}
        />
      </MetricGrid>
    </div>
  );
}
