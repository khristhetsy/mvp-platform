import Link from "next/link";
import { ONBOARDING_STEPS } from "@/lib/onboarding/progress";
import type { FounderOnboardingProgress } from "@/lib/onboarding/progress";

export function FounderOnboardingProgressCard({
  progress,
}: Readonly<{
  progress: FounderOnboardingProgress;
}>) {
  if (progress.isComplete) {
    return null;
  }

  const incompleteSteps = ONBOARDING_STEPS.filter((step) => !progress.steps[step.id].completed);

  return (
    <section className="mb-8 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">Onboarding in progress</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">Complete your profile to unlock stronger investor visibility</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {incompleteSteps.length > 0
              ? `Next up: ${incompleteSteps[0].title}. Your trial includes full Professional access while you build readiness.`
              : "Finish the final onboarding checks to maximize your trial."}
          </p>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs font-medium text-indigo-900">
              <span>Progress</span>
              <span>{progress.percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        </div>
        <Link
          href="/founder/onboarding"
          className="inline-flex shrink-0 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Continue onboarding
        </Link>
      </div>
    </section>
  );
}
