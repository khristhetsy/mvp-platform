import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ONBOARDING_STEPS,
  type FounderOnboardingProgress,
  type OnboardingStepId,
  type OnboardingStepMeta,
} from "@/lib/onboarding/progress";
import { StatusBadge } from "@/components/ui/StatusBadge";

const PACIFIC = "America/Los_Angeles";

type Translate = ReturnType<typeof useTranslations<"sharedCmp">>;

/** Translation keys for each visible step, looked up by step id. The step
 *  definitions themselves (order, href, required) stay in progress.ts; a step
 *  without keys here falls back to the English copy defined there. */
const STEP_COPY_KEYS: Partial<Record<OnboardingStepId, { title: string; description: string }>> = {
  company_profile: {
    title: "onboarding_step_company_profile_title",
    description: "onboarding_step_company_profile_description",
  },
  funding_information: {
    title: "onboarding_step_funding_information_title",
    description: "onboarding_step_funding_information_description",
  },
  documents_uploaded: {
    title: "onboarding_step_documents_uploaded_title",
    description: "onboarding_step_documents_uploaded_description",
  },
  readiness_generated: {
    title: "onboarding_step_readiness_generated_title",
    description: "onboarding_step_readiness_generated_description",
  },
};

function stepTitle(t: Translate, step: OnboardingStepMeta) {
  const key = STEP_COPY_KEYS[step.id]?.title;
  return key ? t(key) : step.title;
}

function stepDescription(t: Translate, step: OnboardingStepMeta) {
  const key = STEP_COPY_KEYS[step.id]?.description;
  return key ? t(key) : step.description;
}

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
  const t = useTranslations("sharedCmp");
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
          <p className={`text-sm font-medium ${completed ? "text-slate-500" : "text-slate-900"}`}>{stepTitle(t, step)}</p>
          {!step.required ? <StatusBadge label={t("onboarding_card_optional")} status="neutral" /> : null}
          {completed && done ? (
            <span className="text-xs text-slate-400">{t("onboarding_card_done_on", { date: done })}</span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{stepDescription(t, step)}</p>
      </div>
      {!completed && !locked ? (
        <Link
          href={step.href}
          className="shrink-0 text-xs font-semibold text-[var(--blue)] hover:text-[var(--blue-hover)]"
        >
          {current ? t("onboarding_card_continue") : t("onboarding_card_start")}
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
      <p className="text-xs font-semibold text-slate-500">{heading}</p>
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
  const t = useTranslations("sharedCmp");

  if (progress.isComplete && !inPage) {
    return null;
  }

  const required = ONBOARDING_STEPS.filter((step) => step.required);
  const recommended = ONBOARDING_STEPS.filter((step) => !step.required);
  const openRequired = required.filter((step) => !progress.steps[step.id].completed);
  const counter = t("onboarding_card_counter", {
    done: progress.requiredCompleted,
    total: progress.requiredTotal,
  });

  return (
    <section className="mb-5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">{t("onboarding_card_eyebrow")}</p>
          <h2 className="mt-1 text-base font-semibold text-slate-950">
            {progress.isComplete ? t("onboarding_card_title_complete") : t("onboarding_card_title_open")}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {progress.isComplete
              ? t("onboarding_card_complete_hint")
              : openRequired.length > 0
                ? t("onboarding_card_next", { step: stepTitle(t, openRequired[0]) })
                : counter}
          </p>
        </div>
        {!inPage ? (
          <Link
            href="/founder/onboarding"
            className="cap-btn-primary inline-flex w-full shrink-0 justify-center rounded-lg px-5 py-2.5 text-sm font-semibold sm:w-auto"
          >
            {t("onboarding_card_continue_setup")}
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
          aria-label={t("onboarding_card_progress_aria")}
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${progress.isComplete ? "bg-emerald-500" : "bg-[var(--blue)]"}`}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <StepGroup heading={t("onboarding_card_group_required")} steps={required} progress={progress} />
        <StepGroup heading={t("onboarding_card_group_recommended")} steps={recommended} progress={progress} />
      </div>
    </section>
  );
}
