"use client";
import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// FounderFundraisingMilestoneTracker
// Derives the founder's current raise stage from existing dashboard data.
// Zero additional DB queries.
// ---------------------------------------------------------------------------

type Stage = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  actions: string[];
};

const STAGES: Stage[] = [
  {
    id: "prep",
    label: "Preparation",
    shortLabel: "Prep",
    description: "Build your investor-ready profile: upload key documents and reach 65+ readiness.",
    actions: [
      "Upload your pitch deck and financial model",
      "Complete company profile (description, stage, raise amount)",
      "Reach 65+ readiness score to unlock institutional conversations",
    ],
  },
  {
    id: "ready",
    label: "Ready to Raise",
    shortLabel: "Ready",
    description: "Your profile is investor-ready. Publish your listing and start identifying matches.",
    actions: [
      "Publish your company listing on the platform",
      "Review your investor matches and shortlist strong fits",
      "Craft personalised outreach using the Outreach Kit",
    ],
  },
  {
    id: "outreach",
    label: "Active Outreach",
    shortLabel: "Outreach",
    description: "Reaching out to matched investors and building your pipeline.",
    actions: [
      "Send personalised intros to your top 5–10 matches",
      "Follow up within 3 days of no response",
      "Track outreach in your investor pipeline",
    ],
  },
  {
    id: "diligence",
    label: "Diligence",
    shortLabel: "Diligence",
    description: "Investors are actively reviewing your materials in deal rooms.",
    actions: [
      "Respond to investor questions within 24 hours",
      "Fulfil document requests promptly — speed signals seriousness",
      "Keep multiple rooms active to maintain leverage",
    ],
  },
  {
    id: "closing",
    label: "Closing",
    shortLabel: "Closing",
    description: "Commitments are coming in. Focus on converting interest to signed terms.",
    actions: [
      "Follow up with verbal commitments to confirm in writing",
      "Engage legal counsel to prepare term sheet / SAFE / note",
      "Set a close deadline to create urgency",
    ],
  },
  {
    id: "closed",
    label: "Closed",
    shortLabel: "Closed",
    description: "Raise complete. Deliver on your commitments and plan the next milestone.",
    actions: [
      "Send a formal close update to all investors",
      "Set up investor reporting cadence (monthly or quarterly)",
      "Begin planning your next round",
    ],
  },
];

