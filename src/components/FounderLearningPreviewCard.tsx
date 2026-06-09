import Link from "next/link";
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
  const continueModule = continueModules[0] ?? null;
  const topRecommendation = recommendations[0] ?? null;

  return (
    <WorkspacePanel
      title="Institutional readiness learning"
      subtitle={`${overallPercent}% curriculum progress · ${currentMilestone?.label ?? "Building foundation"}`}
      action={
        <Link href="/founder/learning" className="text-xs font-semibold text-indigo-600 hover:text-indigo-500">
          Open learning
        </Link>
      }
    >
      <p className="mb-4 text-sm leading-6 text-slate-600">
        Online founder courses with lessons, quizzes, and learning progress — educational training for investor
        preparation only.
      </p>

      {nextMilestone && !nextMilestone.achieved ? (
        <p className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          Next milestone: <span className="font-semibold">{nextMilestone.label}</span>
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {continueModule ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Continue learning</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">{continueModule.title}</p>
            <p className="mt-1 text-xs text-slate-600">{continueModule.progress?.percent_complete ?? 0}% complete</p>
            <Link
              href={`/founder/learning/${continueModule.slug}`}
              className="mt-3 inline-flex text-xs font-semibold text-indigo-700"
            >
              Resume module →
            </Link>
          </div>
        ) : topRecommendation ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended for you</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">{topRecommendation.title}</p>
            <p className="mt-1 text-xs text-slate-600">{topRecommendation.reason}</p>
            <Link
              href={`/founder/learning/${topRecommendation.slug}`}
              className="mt-3 inline-flex text-xs font-semibold text-indigo-700"
            >
              Start module →
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Explore the readiness curriculum to strengthen institutional positioning.
          </div>
        )}
      </div>
    </WorkspacePanel>
  );
}
