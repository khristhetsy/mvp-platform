import Link from "next/link";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { buildSpvFilteredHref, buildSpvReportHref } from "@/lib/admin/spv-workspace-types";
import { getDrilldownHref } from "@/lib/ui/drilldown-links";

const REPORT_LINKS = [
  {
    title: "SPV Readiness Report",
    description: "Checklist, requirements, packages, and closing readiness.",
    href: (companyId: string) => buildSpvReportHref(companyId, "spv_readiness"),
  },
  {
    title: "Due diligence report",
    description: "Company diligence readiness and remediation indicators.",
    href: (companyId: string) => buildSpvReportHref(companyId, "due_diligence"),
  },
  {
    title: "Compliance report",
    description: "Compliance events with severity and review metadata.",
    href: (companyId: string) => buildSpvReportHref(companyId, "compliance"),
  },
  {
    title: "Investor activity report",
    description: "Interests, CRM activity, and engagement aggregates for the company.",
    href: (companyId: string) => buildSpvReportHref(companyId, "investor_activity"),
  },
  {
    title: "Platform activity",
    description: "Operational activity timeline and exports.",
    href: () => getDrilldownHref("platform_activity"),
  },
] as const;

export function SpvReportsPanel({
  spvId,
  companyId,
  companyName,
}: Readonly<{ spvId: string; companyId: string; companyName: string }>) {
  return (
    <WorkspacePanel title="Reports & quick actions" subtitle={`Pre-filtered for ${companyName}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        {REPORT_LINKS.map((report) => (
          <Link
            key={report.title}
            href={report.href(companyId)}
            className="rounded-xl border border-slate-200 bg-white p-4 text-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/30"
          >
            <p className="font-semibold text-slate-900">{report.title}</p>
            <p className="mt-1 text-xs text-slate-600">{report.description}</p>
          </Link>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        SPV context ·{" "}
        <Link href={buildSpvFilteredHref("/admin/spvs", spvId, companyId)} className="font-medium text-indigo-600 hover:text-indigo-800">
          Filter SPV list
        </Link>
      </p>
    </WorkspacePanel>
  );
}
