import Link from "next/link";
import { QuizReviewBanner } from "@/components/founder/learning/QuizReviewBanner";
import { FounderLearningMilestones } from "@/components/FounderLearningMilestones";
import { FounderLearningModuleCard } from "@/components/FounderLearningModuleCard";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { MetricRow } from "@/components/ui/OperationalMetric";
import { OperationalMetric } from "@/components/ui/OperationalMetric";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WorkflowProgressRail } from "@/components/ui/WorkflowProgressRail";
import { programHref } from "@/lib/learning/lesson-keys";
import { isModuleStageUnlocked, previousStageLabel } from "@/lib/learning/stage-access";
import type { loadFounderLearningWorkspace } from "@/lib/learning/load-founder-learning";

type LearningData = Awaited<ReturnType<typeof loadFounderLearningWorkspace>>;

export function FounderLearningDashboard({
  learning,
}: Readonly<{ learning: LearningData }>) {
  const recommendedBySlug = new Map(
    learning.recommendations.map((item) => [item.slug, item.reason]),
  );

  const programProgress = learning.programs.map((program) => {
    const modulesInProgram = learning.modules.filter((m) => program.moduleSlugs.includes(m.slug));
    const avg =
      modulesInProgram.length > 0
        ? Math.round(
            modulesInProgram.reduce((sum, m) => sum + (m.progress?.percent_complete ?? 0), 0) /
              modulesInProgram.length,
          )
        : 0;
    return { program, percent: avg, moduleCount: modulesInProgram.length };
  });

  return (
    <div className="space-y-6">
      <QuizReviewBanner />
      <PageHeader
        eyebrow="Institutional readiness intelligence"
        title="Learning command center"
        description="Structured programs, lessons, and readiness milestones tied to your diligence and remediation data — not a generic course marketplace."
        metadata={`iCapOS readiness tier · ${learning.completedLessonsCount} lessons completed`}
        queueIndicator={
          <StatusBadge label={learning.readinessTier.label} status="info" dot />
        }
      />

      <MetricRow title="Readiness intelligence" subtitle="Platform readiness progress only">
        <OperationalMetric
          label="Curriculum progress"
          value={`${learning.overallPercent}%`}
          detail="Across published modules"
          accent="slate"
        />
        <OperationalMetric
          label="Lessons completed"
          value={String(learning.completedLessonsCount)}
          detail="Lesson-level tracking"
          accent="indigo"
        />
        <OperationalMetric
          label="iCapOS tier"
          value={`T${learning.readinessTier.tier}`}
          detail={learning.readinessTier.label}
          accent="blue"
        />
        <OperationalMetric
          label="Current milestone"
          value={learning.currentMilestone?.label?.split(" ")[0] ?? "—"}
          detail={learning.currentMilestone?.label ?? "Build foundation milestones"}
          accent="violet"
        />
      </MetricRow>

      {learning.nextLesson ? (
        <section className="rounded-lg border border-slate-200 bg-slate-900 p-5 text-white shadow-[var(--shadow-panel)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            Recommended next lesson
          </p>
          <h2 className="mt-2 text-lg font-semibold">{learning.nextLesson.lessonTitle}</h2>
          <p className="mt-2 text-sm text-slate-300">{learning.nextLesson.reason}</p>
          <p className="mt-2 text-xs text-slate-400">
            Readiness impact: contributes to investor preparation status on the platform.
          </p>
          <Link
            href={learning.nextLesson.href}
            className="mt-4 inline-flex rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
          >
            Start lesson
          </Link>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title="Learning programs" subtitle="Structured institutional curriculum">
          <div className="space-y-3">
            {programProgress.map(({ program, percent, moduleCount }) => {
              const locked = !learning.stageAccess[program.stage];
              const inner = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">
                        {locked ? <span className="mr-1.5" aria-hidden>🔒</span> : null}
                        {program.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{program.description}</p>
                    </div>
                    <StatusBadge
                      label={locked ? "Locked" : `${percent}%`}
                      status={locked ? "warning" : percent >= 100 ? "success" : "neutral"}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {locked
                      ? `Complete ${previousStageLabel(program.stage)} to unlock (80% required)`
                      : `${moduleCount} modules · ${program.readinessFocus}`}
                  </p>
                </>
              );

              return locked ? (
                <div key={program.slug} className="rounded-lg border border-slate-200 bg-slate-50 p-4 opacity-90">
                  {inner}
                </div>
              ) : (
                <Link
                  key={program.slug}
                  href={programHref(program.slug)}
                  className="block rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        </WorkspacePanel>

        <WorkspacePanel title="Detected gaps" subtitle="From documents, onboarding, and diligence">
          {learning.weaknesses.length === 0 ? (
            <p className="text-sm text-slate-600">No major gaps detected. Continue advanced programs.</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-700">
              {learning.weaknesses.map((item) => (
                <li key={item} className="rounded-md bg-amber-50 px-3 py-2 text-amber-950 ring-1 ring-amber-100">
                  {item}
                </li>
              ))}
            </ul>
          )}
          {learning.pendingActions.length > 0 ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending actions</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {learning.pendingActions.map((action) => (
                  <li key={action}>• {action}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </WorkspacePanel>
      </section>

      <WorkspacePanel title="Program roadmap" subtitle="High-level progression">
        <WorkflowProgressRail
          steps={programProgress.map(({ program, percent }) => ({
            key: program.slug,
            label: program.title.split(" ")[0],
            complete: percent >= 100,
            current: percent > 0 && percent < 100,
            detail: `${percent}%`,
          }))}
          compact
        />
      </WorkspacePanel>

      <section className="grid gap-6 xl:grid-cols-2">
        <WorkspacePanel title="Personalized lessons" subtitle="Rule-based recommendations">
          {learning.lessonRecommendations.length === 0 ? (
            <p className="text-sm text-slate-600">Complete onboarding to unlock lesson recommendations.</p>
          ) : (
            <ul className="space-y-2">
              {learning.lessonRecommendations.slice(0, 5).map((lesson) => (
                <li key={lesson.href}>
                  <Link href={lesson.href} className="block rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900">{lesson.lessonTitle}</span>
                      <StatusBadge
                        label={lesson.priority}
                        status={lesson.priority === "high" ? "warning" : "neutral"}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{lesson.reason}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Continue learning" subtitle="In-progress modules">
          {learning.continueModules.length === 0 ? (
            <p className="text-sm text-slate-600">No modules in progress.</p>
          ) : (
            <div className="grid gap-3">
              {learning.continueModules.slice(0, 3).map((module) => (
                <FounderLearningModuleCard key={module.id} module={module} />
              ))}
            </div>
          )}
        </WorkspacePanel>
      </section>

      <WorkspacePanel
        title="Readiness milestones"
        subtitle="Platform milestones — not legal or investment certification"
      >
        <FounderLearningMilestones
          milestones={learning.milestones}
          currentLabel={learning.currentMilestone?.label ?? null}
          nextLabel={
            learning.nextMilestone
              ? `Next milestone: ${learning.nextMilestone.label}`
              : null
          }
        />
      </WorkspacePanel>

      {learning.aiCoachRecommendations.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600">Recommended for you</p>
          <h2 className="mt-1 text-sm font-semibold text-slate-950">AI coach picks from your readiness gaps</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {learning.aiCoachRecommendations.map((recommendation) => (
              <Link
                key={recommendation.moduleId}
                href={`/founder/learning/${recommendation.slug}`}
                className="rounded-xl border border-slate-200 p-4 transition hover:border-indigo-200 hover:bg-indigo-50/40"
              >
                <h3 className="text-sm font-semibold text-slate-950">{recommendation.title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-600">{recommendation.reason}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <WorkspacePanel title="All modules" subtitle="Full curriculum by stage">
        <div className="grid gap-4 md:grid-cols-2">
          {learning.modules.map((module) => {
            const locked = !isModuleStageUnlocked(module.readiness_stage, learning.stageAccess);
            return (
              <FounderLearningModuleCard
                key={module.id}
                module={module}
                highlight={recommendedBySlug.get(module.slug)}
                locked={locked}
                lockMessage={`Complete ${previousStageLabel(module.readiness_stage)} to unlock`}
              />
            );
          })}
        </div>
      </WorkspacePanel>
    </div>
  );
}
