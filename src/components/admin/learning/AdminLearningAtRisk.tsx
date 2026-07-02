import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { AdminLearningAtRiskNudgeButton } from "@/components/admin/learning/AdminLearningAtRiskNudgeButton";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { getLearningAtRiskFounders } from "@/lib/learning/progress";

function formatLastActivity(lastActivityAt: string | null) {
  if (!lastActivityAt) return "Never";
  return new Date(lastActivityAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function AdminLearningAtRisk() {
  const t = await getTranslations("adminCmp");
  const founders = await getLearningAtRiskFounders(7);

  return (
    <WorkspacePanel
      title={t("at_risk_founders")}
      subtitle={t("no_learning_activity_in_the_last_7_days_sort")}
    >
      {founders.length === 0 ? (
        <p className="text-sm text-slate-600">{t("all_founders_have_recent_learning_activity")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">Founder</th>
                <th className="px-2 py-2">Company</th>
                <th className="px-2 py-2">Days inactive</th>
                <th className="px-2 py-2">Last activity</th>
                <th className="px-2 py-2">Progress</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {founders.map((founder) => (
                <tr key={founder.companyId}>
                  <td className="px-2 py-3">
                    <p className="font-medium text-slate-900">{founder.founderName ?? "—"}</p>
                    <p className="text-xs text-slate-500">{founder.founderEmail ?? "—"}</p>
                  </td>
                  <td className="px-2 py-3">
                    <Link
                      href={`/admin/companies/${founder.companyId}`}
                      className="font-medium text-indigo-700 hover:text-indigo-900"
                    >
                      {founder.companyName}
                    </Link>
                  </td>
                  <td className="px-2 py-3 text-slate-700">
                    {founder.lastActivityAt ? `${founder.daysInactive}d` : "No activity"}
                  </td>
                  <td className="px-2 py-3 text-slate-600">{formatLastActivity(founder.lastActivityAt)}</td>
                  <td className="px-2 py-3 text-slate-600">
                    {founder.percentComplete}% · {founder.modulesCompleted} completed · {founder.modulesEngaged}{" "}
                    engaged
                  </td>
                  <td className="px-2 py-3">
                    <AdminLearningAtRiskNudgeButton
                      founderId={founder.founderId}
                      companyId={founder.companyId}
                      daysInactive={founder.daysInactive}
                      percentComplete={founder.percentComplete}
                      lastActivityAt={founder.lastActivityAt}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WorkspacePanel>
  );
}
