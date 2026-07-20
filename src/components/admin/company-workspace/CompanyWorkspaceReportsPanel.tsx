import { useTranslations } from "next-intl";
import Link from "next/link";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { buildCompanyReportHref } from "@/lib/admin/company-workspace-types";
import { GenerateDiligenceReportButton } from "@/components/admin/company-workspace/GenerateDiligenceReportButton";

const REPORT_LINKS = [
  {
    title: "Due Diligence Report",
    description: "Readiness, documents, remediation, and review indicators.",
    reportType: "due_diligence",
  },
  {
    title: "SPV Readiness Report",
    description: "SPV checklist, requirements, packages, and closing readiness.",
    reportType: "spv_readiness",
  },
  {
    title: "Compliance report",
    description: "Compliance events with severity and review metadata.",
    reportType: "compliance",
  },
  {
    title: "Investor activity report",
    description: "Interests, CRM activity, and engagement aggregates.",
    reportType: "investor_activity",
  },
] as const;

export function CompanyWorkspaceReportsPanel({
  companyId,
  companyName,
}: Readonly<{ companyId: string; companyName: string }>) {
  const t = useTranslations("adminCmp");
  return (
    <WorkspacePanel title={t("reports_exports")} subtitle={`Pre-filtered for ${companyName}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        {REPORT_LINKS.map((report) => (
          <Link
            key={report.reportType}
            href={buildCompanyReportHref(companyId, report.reportType)}
            className="rounded-xl border border-slate-200 bg-white p-4 text-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/30"
          >
            <p className="font-semibold text-slate-900">{report.title}</p>
            <p className="mt-1 text-xs text-slate-600">{report.description}</p>
            <p className="mt-2 font-mono text-[10px] uppercase text-slate-400">{report.reportType}</p>
          </Link>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Source: /admin/reports · Company filter applied via URL parameters
      </p>

      <GenerateDiligenceReportButton companyId={companyId} />
    </WorkspacePanel>
  );
}
