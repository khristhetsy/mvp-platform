"use client";

import type { FounderJourneyState } from "@/lib/founder-journey/types";
import { JOURNEY_STAGES } from "@/lib/founder-journey/types";

const STAGE_LABELS: Record<string, string> = {
  initialize: "Initialize",
  qualify: "Qualify",
  deploy: "Deploy",
  optimize: "Optimize",
};

function StageDots({ currentIndex }: { currentIndex: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {JOURNEY_STAGES.map((s, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <span
            key={s}
            className={[
              "h-2.5 rounded-full transition-all",
              isDone
                ? "w-2.5 bg-emerald-400"
                : isCurrent
                  ? "w-6 bg-indigo-500"
                  : "w-2.5 bg-slate-200",
            ].join(" ")}
          />
        );
      })}
    </div>
  );
}

function getCTA(
  state: FounderJourneyState,
  onboardingPercent: number,
): {
  text: string;
  isButton: boolean;
  disabled?: boolean;
  note?: string;
} {
  const { stage, conditions, pendingApproval, canRequestApproval } = state;

  if (stage === "initialize") {
    if (conditions.onboardingComplete) {
      return {
        text: "Request Qualify review →",
        isButton: true,
        note: "Coming in next section",
      };
    }
    return {
      text: `Complete your profile (${onboardingPercent}% done)`,
      isButton: false,
    };
  }

  if (stage === "qualify") {
    if (pendingApproval) {
      return { text: "Review pending — check back soon", isButton: false };
    }
    if (canRequestApproval) {
      return { text: "Ready for review — request approval", isButton: true };
    }
    return { text: "Complete requirements to advance", isButton: false };
  }

  // deploy or optimize
  const stageIndex = JOURNEY_STAGES.indexOf(stage);
  const stageLabel = STAGE_LABELS[stage] ?? stage;
  return {
    text: `Stage ${stageIndex + 1} — ${stageLabel} · Active`,
    isButton: false,
  };
}

export function FounderStageBanner({
  state,
  onboardingPercent,
}: {
  state: FounderJourneyState;
  onboardingPercent?: number;
}) {
  const stageIndex = state.stageIndex;
  const stageLabel = STAGE_LABELS[state.stage] ?? state.stage;
  const cta = getCTA(state, onboardingPercent ?? 0);

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-white px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: stage pill */}
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white">
              {stageIndex + 1}
            </span>
            {stageLabel}
          </span>
        </div>

        {/* Center: step indicators */}
        <StageDots currentIndex={stageIndex} />

        {/* Right: CTA */}
        <div className="text-sm">
          {cta.isButton ? (
            <div className="flex flex-col items-start gap-0.5 sm:items-end">
              <button
                type="button"
                className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
                disabled={Boolean(cta.disabled)}
                aria-disabled={Boolean(cta.disabled)}
              >
                {cta.text}
              </button>
              {cta.note ? (
                <span className="text-[10px] text-slate-400">{cta.note}</span>
              ) : null}
            </div>
          ) : (
            <span className="text-slate-500">{cta.text}</span>
          )}
        </div>
      </div>
    </div>
  );
}