function deriveStageIndex(opts: {
  readinessScore: number;
  activeRoomCount: number;
  pledgedAmount: number;
  fundingTarget: number | null;
  isPublished: boolean;
  strongMatchCount: number;
}): number {
  const { readinessScore, activeRoomCount, pledgedAmount, fundingTarget, isPublished, strongMatchCount } = opts;

  // Stage 5: Closed — pledged ≥ 90% of target
  if (fundingTarget && fundingTarget > 0 && pledgedAmount >= fundingTarget * 0.9) return 5;

  // Stage 4: Closing — pledged ≥ 30% of target OR significant pledge with no target
  if (fundingTarget && fundingTarget > 0 && pledgedAmount >= fundingTarget * 0.3) return 4;
  if (!fundingTarget && pledgedAmount > 0) return 4;

  // Stage 3: Diligence — at least one active deal room
  if (activeRoomCount > 0) return 3;

  // Stage 2: Outreach — published or has investor matches and score ≥ 65
  if ((isPublished || strongMatchCount > 0) && readinessScore >= 65) return 2;

  // Stage 1: Ready — readiness ≥ 65 but not yet in outreach
  if (readinessScore >= 65) return 1;

  // Stage 0: Prep
  return 0;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StageNode({
  stage,
  index,
  currentIndex,
  total,
}: {
  stage: Stage;
  index: number;
  currentIndex: number;
  total: number;
}) {
  const isDone    = index < currentIndex;
  const isCurrent = index === currentIndex;
  const isFuture  = index > currentIndex;

  const nodeColor = isDone
    ? "#2E78F5"
    : isCurrent
    ? "#2E78F5"
    : "#e2e8f0";

  const labelColor = isFuture ? "text-slate-400" : "text-slate-800";

  return (
    <div className="flex flex-col items-center" style={{ flex: 1, minWidth: 0 }}>
      {/* Connector + node row */}
      <div className="flex w-full items-center">
        {/* Left connector */}
        <div
          className="h-0.5 flex-1"
          style={{
            background: index === 0 ? "transparent" : isDone || isCurrent ? "#2E78F5" : "#e2e8f0",
          }}
        />

        {/* Node */}
        <div
          className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all"
          style={{
            background: nodeColor,
            boxShadow: isCurrent ? "0 0 0 3px #EEEDFE" : "none",
          }}
        >
          {isDone ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <span
              className="text-[9px] font-bold"
              style={{ color: isFuture ? "#94a3b8" : "white" }}
            >
              {index + 1}
            </span>
          )}

          {/* Current pulse ring */}
          {isCurrent ? (
            <span
              className="absolute inset-0 rounded-full"
              style={{
                animation: "ping 2s cubic-bezier(0,0,0.2,1) infinite",
                background: "#2E78F5",
                opacity: 0.2,
              }}
            />
          ) : null}
        </div>

        {/* Right connector */}
        <div
          className="h-0.5 flex-1"
          style={{
            background: index === total - 1 ? "transparent" : isDone ? "#2E78F5" : "#e2e8f0",
          }}
        />
      </div>

      {/* Label */}
      <p
        className={`mt-1.5 truncate text-center text-[10px] font-semibold ${labelColor}`}
        style={isCurrent ? { color: "#2E78F5" } : undefined}
      >
        {stage.shortLabel}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Props = Readonly<{
  readinessScore: number;
  activeRoomCount: number;
  pledgedAmount: number;
  fundingTarget: number | null;
  isPublished: boolean;
  strongMatchCount: number;
}>;

export function FounderFundraisingMilestoneTracker({
  readinessScore,
  activeRoomCount,
  pledgedAmount,
  fundingTarget,
  isPublished,
  strongMatchCount,
}: Props) {
  const t = useTranslations("founderCmp");
  const currentIndex = deriveStageIndex({
    readinessScore,
    activeRoomCount,
    pledgedAmount,
    fundingTarget,
    isPublished,
    strongMatchCount,
  });

  const current = STAGES[currentIndex]!;
  const next    = STAGES[currentIndex + 1] ?? null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Accent bar */}
      <div style={{ height: 3, background: "linear-gradient(90deg,#2E78F5,#7c3aed,#06b6d4)" }} />

      <div className="p-5">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "#EEEDFE" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 17l4-8 4 4 4-6 4 10" stroke="#2E78F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{t("fundraising_timeline")}</p>
              <p className="text-[11px] text-slate-400">Stage {currentIndex + 1} of {STAGES.length}</p>
            </div>
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-bold"
            style={{ background: "#EEEDFE", color: "#2E78F5" }}
          >
            {current.label}
          </span>
        </div>

        {/* Progress nodes */}
        <div className="mb-5 flex items-start">
          {STAGES.map((s, i) => (
            <StageNode
              key={s.id}
              stage={s}
              index={i}
              currentIndex={currentIndex}
              total={STAGES.length}
            />
          ))}
        </div>

        {/* Current stage detail */}
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: "#c7d2fe", background: "#fafaff" }}
        >
          <div className="mb-2 flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]"
              style={{ background: "#2E78F5", color: "white" }}
            >
              Now
            </span>
            <p className="text-xs font-semibold text-slate-800">{current.label}</p>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-slate-600">{current.description}</p>

          <div className="space-y-1.5">
            {current.actions.map((action, i) => (
              <div key={i} className="flex items-start gap-2">
                <div
                  className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                  style={{ background: "#2E78F5" }}
                >
                  {i + 1}
                </div>
                <p className="text-xs leading-relaxed text-slate-700">{action}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Next stage preview */}
        {next ? (
          <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0" aria-hidden="true">
              <path d="M9 18l6-6-6-6" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">Next: {next.label} —</span>{" "}
              {next.description}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
