"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WizardDoc = {
  label: string;
  code: string;
  uploaded: boolean;
};

export type WizardProfileItem = {
  label: string;
  field: string;
  complete: boolean;
  hint: string;
  href: string;
};

export type ReadinessWizardProps = {
  currentScore: number;
  targetScore: number;
  missingDocs: WizardDoc[];
  incompleteProfile: WizardProfileItem[];
  companyName: string;
};

// ---------------------------------------------------------------------------
// Score ring
// ---------------------------------------------------------------------------

function ScoreRing({ score, size = 64, strokeWidth = 6 }: { score: number; size?: number; strokeWidth?: number }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 80 ? "#16a34a" : score >= 65 ? "#d97706" : "#534AB7";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

type StepStatus = "done" | "current" | "upcoming";

type WizardStep = {
  id: string;
  title: string;
  pointValue: number;
  status: StepStatus;
  content: React.ReactNode;
};

function StepCard({
  step,
  onComplete,
}: {
  step: WizardStep;
  onComplete: () => void;
}) {
  const [expanded, setExpanded] = useState(step.status === "current");

  const borderColor =
    step.status === "done"
      ? "#bbf7d0"
      : step.status === "current"
      ? "#c7d2fe"
      : "#e2e8f0";

  const bg =
    step.status === "done"
      ? "#f0fdf4"
      : step.status === "current"
      ? "#fafaff"
      : "white";

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{ borderColor, background: bg }}
    >
      <button
        type="button"
        onClick={() => setExpanded((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
      >
        <div className="flex items-center gap-3">
          {/* Status node */}
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
            style={{
              background: step.status === "done" ? "#16a34a" : step.status === "current" ? "#534AB7" : "#e2e8f0",
            }}
          >
            {step.status === "done" ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <div
                className="h-2 w-2 rounded-full"
                style={{ background: step.status === "current" ? "white" : "#94a3b8" }}
              />
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">{step.title}</p>
            <p className="text-[10px]" style={{ color: step.status === "current" ? "#534AB7" : "#94a3b8" }}>
              {step.status === "done" ? "Complete" : `+${step.pointValue} pts toward 80`}
            </p>
          </div>
        </div>

        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"
          style={{ transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0)" }}
        >
          <path d="M6 9l6 6 6-6" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded ? (
        <div className="border-t px-4 pb-4 pt-3" style={{ borderColor }}>
          {step.content}
          {step.status === "current" ? (
            <button
              type="button"
              onClick={onComplete}
              className="mt-3 rounded-lg px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
              style={{ background: "#534AB7" }}
            >
              Mark as done →
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ReadinessWizard({
  currentScore,
  targetScore,
  missingDocs,
  incompleteProfile,
  companyName,
}: ReadinessWizardProps) {
  const t = useTranslations("founderCmp");
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  function markDone(id: string) {
    setCompletedIds((prev) => new Set([...prev, id]));
  }

  const isAtTarget = currentScore >= targetScore;

  // Build steps: profile items first (low effort, high impact), then documents
  const allSteps: Array<{ id: string; title: string; pts: number; content: React.ReactNode }> = [
    ...incompleteProfile.map((item) => ({
      id: `profile_${item.field}`,
      title: `Add ${item.label.toLowerCase()}`,
      pts: 4,
      content: (
        <div className="space-y-2">
          <p className="text-xs leading-relaxed text-slate-600">{item.hint}</p>
          <Link
            href={item.href}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white"
            style={{ background: "#534AB7" }}
          >
            Go to settings →
          </Link>
        </div>
      ),
    })),
    ...missingDocs.map((doc) => ({
      id: `doc_${doc.code}`,
      title: `Upload ${doc.label.toLowerCase()}`,
      pts: 6,
      content: (
        <div className="space-y-2">
          <p className="text-xs leading-relaxed text-slate-600">
            This document is required for institutional investor conversations. Upload it to gain {6} readiness points.
          </p>
          <Link
            href="/founder/documents"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white"
            style={{ background: "#534AB7" }}
          >
            Upload document →
          </Link>
        </div>
      ),
    })),
  ];

  // Compute simulated score
  const gainedPts = allSteps
    .filter((s) => completedIds.has(s.id))
    .reduce((sum, s) => sum + s.pts, 0);
  const simulatedScore = Math.min(100, currentScore + gainedPts);

  // Assign step statuses
  const stepsWithStatus = allSteps.map((s, i) => {
    const isDone = completedIds.has(s.id);
    const prevDone = i === 0 || completedIds.has(allSteps[i - 1]!.id);
    const status: StepStatus = isDone ? "done" : prevDone ? "current" : "upcoming";
    return { ...s, status };
  });

  const completedCount = completedIds.size;
  const remaining = allSteps.length - completedCount;

  if (isAtTarget && completedCount === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="mb-3 flex justify-center">
          <ScoreRing score={currentScore} />
        </div>
        <p className="text-base font-semibold text-emerald-900">You&apos;re already at {currentScore} — above the {targetScore} threshold!</p>
        <p className="mt-1 text-sm text-emerald-700">Your profile is investor-ready. Keep your documents current and maintain your readiness score as you grow.</p>
        <Link href="/founder/matching" className="mt-4 inline-flex rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: "#16a34a" }}>
          Browse investor matches →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Score progress header */}
      <div
        className="flex items-center gap-5 rounded-xl border p-5"
        style={{ borderColor: "#c7d2fe", background: "#fafaff" }}
      >
        {/* Current */}
        <div className="relative flex-shrink-0">
          <ScoreRing score={currentScore} />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-slate-800">{currentScore}</span>
          </div>
        </div>

        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">
            {companyName} · {currentScore}/100
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Target: {targetScore} (institutional threshold)
            {gainedPts > 0 ? ` · +${gainedPts} pts from completed steps` : ""}
          </p>

          {/* Progress bar toward target */}
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(simulatedScore / targetScore) * 100}%`,
                background: simulatedScore >= targetScore ? "#16a34a" : "#534AB7",
              }}
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            {simulatedScore >= targetScore
              ? "✓ Target reached — complete the steps above to confirm"
              : `${targetScore - simulatedScore} more points needed`}
          </p>
        </div>

        {/* Simulated score */}
        {gainedPts > 0 ? (
          <div className="relative flex-shrink-0">
            <ScoreRing score={simulatedScore} size={48} strokeWidth={5} />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] font-bold" style={{ color: simulatedScore >= 80 ? "#16a34a" : "#534AB7" }}>
                {simulatedScore}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Step list */}
      {remaining > 0 ? (
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            {remaining} step{remaining > 1 ? "s" : ""} remaining
          </p>
          <div className="space-y-2">
            {stepsWithStatus.map((step) => (
              <StepCard
                key={step.id}
                step={{
                  id: step.id,
                  title: step.title,
                  pointValue: step.pts,
                  status: step.status,
                  content: step.content,
                }}
                onComplete={() => markDone(step.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <p className="text-sm font-semibold text-emerald-900">{t("all_steps_completed")}</p>
          <p className="mt-1 text-xs text-emerald-700">
            Reload the page to see your updated readiness score, then browse your investor matches.
          </p>
          <Link
            href="/founder/matching"
            className="mt-3 inline-flex rounded-lg px-4 py-2 text-xs font-semibold text-white"
            style={{ background: "#16a34a" }}
          >
            Browse investor matches →
          </Link>
        </div>
      )}
    </div>
  );
}
