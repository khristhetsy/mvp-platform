import Link from "next/link";
import type { InvestorOnboardingProgress } from "@/lib/investor/profile";
import { DonutProgress } from "@/components/ui/charts/DonutProgress";
import { WorkflowProgressRail } from "@/components/ui/WorkflowProgressRail";

export function InvestorOnboardingProgressCard({
  progress,
  inPage = false,
}: Readonly<{
  progress: InvestorOnboardingProgress;
  /** When true (onboarding page): hides the CTA and shows a completion
   *  banner instead of returning null when approved. */
  inPage?: boolean;
}>) {
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
          <p className="text-sm font-semibold text-emerald-900">Account approved — welcome to the marketplace</p>
          <p className="text-xs leading-5 text-emerald-700">
            You have full access to deal flow, investor matches, and the data room.
          </p>
        </div>
      </section>
    );
  }

  const railSteps = [
    {
      key: "profile",
      label: "Investor profile",
      complete: progress.profileComplete,
      current: !progress.profileComplete,
    },
    {
      key: "submit",
      label: "Submit for review",
      complete: progress.submitted,
      current: (progress.profileComplete && !progress.submitted && !progress.needsResubmit) || progress.needsResubmit,
      status: progress.needsResubmit ? ("warning" as const) : undefined,
    },
    {
      key: "approval",
      label: "Admin approval",
      complete: progress.approved,
      current: progress.submitted && !progress.approved,
    },
  ];

  const headingText =
    progress.needsResubmit
      ? "Action required — update your profile and resubmit"
      : progress.submitted
        ? "Profile submitted — awaiting admin review"
        : "Complete your profile to access the deal marketplace";

  const bodyText =
    progress.needsResubmit
      ? "Admin has requested changes to your investor profile. Update and resubmit to continue."
      : progress.submitted
        ? "Your profile is in the admin review queue. You'll be notified once approved."
        : "Fill in your investor details, then submit for admin review to unlock full marketplace access.";

  return (
    <section className="mb-5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="hidden shrink-0 lg:block">
          <DonutProgress percent={progress.percent} size={52} strokeWidth={5} />
        </div>

        <div className="max-w-2xl flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            Investor account setup
          </p>
          <h2 className="mt-1 text-base font-semibold text-slate-950">{headingText}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{bodyText}</p>

          {progress.adminFeedback ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-amber-800">Admin feedback</p>
              <p className="mt-0.5 text-xs leading-5 text-amber-700">{progress.adminFeedback}</p>
            </div>
          ) : null}

          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs font-medium text-slate-700">
              <span>Progress</span>
              <span className="font-mono tabular-nums">{progress.percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progress.needsResubmit ? "bg-amber-500" : "bg-[var(--blue)]"
                }`}
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
            href="/investor/onboarding"
            className="cap-btn-primary inline-flex w-full shrink-0 justify-center rounded-lg px-5 py-2.5 text-sm font-semibold sm:w-auto"
          >
            {progress.needsResubmit ? "Update profile" : "Continue onboarding"}
          </Link>
        )}
      </div>
    </section>
  );
}
