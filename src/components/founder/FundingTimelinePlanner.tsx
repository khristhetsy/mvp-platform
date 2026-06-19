"use client";

import { useState, useMemo, useEffect } from "react";
import { useToolkitSave, ToolkitSaveStatus } from "@/hooks/useToolkitSave";

function SaveChip({ status }: { status: ToolkitSaveStatus }) {
  if (status === "idle") return null;
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    saving: { bg: "#F1F5F9", text: "#64748b", label: "Saving…" },
    saved:  { bg: "#F0FDF4", text: "#15803D", label: "Saved" },
    error:  { bg: "#FEF2F2", text: "#DC2626", label: "Save failed" },
  };
  const s = styles[status];
  if (!s) return null;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: s.bg, color: s.text }}>
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Types & data
// ---------------------------------------------------------------------------

type RoundType = "pre_seed" | "seed" | "series_a";

type PhaseConfig = {
  label: string;
  weeks: number;
  description: string;
  actions: string[];
  color: string;
};

const ROUND_PHASES: Record<RoundType, PhaseConfig[]> = {
  pre_seed: [
    {
      label: "Prep",
      weeks: 3,
      description: "Tighten narrative, build target list, get intros lined up.",
      actions: ["Finalise pitch deck (≤12 slides)", "Build list of 30–50 angels", "Request 5–10 warm intros", "Set up data room basics"],
      color: "#534AB7",
    },
    {
      label: "First meetings",
      weeks: 3,
      description: "Run first conversations. Filter for high-signal interest fast.",
      actions: ["Run 20+ first meetings", "Send follow-ups within 24h", "Track responses in pipeline", "Identify top 5 prospects"],
      color: "#059669",
    },
    {
      label: "Diligence",
      weeks: 2,
      description: "Investors doing reference checks and product review.",
      actions: ["Provide customer references", "Share financials / model", "Answer diligence questions", "Maintain momentum with others"],
      color: "#d97706",
    },
    {
      label: "Terms & close",
      weeks: 2,
      description: "Negotiate and countersign. Use deadline to drive urgency.",
      actions: ["Negotiate SAFE terms", "Set a hard close date", "Follow up with undecideds", "Wire funds and celebrate"],
      color: "#dc2626",
    },
  ],
  seed: [
    {
      label: "Prep",
      weeks: 4,
      description: "Build institutional-grade materials. Get warm intros to target funds.",
      actions: ["Finalise deck + data room", "Build list of 50–80 seed funds", "Request intros through portfolio", "Prep for metrics questions"],
      color: "#534AB7",
    },
    {
      label: "First meetings",
      weeks: 4,
      description: "Run partner first meetings with target funds.",
      actions: ["20–30 first meetings", "Filter to high-interest funds", "Send follow-up + deck within 24h", "Build urgency through pipeline width"],
      color: "#059669",
    },
    {
      label: "Partner meetings",
      weeks: 3,
      description: "Full partnership meetings for interested funds.",
      actions: ["Full partner meeting prep", "Prepare for deeper metric questions", "Reference check prep", "Maintain parallel tracks"],
      color: "#0ea5e9",
    },
    {
      label: "Diligence",
      weeks: 2,
      description: "Customer calls, model review, legal review.",
      actions: ["Customer reference calls", "Share full financial model", "Legal review (term sheet basics)", "Keep warm leads active"],
      color: "#d97706",
    },
    {
      label: "Terms & close",
      weeks: 3,
      description: "Lead negotiation, then fill syndicate.",
      actions: ["Negotiate lead terms", "Set close date (2–3 weeks out)", "Fill syndicate around lead", "Wire + close legal docs"],
      color: "#dc2626",
    },
  ],
  series_a: [
    {
      label: "Pre-process prep",
      weeks: 6,
      description: "Build metrics story, get to Series A–ready state before going out.",
      actions: ["Reach target ARR / growth rate", "Build board-level data room", "Get advisors aligned", "Brief existing investors"],
      color: "#534AB7",
    },
    {
      label: "Relationship building",
      weeks: 4,
      description: "Warm up target funds before formally raising.",
      actions: ["Coffee chats (not pitches)", "Quarterly update to target VCs", "Get intros through portfolio cos", "Build 20–30 fund target list"],
      color: "#7c3aed",
    },
    {
      label: "Active raise",
      weeks: 4,
      description: "Go formal. Run tightly compressed process.",
      actions: ["Announce you're in market", "20+ first meetings in 2 weeks", "Partner meetings week 3–4", "Reference check prep"],
      color: "#059669",
    },
    {
      label: "Diligence",
      weeks: 3,
      description: "Deep technical, financial, and customer diligence.",
      actions: ["Technical due diligence", "Customer calls (2–5 per fund)", "Legal and IP review", "Financial model walkthrough"],
      color: "#d97706",
    },
    {
      label: "Term sheet & legal",
      weeks: 4,
      description: "Negotiate terms, run legal docs, close.",
      actions: ["Negotiate lead term sheet", "Engage startup counsel", "Sign + close within 3–4 weeks", "Announce on close"],
      color: "#dc2626",
    },
  ],
};

