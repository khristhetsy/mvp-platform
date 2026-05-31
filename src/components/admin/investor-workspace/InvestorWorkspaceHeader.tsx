import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MetricGrid } from "@/components/ui/workspace-layout";
import {
  buildInvestorFilteredHref,
  buildInvestorReportHref,
  type AdminInvestorWorkspaceData,
} from "@/lib/admin/investor-workspace-types";
import { investorApprovalStatusLabel } from "@/lib/investor/access";
import { INVESTOR_TYPES } from "@/lib/investor/types";

function formatMoney(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function investorTypeLabel(value: string | null) {
  if (!value) return "Type not set";
  return INVESTOR_TYPES.find((row) => row.value === value)?.label ?? value;
}

function approvalStatusToBadge(
  status: string,
): "neutral" | "info" | "success" | "warning" | "danger" | "pending" {
  switch (status) {
    case "approved":
      return "success";
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

export function InvestorWorkspaceHeader({ data }: Readonly<{ data: AdminInvestorWorkspaceData }>) {
  const { investor, profileId, engagement } = data;
  const investorName = investor.profiles?.full_name ?? investor.profiles?.email ?? "Investor";

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Investor workspace"
        title={investorName}
        description={
          investor.firm_name
            ? `${investor.firm_name} · ${investorTypeLabel(investor.investor_type)}`
            : investorTypeLabel(investor.investor_type)
        }
        metadata={`Profile ID ${profileId.slice(0, 8)}… · Last loaded ${new Date().toLocaleString("en-US", { timeZone: "UTC" })} UTC`}
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
              href={`/admin/investors?status=${investor.approval_status}`}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Review investor
            </Link>
            <Link
              href={buildInvestorFilteredHref("/admin/crm", profileId)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Open CRM
            </Link>
            <Link
              href={buildInvestorFilteredHref("/admin/spvs", profileId)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              View SPVs
            </Link>
            <Link
              href={buildInvestorFilteredHref("/admin/crm", profileId, { activity: "message_sent" })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              View messages
            </Link>
            <Link
              href={buildInvestorFilteredHref("/admin/compliance", profileId)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              View compliance
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={investorApprovalStatusLabel(investor.approval_status)} status={approvalStatusToBadge(investor.approval_status)} />
        <StatusBadge
          label={investor.accredited_status ? "Accredited (self-attested)" : "Not accredited"}
          status={investor.accredited_status ? "success" : "neutral"}
        />
      </div>

      <MetricGrid>
        <MetricCard
          label="Check size"
          value={`${formatMoney(investor.check_size_min)} – ${formatMoney(investor.check_size_max)}`}
          detail="Preferred investment range"
          accent="indigo"
        />
        <MetricCard
          label="Interests"
          value={String(engagement.interests)}
          detail={`${engagement.savedDeals} saved · ${engagement.introRequests} intros`}
          accent="violet"
          href={buildInvestorFilteredHref("/admin/crm", profileId)}
        />
        <MetricCard
          label="SPV participations"
          value={String(data.spvParticipations.length)}
          detail="Active pipeline"
          accent="blue"
          href={buildInvestorFilteredHref("/admin/spvs", profileId)}
        />
        <MetricCard
          label="Open compliance"
          value={String(data.compliance.openCount)}
          detail={`${data.compliance.criticalCount} critical`}
          accent="slate"
          href={buildInvestorFilteredHref("/admin/compliance", profileId)}
        />
      </MetricGrid>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Investment preferences</p>
        <dl className="mt-3 grid gap-2 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">Sectors</dt>
            <dd className="font-medium text-slate-900">{investor.preferred_sectors.join(", ") || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Stages</dt>
            <dd className="font-medium text-slate-900">{investor.preferred_stages.join(", ") || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Geographies</dt>
            <dd className="font-medium text-slate-900">{investor.preferred_geographies.join(", ") || "—"}</dd>
          </div>
        </dl>
        {investor.matchingSummary ? (
          <p className="mt-3 text-xs text-indigo-800">
            Marketplace match quality: <strong>{investor.matchingSummary.highMatchCompanyCount}</strong> companies ≥
            70% · best score <strong>{investor.matchingSummary.topMatchScore}%</strong>
          </p>
        ) : null}
      </div>

      <p className="text-xs text-slate-500">
        Quick report:{" "}
        <Link href={buildInvestorReportHref(profileId, "investor_activity")} className="font-medium text-indigo-600 hover:text-indigo-800">
          Investor activity export
        </Link>
      </p>
    </div>
  );
}
