import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MetricGrid } from "@/components/ui/workspace-layout";
import {
  buildSpvFilteredHref,
  buildSpvReportHref,
  type AdminSpvWorkspaceData,
} from "@/lib/admin/spv-workspace-types";
import { getAdminCompanyWorkspaceHref } from "@/lib/admin/company-workspace-types";
import { formatSpvCurrency } from "@/lib/spv/display";

export function SpvWorkspaceHeader({ data }: Readonly<{ data: AdminSpvWorkspaceData }>) {
  const { spv, company, readiness, participation } = data;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="SPV workspace"
        title={spv.name}
        description={`${company.name} · Operational command surface`}
        metadata={`SPV ID ${spv.id.slice(0, 8)}… · Status ${spv.status ?? "draft"} · Last loaded ${new Date().toLocaleString("en-US", { timeZone: "UTC" })} UTC`}
        queueIndicator={
          data.queueItems.length > 0 ? (
            <StatusBadge
              label={`${data.queueItems.length} queue item${data.queueItems.length === 1 ? "" : "s"}`}
              status="warning"
              dot
            />
          ) : null
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/spvs?spv=${spv.id}`}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Open SPV management
            </Link>
            <Link
              href={getAdminCompanyWorkspaceHref(company.id)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              View company
            </Link>
            <Link
              href={buildSpvReportHref(company.id, "spv_readiness")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              View reports
            </Link>
            <Link
              href={`/admin/spvs?queue=investor_documents&spv=${spv.id}`}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              View investor requirements
            </Link>
            <Link
              href={`#spv-closing-review`}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              View closing review
            </Link>
          </div>
        }
      />

      <p className="text-sm text-slate-600">
        Company:{" "}
        <Link href={getAdminCompanyWorkspaceHref(company.id)} className="font-medium text-indigo-700 hover:text-indigo-900">
          {company.name}
        </Link>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={readiness.operationalLabel} status="info" />
        <StatusBadge label={`Checklist ${readiness.checklistPct}%`} status="neutral" />
        <StatusBadge label={`Packages ${readiness.packagePct}%`} status="neutral" />
        <StatusBadge label={`Closing ${readiness.closingPct}%`} status="neutral" />
      </div>

      <MetricGrid>
        <MetricCard label="Target amount" value={formatSpvCurrency(spv.target_amount)} detail="SPV target" accent="indigo" />
        <MetricCard
          label="Indicative total"
          value={participation.indicativeTotal}
          detail={`${participation.activeCount} active investors`}
          accent="violet"
        />
        <MetricCard
          label="Investor requirements"
          value={`${readiness.investorRequirementsPct}%`}
          detail={`${data.requirements.pending} pending`}
          accent="blue"
          href={`/admin/spvs?queue=investor_documents&spv=${spv.id}`}
        />
        <MetricCard
          label="Open compliance"
          value={String(data.compliance.openCount)}
          detail={`${data.compliance.criticalCount} critical`}
          accent="slate"
          href={buildSpvFilteredHref("/admin/compliance", spv.id, company.id)}
        />
      </MetricGrid>
    </div>
  );
}
