"use client";

import type { FounderJourneyState, JourneyStage } from "@/lib/founder-journey/types";
import { JOURNEY_STAGES } from "@/lib/founder-journey/types";

// Same stage labels/blurbs as FounderJourneyPanel. Kept local so this compact
// stepper can be dropped at the top of each stage tab without pulling in the
// full journey panel (gates, reminders, etc. stay on the Overview tab).
const STAGE_META: Record<JourneyStage, { label: string; blurb: string }> = {
  initialize: { label: "Onboarding", blurb: "Company profile & onboarding" },
  qualify: { label: "Preparation", blurb: "Readiness, documents & stage approval" },
  deploy: { label: "Marketing", blurb: "Go-to-market & deal room" },
  optimize: { label: "Closing", blurb: "Investor engagement & close" },
};

function approvalBadge(status: FounderJourneyState["approvalStatus"]) {
  switch (status) {
    case "pending":
      return { label: "Approval pending", cls: "bg-amber-50 text-amber-700 ring-amber-200" };
    case "approved":
      return { label: "Stage approved", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
    case "rejected":
      return { label: "Changes requested", cls: "bg-red-50 text-red-700 ring-red-200" };
    default:
      return { label: "No approval requested", cls: "bg-slate-100 text-slate-600 ring-slate-200" };
  }
}

/**
 * Compact current-stage stepper (Onboarding → Preparation → Marketing → Closing)
 * shown at the top of each stage tab. Always reflects the company's real current
 * stage from `journey`, so the indicator reads consistently across tabs.
 */
export function StageStepper({ journey }: Readonly<{ journey: FounderJourneyState }>) {
  const { stage, stageIndex, approvalStatus } = journey;
  const badge = approvalBadge(approvalStatus);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]">
      {/* Stepper */}
      <div className="mb-4 flex items-center">
        {JOURNEY_STAGES.map((s, i) => {
          const done = i < stageIndex;
          const current = i === stageIndex;
          return (
            <div key={s} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center text-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    current
                      ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                      : done
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {done ? <i className="ti ti-check" aria-hidden="true" /> : i + 1}
                </div>
                <p className={`mt-1.5 text-[11px] font-semibold ${current ? "text-indigo-700" : done ? "text-slate-700" : "text-slate-400"}`}>
                  {STAGE_META[s].label}
                </p>
              </div>
              {i < JOURNEY_STAGES.length - 1 ? (
                <div className={`mx-1 h-0.5 flex-1 rounded ${i < stageIndex ? "bg-emerald-400" : "bg-slate-200"}`} />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Current stage summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Current stage</p>
          <p className="text-sm font-bold text-slate-900">{STAGE_META[stage].label}</p>
          <p className="text-[11px] text-slate-500">{STAGE_META[stage].blurb}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${badge.cls}`}>{badge.label}</span>
      </div>
    </div>
  );
}
