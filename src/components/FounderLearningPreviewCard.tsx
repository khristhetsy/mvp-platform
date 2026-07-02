import Link from "next/link";
import { useTranslations } from "next-intl";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import type { FounderLearningModuleView } from "@/lib/learning/types";
import type { LearningRecommendation, ReadinessMilestone } from "@/lib/learning/types";

export function FounderLearningPreviewCard({
  overallPercent,
  currentMilestone,
  nextMilestone,
  continueModules,
  recommendations,
}: Readonly<{
  overallPercent: number;
  currentMilestone: ReadinessMilestone | null;
  nextMilestone: ReadinessMilestone | null;
  continueModules: FounderLearningModuleView[];
  recommendations: LearningRecommendation[];
}>) {
  const t = useTranslations("sharedCmp");
  const displayModules = continueModules.slice(0, 4);

  return (
    <WorkspacePanel
      title={t("institutional_readiness_learning")}
      subtitle={`${overallPercent}% curriculum progress · ${currentMilestone?.label ?? "Building foundation"}`}
      action={
        <Link href="/founder/learning" className="text-xs font-semibold text-indigo-600 hover:text-indigo-500">
          Open learning
        </Link>
      }
    >
      {/* Overall progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500">{t("overall_progress")}</span>
          <span className="text-xs font-semibold text-[#2E78F5]">{overallPercent}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${overallPercent}%`, background: "#2E78F5" }}
          />
        </div>
      </div>

      {nextMilestone && !nextMilestone.achieved ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2.5">
          <span className="text-xs text-indigo-600">{t("next_milestone")}</span>
          <span className="text-xs font-semibold text-indigo-900">{nextMilestone.label}</span>
        </div>
      ) : null}

      {/* Per-module progress rows */}
      {displayModules.length > 0 ? (
        <div className="space-y-3">
          {displayModules.map((mod) => {
            const pct = mod.progress?.percent_complete ?? 0;
            return (
              <div key={mod.slug} className="flex items-center gap-3">
                <Link
                  href={`/founder/learning/${mod.slug}`}
                  className="flex-1 min-w-0 text-xs font-medium text-slate-800 hover:text-[#2E78F5] truncate"
                >
                  {mod.title}
                </Link>
                <div className="w-16 sm:flex-1 shrink-0 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: pct === 100 ? "#3B6D11" : "#2E78F5" }}
                  />
                </div>
                <span className={`shrink-0 text-[11px] font-medium w-8 text-right ${pct === 100 ? "text-[#3B6D11]" : pct > 0 ? "text-[#2E78F5]" : "text-slate-400"}`}>
                  {pct === 100 ? "Done" : pct > 0 ? `${pct}%` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      ) : recommendations.length > 0 ? (
        <div className="space-y-2">
          {recommendations.slice(0, 2).map((rec) => (
            <Link
              key={rec.slug}
              href={`/founder/learning/${rec.slug}`}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 hover:border-[#2E78F5]/30 hover:bg-[#EEEDFE]/40"
            >
              <div>
                <p className="text-xs font-semibold text-slate-950">{rec.title}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{rec.reason}</p>
              </div>
              <span className="ml-3 shrink-0 text-xs font-semibold text-[#2E78F5]">{t("start")}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          Explore the readiness curriculum to strengthen institutional positioning.
        </div>
      )}
    </WorkspacePanel>
  );
}
