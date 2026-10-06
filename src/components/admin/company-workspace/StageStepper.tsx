"use client";

import type { FounderJourneyState, JourneyStage } from "@/lib/founder-journey/types";
import { OdooStageBar } from "@/components/ui/OdooStageBar";
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
 * Compact stage stepper (Onboarding → Preparation → Marketing → Closing) shown at
 * the top of each stage tab. The indigo highlight follows `viewedStage` (the tab
 * you're on); an amber "Company here" marker still shows the company's real current
 * stage from `journey`, so both are visible when they differ.
 */
export function StageStepper({ journey, viewedStage }: Readonly<{ journey: FounderJourneyState; viewedStage: JourneyStage }>) {
  const { stage, stageIndex, approvalStatus } = journey;
  const badge = approvalBadge(approvalStatus);
  const viewedIdx = JOURNEY_STAGES.indexOf(viewedStage);
  const differs = viewedStage !== stage;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]">
      {/* Stepper: blue = the company's real stage; eye = the tab you're viewing */}
      <OdooStageBar
        className="mb-4"
        ariaLabel="Founder journey"
        steps={JOURNEY_STAGES.map((s, i) => ({
          key: s,
          label: STAGE_META[s].label,
          icon: i === viewedIdx ? "ti-eye" : i < stageIndex ? "ti-check" : undefined,
          title: i === viewedIdx ? "Viewing" : i === stageIndex ? "Company here" : undefined,
        }))}
        current={JOURNEY_STAGES[stageIndex] ?? null}
      />

      {/* Summary — what you're viewing + the company's real stage when different */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Viewing</p>
          <p className="text-sm font-bold text-slate-900">{STAGE_META[viewedStage].label}</p>
          <p className="text-[11px] text-slate-500">
            {STAGE_META[viewedStage].blurb}
            {differs ? <> · <span className="font-semibold text-amber-700">Company&rsquo;s current stage: {STAGE_META[stage].label}</span></> : null}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${badge.cls}`}>{badge.label}</span>
      </div>
    </div>
  );
}
