import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageSection } from "@/components/ui/workspace-layout";

type ControlItem = {
  href: string;
  label: string;
  count: number | null;
  status: "neutral" | "info" | "success" | "warning" | "danger" | "pending";
  detail: string;
};

export function AdminOperationsControl({
  pendingReviews,
  pendingInvestorApprovals,
  openComplianceEvents,
  spvPipelineCount,
  reportsGenerated,
  serviceRoleOk,
}: Readonly<{
  pendingReviews: number;
  pendingInvestorApprovals: number;
  openComplianceEvents: number;
  spvPipelineCount: number;
  reportsGenerated: number;
  serviceRoleOk: boolean;
}>) {
  const controls: ControlItem[] = [
    {
      href: "/admin/companies",
      label: "Pending Company Reviews",
      count: pendingReviews,
      status: pendingReviews > 0 ? "warning" : "success",
      detail: pendingReviews > 0 ? "Review queue active" : "Queue clear",
    },
    {
      href: "/admin/investors",
      label: "Investor Approvals",
      count: pendingInvestorApprovals,
      status: pendingInvestorApprovals > 0 ? "warning" : "success",
      detail: pendingInvestorApprovals > 0 ? "Approvals required" : "No pending approvals",
    },
    {
      href: "/admin/compliance",
      label: "Compliance Queue",
      count: openComplianceEvents,
      status: openComplianceEvents > 0 ? "danger" : "success",
      detail: openComplianceEvents > 0 ? "Events need review" : "No open events",
    },
    {
      href: "/admin/spvs",
      label: "SPV Readiness",
      count: spvPipelineCount,
      status: spvPipelineCount > 0 ? "info" : "neutral",
      detail: "Active SPV pipeline",
    },
    {
      href: "/admin/reports",
      label: "Reports",
      count: reportsGenerated,
      status: "info",
      detail: "Diligence reports generated",
    },
    {
      href: "/admin/system-health",
      label: "System Health",
      count: null,
      status: serviceRoleOk ? "success" : "warning",
      detail: serviceRoleOk ? "Service role configured" : "Configuration check required",
    },
  ];

  return (
    <PageSection title="Operations control" subtitle="Actionable queues and shortcuts">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {controls.map((item) => (
          <Link
            key={item.href + item.label}
            href={item.href}
            className="group flex h-full min-h-[5.5rem] flex-col rounded-xl border border-slate-200/80 bg-white p-3 shadow-[var(--shadow-panel)] transition hover:border-slate-300"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{item.label}</p>
              {item.count !== null && item.count > 0 ? (
                <StatusBadge label={String(item.count)} status={item.status} />
              ) : null}
            </div>
            <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-slate-950">
              {item.count === null ? "→" : item.count}
            </p>
            <p className="mt-auto pt-1 text-xs leading-5 text-slate-600 group-hover:text-slate-800">{item.detail}</p>
          </Link>
        ))}
      </div>
    </PageSection>
  );
}
