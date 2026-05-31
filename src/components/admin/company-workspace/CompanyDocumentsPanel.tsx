import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { buildCompanyReportHref, type AdminCompanyWorkspaceData } from "@/lib/admin/company-workspace-types";

export function CompanyDocumentsPanel({
  documents,
  companyId,
}: Readonly<{
  documents: AdminCompanyWorkspaceData["documents"];
  companyId: string;
}>) {
  return (
    <WorkspacePanel title="Documents & diligence" subtitle="Document counts and latest diligence snapshot">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Documents</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{documents.totalCount}</p>
          <p className="mt-1 text-xs text-slate-500">Uploaded to data room</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pitch deck</p>
          <StatusBadge
            label={documents.pitchDeckPresent ? "Present" : "Missing"}
            status={documents.pitchDeckPresent ? "success" : "warning"}
            dot
          />
        </div>
      </div>
      {documents.latestDiligenceReport ? (
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-900">Latest diligence report</p>
          <p className="mt-1 text-slate-600">
            Readiness score: {documents.latestDiligenceReport.readiness_score ?? "—"} ·{" "}
            {new Date(documents.latestDiligenceReport.created_at).toLocaleDateString("en-US", { timeZone: "UTC" })}
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState
            title="No diligence report"
            description="An AI diligence report has not been generated for this company yet."
          />
        </div>
      )}
      {documents.missingRequiredHints.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Missing items (from report)</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
            {documents.missingRequiredHints.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mt-4 text-xs text-slate-500">
        Source: documents, diligence_reports ·{" "}
        <Link href={buildCompanyReportHref(companyId, "due_diligence")} className="font-medium text-indigo-600 hover:text-indigo-800">
          Export due diligence report
        </Link>
      </p>
    </WorkspacePanel>
  );
}
