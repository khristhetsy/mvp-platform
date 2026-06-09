import Link from "next/link";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WorkflowProgressRail } from "@/components/ui/WorkflowProgressRail";
import { getModuleContent } from "@/lib/learning/modules";
import { lessonHref, programHref } from "@/lib/learning/lesson-keys";
import { moduleLessonCompletionPercent } from "@/lib/learning/lesson-progress-utils";
import type { LearningProgramDefinition } from "@/lib/learning/catalog";
import { isModuleStageUnlocked, previousStageLabel } from "@/lib/learning/stage-access";
import type { FounderLearningModuleView, FounderLessonProgressRecord, StageAccessMap } from "@/lib/learning/types";

export function FounderLearningProgramView({
  program,
  modules,
  lessonProgress,
  stageAccess,
}: Readonly<{
  program: LearningProgramDefinition;
  modules: FounderLearningModuleView[];
  lessonProgress: FounderLessonProgressRecord[];
  stageAccess: StageAccessMap;
}>) {
  const programLocked = !stageAccess[program.stage];
  const modulesInProgram = modules.filter((m) => program.moduleSlugs.includes(m.slug));
  const avg =
    modulesInProgram.length > 0
      ? Math.round(
          modulesInProgram.reduce((sum, m) => sum + (m.progress?.percent_complete ?? 0), 0) /
            modulesInProgram.length,
        )
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Learning program"
        title={program.title}
        description={program.description}
        metadata={`${program.readinessFocus} · ${avg}% module progress`}
        queueIndicator={<StatusBadge label={`${avg}%`} status={avg >= 100 ? "success" : "info"} />}
        actions={
          <Link
            href="/founder/learning"
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Dashboard
          </Link>
        }
      />

      {programLocked ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span aria-hidden className="text-base">
            🔒
          </span>
          <p>
            Complete <strong>{previousStageLabel(program.stage)}</strong> to unlock this program (80% stage
            completion required).
          </p>
        </div>
      ) : null}

      <WorkflowProgressRail
        steps={modulesInProgram.map((module) => {
          const pct = moduleLessonCompletionPercent(module.slug, lessonProgress);
          return {
            key: module.slug,
            label: module.title.split(" ").slice(0, 2).join(" "),
            complete: pct >= 100,
            current: pct > 0 && pct < 100,
            detail: `${pct}%`,
          };
        })}
        compact
      />

      <WorkspacePanel title="Modules & lessons" subtitle="Structured institutional curriculum">
        <div className="space-y-6">
          {modulesInProgram.map((module) => {
            const content = getModuleContent(module.slug);
            const modulePct = moduleLessonCompletionPercent(module.slug, lessonProgress);
            const moduleLocked = programLocked || !isModuleStageUnlocked(module.readiness_stage, stageAccess);

            return (
              <div
                key={module.id}
                className={`rounded-lg border p-4 ${moduleLocked ? "border-slate-200 bg-slate-50 opacity-80" : "border-slate-200"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {module.category}
                    </p>
                    <h3 className="mt-1 font-semibold text-slate-900">{module.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">{module.description}</p>
                  </div>
                  <StatusBadge label={`${modulePct}%`} status={modulePct >= 100 ? "success" : "neutral"} />
                </div>
                <ul className="mt-4 space-y-2">
                  {(content?.lessons ?? []).map((lesson) => {
                    const done = lessonProgress.some(
                      (row) =>
                        row.module_slug === module.slug &&
                        row.lesson_id === lesson.id &&
                        row.status === "completed",
                    );
                    return (
                      <li key={lesson.id}>
                        {moduleLocked ? (
                          <div className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 text-sm text-slate-500">
                            <span className="flex items-center gap-2">
                              <span aria-hidden>🔒</span>
                              {lesson.title}
                            </span>
                            <span className="text-xs">Locked</span>
                          </div>
                        ) : (
                          <Link
                            href={lessonHref(program.slug, module.slug, lesson.id)}
                            className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
                          >
                            <span className={done ? "text-slate-500 line-through" : "text-slate-900"}>
                              {lesson.title}
                            </span>
                            <span className="text-xs text-slate-500">{done ? "Done" : "Start"}</span>
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <Link
                  href={`/founder/learning/${module.slug}`}
                  className="mt-3 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Legacy module view
                </Link>
              </div>
            );
          })}
        </div>
      </WorkspacePanel>

      <p className="text-xs text-slate-500">
        Program path: {programHref(program.slug)} — contributes to CapitalOS readiness tier and investor preparation
        status.
      </p>
    </div>
  );
}
