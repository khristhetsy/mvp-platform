import Link from "next/link";
import { useTranslations } from "next-intl";
import { ONBOARDING_STEPS } from "@/lib/onboarding/progress";
import type { FounderOnboardingProgress } from "@/lib/onboarding/progress";
import { DonutProgress } from "@/components/ui/charts/DonutProgress";
import { WorkflowProgressRail } from "@/components/ui/WorkflowProgressRail";

export function FounderOnboardingProgressCard({
  progress,
  inPage = false,
}: Readonly<{
  progress: FounderOnboardingProgress;
  /** When true (onboarding page): hides the CTA and shows a completion
   *  banner instead of returning null when isComplete. */
  inPage?: boolean;
}>) {
  const t = useTranslations("sharedCmp");
  if (progress.isComplete && !inPage) {
    return null;
  }

  if (progress.isComplete && inPage) {
    return (
      <section className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 7l4 4 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-900">{t("stage_1_complete_you_re_now_in_qualify")}</p>
          <p className="text-xs leading-5 text-emerald-700">
            Your company profile and funding are in. Next: build your data room and readiness from your dashboard to reach investors.
          </p>
        </div>
      </section>
    );
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
              <span>{t("progress")}</span>
              <span className="font-mono tabular-nums">{progress.percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[var(--blue)] transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
          <div className="mt-4">
            <WorkflowProgressRail steps={railSteps} compact />
          </div>
        </div>
        {!inPage && (
          <Link
            href="/founder/onboarding"
            className="cap-btn-primary inline-flex w-full shrink-0 justify-center rounded-lg px-5 py-2.5 text-sm font-semibold sm:w-auto"
          >
            Continue onboarding
          </Link>
        )}
      </div>
    </section>
  );
}
