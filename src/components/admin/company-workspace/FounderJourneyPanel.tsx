import type { FounderJourneyState, JourneyStage } from "@/lib/founder-journey/types";
import { JOURNEY_STAGES } from "@/lib/founder-journey/types";

const STAGE_META: Record<JourneyStage, { label: string; blurb: string }> = {
  initialize: { label: "Initialize", blurb: "Company profile & onboarding" },
  qualify: { label: "Qualify", blurb: "Readiness, documents & stage approval" },
  deploy: { label: "Deploy", blurb: "Go-to-market & deal room" },
  optimize: { label: "Optimize", blurb: "Investor engagement & close" },
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

function Condition({ met, label, detail }: Readonly<{ met: boolean; label: string; detail?: string }>) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span
        className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] font-bold ${
          met ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
        }`}
        aria-hidden
      >
        {met ? "✓" : "✕"}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-800">{label}</p>
        {detail ? <p className="text-[11px] text-slate-500">{detail}</p> : null}
      </div>
    </div>
  );
}

export function FounderJourneyPanel({ journey }: Readonly<{ journey: FounderJourneyState }>) {
  const { stage, stageIndex, approvalStatus, approvalFeedback, conditions, pendingApproval } = journey;
  const badge = approvalBadge(approvalStatus);

  const readinessDetail =
    conditions.readinessScore != null
      ? `Score ${conditions.readinessScore} (needs ≥ 75)`
      : "No readiness score yet";

  const checks = [
    { met: conditions.onboardingComplete, label: "Onboarding complete", detail: "Company profile, funding info, pitch deck" },
    { met: conditions.readinessQualified, label: "Readiness qualified", detail: readinessDetail },
    { met: conditions.requiredDocsUploaded, label: "Required documents uploaded", detail: "Qualify-stage document set" },
    { met: conditions.hasDealRoom, label: "Deal room created", detail: "Needed for Deploy" },
    { met: conditions.hasInvestorInterest, label: "Investor interest logged", detail: "Signal for Optimize" },
  ];

  const pending = checks.filter((c) => !c.met);

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
                  {done ? "✓" : i + 1}
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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Current stage</p>
          <p className="text-sm font-bold text-slate-900">{STAGE_META[stage].label}</p>
          <p className="text-[11px] text-slate-500">{STAGE_META[stage].blurb}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${badge.cls}`}>{badge.label}</span>
      </div>

      {pendingApproval ? (
        <div className="mb-3 rounded-lg border-l-[3px] border-amber-400 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-900">
          <b>Action needed:</b> the founder has requested approval to advance from <b>{STAGE_META[stage].label}</b>. Review and approve/reject in the stage-approval queue.
        </div>
      ) : null}

      {approvalStatus === "rejected" && approvalFeedback ? (
        <div className="mb-3 rounded-lg border-l-[3px] border-red-400 bg-red-50 px-3 py-2 text-[11.5px] text-red-900">
          <b>Feedback to founder:</b> {approvalFeedback}
        </div>
      ) : null}

      {/* Gates */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Stage gates</p>
          {checks.map((c) => (
            <Condition key={c.label} met={c.met} label={c.label} detail={c.detail} />
          ))}
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            What&apos;s pending {pending.length > 0 ? `(${pending.length})` : ""}
          </p>
          {pending.length === 0 ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-800">
              All tracked gates are met. {pendingApproval ? "Awaiting your stage approval." : "Ready to progress."}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {pending.map((c) => (
                <li key={c.label} className="flex items-start gap-2 text-[11.5px] text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-red-400" />
                  <span>
                    <b>{c.label}</b>
                    {c.detail ? <span className="text-slate-500"> — {c.detail}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
