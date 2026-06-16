"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Document quality rubric — investor-expectation driven
// ---------------------------------------------------------------------------

type DocSpec = {
  typeCode: string;
  label: string;
  weight: number;          // contribution to overall score (sum = 100)
  critical: boolean;
  investorExpectation: string;
  keyElements: string[];
  improvementTip: string;
};

const DOC_SPECS: DocSpec[] = [
  {
    typeCode: "PITCH_DECK",
    label: "Pitch Deck",
    weight: 30,
    critical: true,
    investorExpectation: "A 10–15 slide deck covering problem, solution, market, traction, team, and ask.",
    keyElements: [
      "Problem slide — specific, evidence-backed pain point",
      "Solution slide — clear differentiator vs. status quo",
      "Market size — TAM/SAM/SOM with methodology",
      "Traction slide — real metrics (ARR, users, growth rate)",
      "Team slide — why this team, relevant experience",
      "Financials — 3-year projection with key assumptions",
      "The ask — round size, use of funds, milestone achieved",
    ],
    improvementTip: "Remove anything that doesn't directly answer 'why you, why now, why this market'. Aim for 12 slides max.",
  },
  {
    typeCode: "FINANCIALS",
    label: "Financial Model",
    weight: 25,
    critical: true,
    investorExpectation: "A 3–5 year model with P&L, cash flow, and unit economics. Investors stress-test your assumptions.",
    keyElements: [
      "Revenue model — how you earn, pricing tiers",
      "Cost structure — COGS, fixed vs. variable OpEx",
      "Unit economics — CAC, LTV, payback period, gross margin",
      "Cash flow — monthly for Year 1, quarterly for Years 2–3",
      "Funding use table — exactly where this round goes",
      "Sensitivity analysis — base / bull / bear scenarios",
    ],
    improvementTip: "Investors will ask 'what are your biggest assumptions?' — build those as editable inputs, not hardcoded numbers.",
  },
  {
    typeCode: "CAP_TABLE",
    label: "Cap Table",
    weight: 15,
    critical: true,
    investorExpectation: "Current ownership with fully-diluted shares, option pool, and SAFE/note balances.",
    keyElements: [
      "Founder shares — vesting schedule, cliff, acceleration",
      "Option pool — size, granted vs. available",
      "SAFEs/convertible notes — amount, valuation cap, discount",
      "Pro-forma post-money — what will ownership look like after this round",
    ],
    improvementTip: "Investors will model dilution from their check size — make it easy by including a post-money tab.",
  },
  {
    typeCode: "BUSINESS_PLAN",
    label: "Business Plan",
    weight: 10,
    critical: false,
    investorExpectation: "An executive summary or one-pager — investors rarely read long plans, but summaries signal clarity.",
    keyElements: [
      "Executive summary — one page max",
      "Business model description",
      "Go-to-market strategy",
      "Competitive landscape analysis",
    ],
    improvementTip: "Replace a long business plan with a tight 2-page executive summary — it's faster to read and signals clear thinking.",
  },
  {
    typeCode: "TEAM_BIOS",
    label: "Team Bios",
    weight: 10,
    critical: false,
    investorExpectation: "Short bios (100–200 words each) focused on domain expertise, prior exits, and why this team solves this problem.",
    keyElements: [
      "Founder(s) LinkedIn + photo",
      "Relevant domain expertise for the specific problem",
      "Prior company builds or exits",
      "Key hires — how they complement the founding team",
    ],
    improvementTip: "Lead with results ('Built and sold X', 'Led Y to $Z ARR') not job titles. Investors skim for pattern-matching.",
  },
  {
    typeCode: "LEGAL_DOCUMENT",
    label: "Legal Documents",
    weight: 10,
    critical: false,
    investorExpectation: "Incorporation docs, IP assignments, and any NDAs or material contracts relevant to diligence.",
    keyElements: [
      "Certificate of Incorporation",
      "IP assignment agreements (all founders signed)",
      "SAFE / convertible note agreements if applicable",
      "Material contracts (key customers, partnerships, licenses)",
    ],
    improvementTip: "IP assignment gaps are a top deal-killer at Series A diligence. Ensure all founders have signed before fundraising.",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type UploadedDoc = {
  id: string;
  file_name: string | null;
  document_type: string | null;
  status: string | null;
};

function computeOverallScore(docs: UploadedDoc[]): number {
  const uploadedCodes = new Set(
    docs
      .filter((d) => (d.status ?? "").toLowerCase() !== "archived")
      .map((d) => (d.document_type ?? "").toUpperCase()),
  );

  let score = 0;
  for (const spec of DOC_SPECS) {
    if (uploadedCodes.has(spec.typeCode)) {
      score += spec.weight;
    }
  }
  return score;
}

function isUploaded(spec: DocSpec, docs: UploadedDoc[]): boolean {
  const aliases: Record<string, string[]> = {
    FINANCIALS: ["FINANCIAL_STATEMENTS"],
    LEGAL_DOCUMENT: ["LEGAL_DOCUMENTS"],
  };
  const matchCodes = new Set([spec.typeCode, ...(aliases[spec.typeCode] ?? [])]);
  return docs.some(
    (d) =>
      d.document_type && matchCodes.has(d.document_type.toUpperCase()) &&
      (d.status ?? "").toLowerCase() !== "archived",
  );
}

// ---------------------------------------------------------------------------
// Document card
// ---------------------------------------------------------------------------

function DocCard({ spec, uploaded }: { spec: DocSpec; uploaded: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{
        borderColor: uploaded ? "#bbf7d0" : spec.critical ? "#fca5a5" : "#e2e8f0",
        background: uploaded ? "#f0fdf4" : spec.critical ? "#fff9f9" : "white",
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          {/* Status icon */}
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
            style={{
              background: uploaded ? "#16a34a" : spec.critical ? "#dc2626" : "#e2e8f0",
            }}
          >
            {uploaded ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 9v4M12 17h.01" stroke={spec.critical ? "white" : "#94a3b8"} strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-900">{spec.label}</p>
            <p className="text-[10px] text-slate-400">
              {uploaded
                ? "Uploaded"
                : spec.critical
                ? "Missing — critical for investor conversations"
                : "Not uploaded"}
              {" · "}+{spec.weight} pts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!uploaded && spec.critical ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-700">CRITICAL</span>
          ) : null}
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"
            style={{ transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0)" }}
          >
            <path d="M6 9l6 6 6-6" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {expanded ? (
        <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "inherit" }}>
          <p className="mb-2 text-[11px] italic text-slate-500">{spec.investorExpectation}</p>

          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Key elements investors look for</p>
          <div className="mb-3 space-y-1">
            {spec.keyElements.map((el, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <div
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: uploaded ? "#16a34a" : "#94a3b8" }}
                />
                <p className="text-[11px] leading-relaxed text-slate-600">{el}</p>
              </div>
            ))}
          </div>

          {!uploaded ? (
            <div className="rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-100">
              <p className="text-[10px] font-semibold text-amber-700">Improvement tip</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800">{spec.improvementTip}</p>
            </div>
          ) : (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 ring-1 ring-emerald-100">
              <p className="text-[11px] text-emerald-700">{spec.improvementTip}</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Props = Readonly<{
  documents: UploadedDoc[];
}>;

export function DocumentQualityPanel({ documents }: Props) {
  const score = computeOverallScore(documents);
  const uploadedCount = DOC_SPECS.filter((s) => isUploaded(s, documents)).length;
  const missingCritical = DOC_SPECS.filter((s) => s.critical && !isUploaded(s, documents)).length;

  const scoreColor =
    score >= 80 ? "#16a34a" : score >= 55 ? "#d97706" : "#dc2626";
  const scoreLabel =
    score >= 80 ? "Investor ready" : score >= 55 ? "Needs work" : "Incomplete";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Accent bar */}
      <div style={{ height: 3, background: "linear-gradient(90deg,#16a34a,#059669)" }} />

      <div className="p-5">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "#f0fdf4" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#16a34a" strokeWidth="1.8" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Document quality</p>
              <p className="text-[11px] text-slate-400">
                {uploadedCount} of {DOC_SPECS.length} uploaded
                {missingCritical > 0 ? ` · ${missingCritical} critical missing` : ""}
              </p>
            </div>
          </div>

          {/* Score ring */}
          <div className="flex flex-col items-center">
            <div className="relative flex h-12 w-12 items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 48 48" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="24" cy="24" r="20" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                <circle
                  cx="24" cy="24" r="20" fill="none"
                  stroke={scoreColor}
                  strokeWidth="4"
                  strokeDasharray={`${(score / 100) * 125.66} 125.66`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-[10px] font-bold" style={{ color: scoreColor }}>{score}</span>
            </div>
            <span className="mt-0.5 text-[9px] font-semibold" style={{ color: scoreColor }}>{scoreLabel}</span>
          </div>
        </div>

        {/* Missing critical banner */}
        {missingCritical > 0 ? (
          <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-red-800">
              {missingCritical} critical document{missingCritical > 1 ? "s" : ""} missing
            </p>
            <p className="mt-0.5 text-[11px] text-red-600">
              Institutional investors require a pitch deck, financial model, and cap table before any substantive conversation.
            </p>
          </div>
        ) : null}

        {/* Document cards */}
        <div className="space-y-2">
          {DOC_SPECS.map((spec) => (
            <DocCard key={spec.typeCode} spec={spec} uploaded={isUploaded(spec, documents)} />
          ))}
        </div>
      </div>
    </div>
  );
}
