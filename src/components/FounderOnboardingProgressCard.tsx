import Link from "next/link";
import { ONBOARDING_STEPS } from "@/lib/onboarding/progress";
import type { FounderOnboardingProgress } from "@/lib/onboarding/progress";
import { DonutProgress } from "@/components/ui/charts/DonutProgress";
import { WorkflowProgressRail } from "@/components/ui/WorkflowProgressRail";

export function FounderOnboardingProgressCard({
  progress,
}: Readonly<{
  progress: FounderOnboardingProgress;
}>) {
  if (progress.isComplete) {
    return null;
  }

  const incompleteSteps = ONBOARDING_STEPS.filter((step) => !progress.steps[step.id].completed);
  const railSteps = ONBOARDING_STEPS.map((step) => ({
    key: step.id,
    label: step.title,
    complete: progress.steps[step.id].completed,
    current: incompleteSteps[0]?.id === step.id,
  }));

  return (
    <section className="mb-5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="hidden shrink-0 lg:block">
          <DonutProgress percent={progress.percent} size={52} strokeWidth={5} />
        </div>
        <div className="max-w-2xl flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            Institutional readiness progression
          </p>
          <h2 className="mt-1 text-base font-semibold text-slate-950">
            Complete onboarding to strengthen investor visibility
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {incompleteSteps.length > 0
              ? `Next: ${incompleteSteps[0].title}. Trial includes Professional workspace access while you build readiness.`
              : "Finalize remaining checks to maximize marketplace readiness."}
          </p>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs font-medium text-slate-700">
              <span>Progress</span>
              <span className="font-mono tabular-nums">{progress.percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[var(--navy)] transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
          <div className="mt-4">
            <WorkflowProgressRail steps={railSteps} compact />
          </div>
        </div>
        <Link
          href="/founder/onboarding"
          className="cap-btn-primary inline-flex w-full shrink-0 justify-center rounded-lg px-5 py-2.5 text-sm font-semibold sm:w-auto"
        >
          Continue onboarding
        </Link>
      </div>
    </section>
  );
}
