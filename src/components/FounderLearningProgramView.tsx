import Link from "next/link";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WorkflowProgressRail } from "@/components/ui/WorkflowProgressRail";
import { getModuleContent } from "@/lib/learning/modules";
import { lessonHref, programHref } from "@/lib/learning/lesson-keys";
import { moduleLessonCompletionPercent } from "@/lib/learning/lesson-progress";
import type { LearningProgramDefinition } from "@/lib/learning/catalog";
import type { FounderLearningModuleView } from "@/lib/learning/load-founder-learning";
import type { FounderLessonProgressRecord } from "@/lib/learning/types";

export function FounderLearningProgramView({
  program,
  modules,
  lessonProgress,
}: Readonly<{
  program: LearningProgramDefinition;
  modules: FounderLearningModuleView[];
  lessonProgress: FounderLessonProgressRecord[];
}>) {
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

            return (
              <div key={module.id} className="rounded-lg border border-slate-200 p-4">
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
                        <Link
                          href={lessonHref(program.slug, module.slug, lesson.id)}
                          className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
                        >
                          <span className={done ? "text-slate-500 line-through" : "text-slate-900"}>
                            {lesson.title}
                          </span>
                          <span className="text-xs text-slate-500">{done ? "Done" : "Start"}</span>
                        </Link>
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
