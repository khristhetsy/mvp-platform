import Link from "next/link";
import { JOURNEY_STAGES } from "@/lib/founder-journey/types";
import type { FounderJourneyState, JourneyStage } from "@/lib/founder-journey/types";

const STAGE_NAMES: Record<JourneyStage, string> = {
  initialize: "Initialize",
  qualify: "Qualify",
  deploy: "Deploy",
  optimize: "Optimize",
};

type Requirement = { label: string; met: boolean; href?: string };

function requirementsToAdvance(state: FounderJourneyState): Requirement[] {
  const c = state.conditions;
  switch (state.stage) {
    case "initialize":
      return [{ label: "Complete onboarding", met: c.onboardingComplete, href: "/founder/onboarding" }];
    case "qualify":
      return [
        { label: "Onboarding complete", met: c.onboardingComplete, href: "/founder/onboarding" },
        { label: "Core documents uploaded (pitch deck, financials, cap table)", met: c.requiredDocsUploaded, href: "/founder/readiness/data-room" },
        { label: "Readiness score ≥ 75", met: c.readinessQualified, href: "/founder/readiness" },
      ];
    case "deploy":
      return [{ label: "Open a deal room or receive investor interest", met: c.hasDealRoom || c.hasInvestorInterest, href: "/founder/deal-room" }];
    default:
      return [];
  }
}

export function StageProgressCard({ state }: { state: FounderJourneyState }) {
  const nextStage: JourneyStage | null = JOURNEY_STAGES[state.stageIndex + 1] ?? null;
  const reqs = requirementsToAdvance(state);
  const metCount = reqs.filter((r) => r.met).length;
  const allMet = reqs.length > 0 && metCount === reqs.length;
  const firstUnmet = reqs.find((r) => !r.met);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">Your journey</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            Stage {state.stageIndex + 1} of 4 — {STAGE_NAMES[state.stage]}
          </h2>
        </div>
        <Link href="/founder/journey" className="text-sm font-medium text-indigo-700 hover:underline">
          View full journey →
        </Link>
      </div>

      {/* Stage progress dots */}
      <div className="mt-4 flex items-center gap-1.5">
        {JOURNEY_STAGES.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-1.5">
            <div
              className={`h-1.5 flex-1 rounded-full ${i <= state.stageIndex ? "bg-[var(--indigo)]" : "bg-slate-200"}`}
              title={STAGE_NAMES[s]}
            />
          </div>
        ))}
      </div>

      {/* What unlocks the next stage */}
      {nextStage ? (
        <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-800">To reach Stage {state.stageIndex + 2} — {STAGE_NAMES[nextStage]}</p>
            <span className="text-xs text-slate-500">{metCount}/{reqs.length} done</span>
          </div>
          <ul className="mt-3 space-y-2">
            {reqs.map((r) => (
              <li key={r.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`inline-flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] ${r.met ? "bg-emerald-500 text-white" : "border border-slate-300 text-transparent"}`}>✓</span>
                  <span className={`truncate ${r.met ? "text-slate-700" : "text-slate-500"}`}>{r.label}</span>
                </span>
                {!r.met && r.href ? (
                  <Link href={r.href} className="flex-none rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50">
                    Fix
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>

          {/* Advancement CTA / status */}
          {state.stage === "qualify" ? (
            state.pendingApproval ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Review requested — our team is reviewing your readiness.
              </div>
            ) : allMet ? (
              <Link href="/founder/journey" className="mt-3 inline-flex items-center rounded-lg bg-[var(--indigo)] px-4 py-2 text-sm font-semibold text-white">
                You&apos;re ready — request review →
              </Link>
            ) : firstUnmet?.href ? (
              <Link href={firstUnmet.href} className="mt-3 inline-flex items-center rounded-lg bg-[var(--indigo)] px-4 py-2 text-sm font-semibold text-white">
                Continue: {firstUnmet.label.split(" (")[0]} →
              </Link>
            ) : null
          ) : !allMet && firstUnmet?.href ? (
            <Link href={firstUnmet.href} className="mt-3 inline-flex items-center rounded-lg bg-[var(--indigo)] px-4 py-2 text-sm font-semibold text-white">
              Continue →
            </Link>
          ) : null}

          {state.approvalStatus === "rejected" && state.approvalFeedback ? (
            <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              Reviewer feedback: {state.approvalFeedback}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
          You&apos;ve reached the final stage — every tool is unlocked. Keep your momentum with investor updates and analytics.
        </div>
      )}
    </section>
  );
}
