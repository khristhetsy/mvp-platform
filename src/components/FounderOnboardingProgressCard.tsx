import Link from "next/link";
import {
  ONBOARDING_STEPS,
  type FounderOnboardingProgress,
  type OnboardingStepMeta,
} from "@/lib/onboarding/progress";
import { StatusBadge } from "@/components/ui/StatusBadge";

const PACIFIC = "America/Los_Angeles";

function formatDonePacific(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: PACIFIC })} PT`;
}

function StepRow({
  step,
  completed,
  completedAt,
  current,
  locked,
}: Readonly<{
  step: OnboardingStepMeta;
  completed: boolean;
  completedAt: string | null;
  current: boolean;
  /** Required steps of a completed company have no action to take. */
  locked: boolean;
}>) {
  const done = formatDonePacific(completedAt);
  return (
    <li className="flex items-start gap-3 py-2.5" aria-current={current ? "step" : undefined}>
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${
          completed ? "bg-emerald-500 ring-emerald-500" : current ? "bg-white ring-[var(--blue)]" : "bg-white ring-slate-300"
        }`}
        aria-hidden
      >
        {completed ? (
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
            <path d="M2 7l4 4 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`text-sm font-medium ${completed ? "text-slate-500" : "text-slate-900"}`}>{step.title}</p>
          {!step.required ? <StatusBadge label="Optional" status="neutral" /> : null}
          {completed && done ? <span className="text-xs text-slate-400">Done {done}</span> : null}
        </div>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{step.description}</p>
      </div>
      {!completed && !locked ? (
        <Link
          href={step.href}
          className="shrink-0 text-xs font-semibold text-[var(--blue)] hover:text-[var(--blue-hover)]"
        >
          {current ? "Continue" : "Start"}
        </Link>
      ) : null}
    </li>
  );
}

function StepGroup({
  heading,
  steps,
  progress,
}: Readonly<{
  heading: string;
  steps: OnboardingStepMeta[];
  progress: FounderOnboardingProgress;
}>) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{heading}</p>
      <ul className="mt-1 divide-y divide-slate-100" role="list">
        {steps.map((step) => (
          <StepRow
            key={step.id}
            step={step}
            completed={progress.steps[step.id].completed}
            completedAt={progress.steps[step.id].completedAt}
            current={progress.currentStep === step.id && !progress.steps[step.id].completed}
            locked={step.required && progress.isComplete}
          />
        ))}
      </ul>
    </div>
  );
}

export function FounderOnboardingProgressCard({
  progress,
  inPage = false,
}: Readonly<{
  progress: FounderOnboardingProgress;
  /** When true (onboarding page): hides the CTA and keeps the card when complete. */
  inPage?: boolean;
}>) {
  if (progress.isComplete && !inPage) {
    return null;
  }

  const required = ONBOARDING_STEPS.filter((step) => step.required);
  const recommended = ONBOARDING_STEPS.filter((step) => !step.required);
  const openRequired = required.filter((step) => !progress.steps[step.id].completed);
  const counter = `${progress.requiredCompleted} of ${progress.requiredTotal} required steps done`;

  return (
    <section className="mb-5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Company setup</p>
          <h2 className="mt-1 text-base font-semibold text-slate-950">
            {progress.isComplete ? "Your company is set up" : "Finish setting up your company"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {progress.isComplete
              ? "Your workspace is unlocked. The recommended steps below strengthen your readiness and investor visibility."
              : openRequired.length > 0
                ? `Next: ${openRequired[0].title.toLowerCase()}. Both required steps unlock your workspace.`
                : counter}
          </p>
        </div>
        {!inPage ? (
          <Link
            href="/founder/onboarding"
            className="cap-btn-primary inline-flex w-full shrink-0 justify-center rounded-lg px-5 py-2.5 text-sm font-semibold sm:w-auto"
          >
            Continue setup
          </Link>
        ) : null}
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs font-medium text-slate-700">
          <span>{counter}</span>
          <span className="font-mono tabular-nums">{progress.percent}%</span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
          aria-label="Required steps completed"
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${progress.isComplete ? "bg-emerald-500" : "bg-[var(--blue)]"}`}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <StepGroup heading="Required" steps={required} progress={progress} />
        <StepGroup heading="Recommended next" steps={recommended} progress={progress} />
      </div>
    </section>
  );
}