const ROUND_TYPE_LABELS: Record<RoundType, string> = {
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
};

// Pipeline math benchmarks
const PIPELINE_MATH: Record<RoundType, { intros: number; firstMeetings: number; partnerMeetings: number; termSheets: number; closes: number }> = {
  pre_seed: { intros: 50, firstMeetings: 25, partnerMeetings: 0, termSheets: 5, closes: 1 },
  seed: { intros: 80, firstMeetings: 30, partnerMeetings: 10, termSheets: 3, closes: 1 },
  series_a: { intros: 40, firstMeetings: 20, partnerMeetings: 8, termSheets: 2, closes: 1 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function weeksBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PhaseCard({ phase, startDate, index }: { phase: PhaseConfig; startDate: Date; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const endDate = addWeeks(startDate, phase.weeks);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((o) => !o)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: phase.color }}>
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-semibold text-slate-900">{phase.label}</p>
            <span className="text-[10px] text-slate-400">{phase.weeks}w · {formatDate(startDate)} – {formatDate(endDate)}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">{phase.description}</p>
        </div>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"
          className="mt-1 shrink-0 transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
          <path d="M6 9l6 6 6-6" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {expanded ? (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Key actions</p>
          <div className="space-y-1">
            {phase.actions.map((a, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ background: phase.color }}>{i + 1}</span>
                <p className="text-[11px] leading-relaxed text-slate-700">{a}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FundingTimelinePlanner() {
  const [roundType, setRoundType] = useState<RoundType>("seed");
  const [closeDate, setCloseDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 5);
    return d.toISOString().split("T")[0];
  });

  const { savedData, loaded, save, saveStatus } = useToolkitSave<{ roundType: string; closeDate: string }>("funding-timeline");

  useEffect(() => {
    if (loaded && savedData) {
      setRoundType((savedData.roundType as RoundType) ?? "seed");
      setCloseDate(savedData.closeDate ?? (() => { const d = new Date(); d.setMonth(d.getMonth() + 5); return d.toISOString().split("T")[0]; })());
    }
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;
    save({ roundType, closeDate });
  }, [roundType, closeDate, loaded, save]);

  const phases = ROUND_PHASES[roundType];
  const math = PIPELINE_MATH[roundType];

  const totalWeeks = useMemo(() => phases.reduce((sum, p) => sum + p.weeks, 0), [phases]);

  const parsedClose = useMemo(() => new Date(closeDate + "T00:00:00"), [closeDate]);
  const startDate = useMemo(() => {
    const d = new Date(parsedClose);
    d.setDate(d.getDate() - totalWeeks * 7);
    return d;
  }, [parsedClose, totalWeeks]);

  const today = new Date();
  const weeksUntilStart = weeksBetween(today, startDate);
  const weeksUntilClose = weeksBetween(today, parsedClose);

  // Build phase start dates
  const phaseStarts = useMemo(() => {
    const starts: Date[] = [];
    let current = new Date(startDate);
    for (const phase of phases) {
      starts.push(new Date(current));
      current = addWeeks(current, phase.weeks);
    }
    return starts;
  }, [phases, startDate]);

  // Current phase
  const currentPhaseIndex = useMemo(() => {
    if (today < startDate) return -1;
    for (let i = phases.length - 1; i >= 0; i--) {
      if (today >= phaseStarts[i]) return i;
    }
    return 0;
  }, [today, startDate, phases, phaseStarts]);

  const isLate = weeksUntilStart < 0 && weeksUntilClose > 0;
  const tooShort = totalWeeks > weeksUntilClose;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <SaveChip status={saveStatus} />
      </div>

      {/* Controls */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-700">Round type</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ROUND_PHASES) as RoundType[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoundType(r)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
                style={{ background: roundType === r ? "#534AB7" : "#F1F5F9", color: roundType === r ? "white" : "#475569" }}
              >
                {ROUND_TYPE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold text-slate-700">Target close date</label>
          <input
            type="date"
            value={closeDate}
            onChange={(e) => setCloseDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm">
          <p className="text-xl font-bold" style={{ color: weeksUntilStart < 0 ? "#dc2626" : "#534AB7" }}>
            {weeksUntilStart < 0 ? `${Math.abs(weeksUntilStart)}w ago` : `${weeksUntilStart}w`}
          </p>
          <p className="text-[10px] text-slate-500">Until prep starts</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm">
          <p className="text-xl font-bold" style={{ color: "#059669" }}>{totalWeeks}w</p>
          <p className="text-[10px] text-slate-500">Total process</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm">
          <p className="text-xl font-bold" style={{ color: weeksUntilClose < 8 ? "#d97706" : "#0ea5e9" }}>
            {weeksUntilClose}w
          </p>
          <p className="text-[10px] text-slate-500">Until close</p>
        </div>
      </div>

      {/* Warnings */}
      {tooShort && weeksUntilClose > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] leading-relaxed text-red-800">
          <span className="font-semibold">⚠️ Timeline too compressed. </span>
          A {ROUND_TYPE_LABELS[roundType]} typically needs {totalWeeks} weeks — you have {weeksUntilClose}. Either move your close date to{" "}
          <span className="font-semibold">{formatDate(addWeeks(today, totalWeeks))}</span> or accept that some phases will overlap.
        </div>
      ) : null}
      {isLate ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-relaxed text-amber-800">
          <span className="font-semibold">📅 You should already be in prep. </span>
          Based on your close date, prep started {Math.abs(weeksUntilStart)} week{Math.abs(weeksUntilStart) !== 1 ? "s" : ""} ago.
          You&apos;re in the <span className="font-semibold">{currentPhaseIndex >= 0 ? phases[currentPhaseIndex]?.label : "active"}</span> phase now.
        </div>
      ) : null}

      {/* Visual timeline bar */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Timeline overview</p>
        <div className="flex overflow-hidden rounded-xl">
          {phases.map((phase, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center px-1 py-2 text-center"
              style={{
                flex: phase.weeks,
                background: phase.color,
                opacity: currentPhaseIndex === i ? 1 : currentPhaseIndex > i ? 0.5 : 0.85,
              }}
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.06em] text-white">{phase.label}</p>
              <p className="text-[8px] text-white/80">{phase.weeks}w</p>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-slate-400">
          <span>{formatDate(startDate)}</span>
          <span>{formatDate(parsedClose)}</span>
        </div>
      </div>

      {/* Phase cards */}
      <div className="space-y-3">
        {phases.map((phase, i) => (
          <PhaseCard
            key={i}
            phase={phase}
            startDate={phaseStarts[i]}
            index={i}
          />
        ))}
      </div>

      {/* Pipeline math */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Pipeline math for {ROUND_TYPE_LABELS[roundType]}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Typical funnel to close one lead investor.</p>
        </div>
        <div className="px-4 py-3">
          <div className="space-y-2">
            {[
              { label: "Warm intros requested", value: math.intros, color: "#534AB7" },
              { label: "First meetings", value: math.firstMeetings, color: "#0ea5e9" },
              ...(math.partnerMeetings > 0 ? [{ label: "Partner meetings", value: math.partnerMeetings, color: "#059669" }] : []),
              { label: "Term sheets", value: math.termSheets, color: "#d97706" },
              { label: "Lead investor", value: math.closes, color: "#dc2626" },
            ].map((row, i, arr) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-32 shrink-0 text-[11px] text-slate-600">{row.label}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="h-4 rounded-full" style={{ width: `${Math.round((row.value / arr[0].value) * 100)}%`, background: row.color, minWidth: 8 }} />
                    <span className="text-xs font-bold" style={{ color: row.color }}>{row.value}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            Source: Compiled from YC, First Round, and Sequoia fundraising guidance. Your conversion rate may vary based on warm vs. cold intros and market conditions.
          </p>
        </div>
      </div>

      {/* Key rules */}
      <div className="rounded-xl border border-indigo-100 bg-[#FAFAFF] px-4 py-3">
        <p className="mb-2 text-xs font-semibold" style={{ color: "#534AB7" }}>Rules for a tight process</p>
        <div className="space-y-1">
          {[
            "Run all meetings in parallel, not sequentially — momentum is your leverage",
            "Never take a term sheet until you have 3+ others in active diligence",
            "Create a real deadline and hold it — 'we're closing in 3 weeks' is a feature, not a threat",
            "Brief your existing investors before going out — surprises damage relationships",
            "If a VC goes quiet, move on — follow up once, then reallocate your energy",
          ].map((rule, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-0.5 text-[10px]" style={{ color: "#534AB7" }}>•</span>
              <p className="text-[11px] leading-relaxed text-slate-600">{rule}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
