import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import { WorkflowProgressRail, type WorkflowStep } from "@/components/ui/WorkflowProgressRail";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { buildCompanyFilteredHref, type AdminCompanyWorkspaceData } from "@/lib/admin/company-workspace-types";

export function CompanyReadinessPanel({
  readiness,
  companyId,
}: Readonly<{
  readiness: AdminCompanyWorkspaceData["readiness"];
  companyId: string;
}>) {
  const steps: WorkflowStep[] = [
    {
      key: "onboarding",
      label: "Onboarding",
      complete: readiness.onboardingPercent >= 100,
      current: readiness.onboardingPercent > 0 && readiness.onboardingPercent < 100,
      detail: `${readiness.onboardingPercent}%`,
    },
    {
      key: "diligence",
      label: "Diligence",
      complete: readiness.latestScore != null && readiness.latestScore >= 70,
      current: readiness.latestScore != null && readiness.latestScore < 70,
      detail: readiness.latestScore != null ? `Score ${readiness.latestScore}` : "No report",
    },
    {
      key: "remediation",
      label: "Remediation",
      complete: readiness.remediation.active === 0,
      current: readiness.remediation.active > 0,
      detail: `${readiness.remediation.active} open`,
    },
  ];

  return (
    <WorkspacePanel title="Readiness summary" subtitle={`Milestone: ${readiness.milestoneLabel}`}>
      <WorkflowProgressRail steps={steps} compact />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Latest readiness score"
          value={readiness.latestScore != null ? String(readiness.latestScore) : "—"}
          detail={readiness.scoreHistory.length > 1 ? `${readiness.scoreHistory.length} reports on file` : "Single or no report"}
          accent="indigo"
        />
        <MetricCard
          label="Remediation tasks"
          value={String(readiness.remediation.active)}
          detail={`${readiness.remediation.completed} completed · ${readiness.remediation.highPriorityOpen} high priority`}
          accent="violet"
          status={readiness.remediation.highPriorityOpen > 0 ? "warning" : "neutral"}
        />
      </div>
      <p className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
        <span className="font-medium text-slate-900">Next action:</span> {readiness.nextAction}
      </p>
      {readiness.scoreHistory.length > 1 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Score history</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {readiness.scoreHistory.slice(0, 5).map((row, index) => (
              <li key={`${row.created_at}-${index}`}>
                {row.readiness_score ?? "—"} · {new Date(row.created_at).toLocaleDateString("en-US", { timeZone: "UTC" })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mt-4 text-xs text-slate-500">
        Source: diligence_reports, founder_remediation_tasks ·{" "}
        <Link href={buildCompanyFilteredHref("/admin/companies", companyId, { queue: "remediation" })} className="text-indigo-600 hover:text-indigo-800">
          Remediation queue
        </Link>
      </p>
    </WorkspacePanel>
  );
}
