"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Types & data
// ---------------------------------------------------------------------------

type UpdateFrequency = "monthly" | "quarterly";
type RaiseStage = "pre_seed" | "seed" | "series_a" | "post_raise";

type Section = {
  id: string;
  label: string;
  description: string;
  placeholder: string;
  required: boolean;
  tip: string;
};

const SECTIONS: Section[] = [
  {
    id: "headline",
    label: "One-line headline",
    description: "The most important thing that happened this period.",
    placeholder: "e.g. Hit $100K ARR and signed our first enterprise customer.",
    required: true,
    tip: "Lead with momentum. Investors skim — make this line count.",
  },
  {
    id: "metrics",
    label: "Key metrics",
    description: "Your 3–5 most important numbers this period vs. last period.",
    placeholder: "ARR: $100K (+18% MoM)\nCustomers: 12 (+3)\nChurn: 1.8%\nRunway: 14 months\nTeam: 4",
    required: true,
    tip: "Always show the delta, not just the absolute number. Trend matters more than snapshot.",
  },
  {
    id: "wins",
    label: "Wins",
    description: "2–4 specific things that went well. Be concrete.",
    placeholder: "• Closed Acme Corp ($18K ARR) — our largest deal to date\n• Shipped payment integration — unblocks 3 enterprise pilots\n• Hired VP Sales (starts March 1)",
    required: true,
    tip: "Name customer names, dollar amounts, and dates. Vague wins read as no wins.",
  },
  {
    id: "challenges",
    label: "Challenges",
    description: "1–2 honest things that aren't going well. Investors respect candour.",
    placeholder: "• Enterprise sales cycle longer than expected — average 60 days vs. projected 30\n• Lost two SMB customers to price — adjusting packaging",
    required: true,
    tip: "Investors already know things go wrong. Hiding problems destroys trust. Naming them + your plan builds it.",
  },
  {
    id: "focus",
    label: "Focus next period",
    description: "Your 2–3 most important goals for the next month/quarter.",
    placeholder: "• Close 3 enterprise pilots by end of month\n• Reach $120K ARR\n• Launch self-serve onboarding",
    required: true,
    tip: "Keep it to 2–3 items. If everything is a priority, nothing is.",
  },
  {
    id: "asks",
    label: "Asks",
    description: "Specific ways your investors can help right now.",
    placeholder: "• Intro to anyone in HR tech at mid-market companies (50–500 employees)\n• Reference for a CTO hire — happy to share JD\n• Feedback on our Series A pitch narrative (attached)",
    required: false,
    tip: "Make asks specific and small. 'Can you help with sales?' gets no response. 'Intro to HR buyers at Series B SaaS companies' does.",
  },
];

const STAGE_GUIDANCE: Record<RaiseStage, { label: string; tone: string; frequency: string; lengthTarget: string; extraTips: string[] }> = {
  pre_seed: {
    label: "Pre-seed",
    tone: "Informal and energetic. You're building fast and learning faster — let that show.",
    frequency: "Monthly",
    lengthTarget: "Under 300 words",
    extraTips: [
      "Don't have metrics yet? Replace the metrics section with 'What we learned this month'",
      "Include a customer quote if you have one — nothing beats social proof at this stage",
      "Your asks section matters most here: your investors are your network",
    ],
  },
  seed: {
    label: "Seed",
    tone: "Confident and data-forward. You should have some metrics by now — lead with them.",
    frequency: "Monthly",
    lengthTarget: "300–400 words",
    extraTips: [
      "If MoM growth is strong, put it in the subject line: '[Company] — 18% MoM | Jan update'",
      "Investors start expecting product and retention metrics at seed stage",
      "If you're preparing for Series A, mention your target raise in this section",
    ],
  },
  series_a: {
    label: "Series A",
    tone: "Professional and metrics-driven. Board-level communication standards apply.",
    frequency: "Monthly (brief) + Quarterly (detailed)",
    lengthTarget: "400–600 words for monthly; longer for quarterly",
    extraTips: [
      "Add a 'Risks and mitigations' section — Series A investors expect board-level transparency",
      "Include a snapshot of your financial model vs. actuals",
      "Reference your board deck if you send one separately — align the narrative",
    ],
  },
  post_raise: {
    label: "Post-raise (deployed capital)",
    tone: "Stewardship-focused. Show that you're deploying capital wisely and building toward the next milestone.",
    frequency: "Quarterly",
    lengthTarget: "500–700 words",
    extraTips: [
      "Reference your use of proceeds vs. plan — investors track this",
      "Share learnings from experiments — even failed ones build credibility",
      "Start seeding the narrative for your next raise 9–12 months out",
    ],
  },
};

const SUBJECT_LINE_TEMPLATES = [
  "[Company] update — [Month] | [Headline metric]",
  "[Company] — [Month] | [ARR] ARR, [growth]% MoM",
  "[Month] update | [Company] — [one-liner win]",
  "[Company] monthly: [metric] → [new metric]",
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionEditor({
  section,
  value,
  onChange,
}: {
  section: Section;
  value: string;
  onChange: (v: string) => void;
}) {
  const [showTip, setShowTip] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="px-4 py-3">
        <div className="mb-1 flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-800">{section.label}</p>
          {section.required ? null : (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">Optional</span>
          )}
          <button
            type="button"
            onClick={() => setShowTip((o) => !o)}
            className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold transition hover:bg-indigo-100"
            style={{ color: "#534AB7" }}
            aria-label="Show tip"
          >
            ?
          </button>
        </div>
        <p className="mb-2 text-[11px] text-slate-500">{section.description}</p>
        {showTip ? (
          <div className="mb-2 rounded-lg bg-indigo-50 px-3 py-2 text-[11px] leading-relaxed text-indigo-800">
            💡 {section.tip}
          </div>
        ) : null}
        <textarea
          rows={section.id === "metrics" ? 5 : section.id === "headline" ? 2 : 4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={section.placeholder}
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 font-mono text-xs leading-relaxed text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function InvestorUpdateBuilder() {
  const [stage, setStage] = useState<RaiseStage>("seed");
  const [frequency, setFrequency] = useState<UpdateFrequency>("monthly");
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(SECTIONS.map((s) => [s.id, ""]))
  );
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [period, setPeriod] = useState("");

  const guidance = STAGE_GUIDANCE[stage];

  function update(id: string, value: string) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  function buildUpdate(): string {
    const co = companyName || "[Company]";
    const per = period || "[Period]";
    const headline = values.headline || "[Your headline]";

    let text = `Subject: ${co} ${frequency === "monthly" ? "monthly" : "quarterly"} update — ${per}\n\n`;
    text += `Hi [Investor name],\n\n`;
    text += `${headline}\n\n`;

    if (values.metrics) {
      text += `📊 Metrics\n${values.metrics}\n\n`;
    }
    if (values.wins) {
      text += `✅ Wins\n${values.wins}\n\n`;
    }
    if (values.challenges) {
      text += `⚠️ Challenges\n${values.challenges}\n\n`;
    }
    if (values.focus) {
      text += `🎯 Focus next ${frequency === "monthly" ? "month" : "quarter"}\n${values.focus}\n\n`;
    }
    if (values.asks) {
      text += `🙏 Asks\n${values.asks}\n\n`;
    }
    text += `Thanks for your continued support,\n[Your name]\n${co}`;
    return text;
  }

  function copyUpdate() {
    navigator.clipboard.writeText(buildUpdate()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const filledRequired = SECTIONS.filter((s) => s.required).every((s) => values[s.id]?.trim().length > 0);

  return (
    <div className="space-y-5">
      {/* Stage & frequency */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-700">Company stage</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STAGE_GUIDANCE) as RaiseStage[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStage(s)}
                className="rounded-full px-3 py-1 text-[11px] font-semibold transition"
                style={{ background: stage === s ? "#534AB7" : "#F1F5F9", color: stage === s ? "white" : "#475569" }}
              >
                {STAGE_GUIDANCE[s].label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-700">Frequency</p>
          <div className="flex gap-2">
            {(["monthly", "quarterly"] as UpdateFrequency[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrequency(f)}
                className="rounded-full px-3 py-1 text-[11px] font-semibold transition capitalize"
                style={{ background: frequency === f ? "#534AB7" : "#F1F5F9", color: frequency === f ? "white" : "#475569" }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stage guidance */}
      <div className="rounded-xl border border-indigo-100 bg-[#FAFAFF] px-4 py-3">
        <div className="mb-1.5 flex items-center gap-2">
          <p className="text-xs font-semibold" style={{ color: "#534AB7" }}>{guidance.label} guidance</p>
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-semibold text-indigo-700">
            {guidance.frequency} · {guidance.lengthTarget}
          </span>
        </div>
        <p className="mb-2 text-[11px] leading-relaxed text-slate-600"><span className="font-semibold">Tone: </span>{guidance.tone}</p>
        <div className="space-y-1">
          {guidance.extraTips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-0.5 text-[10px]" style={{ color: "#534AB7" }}>•</span>
              <p className="text-[11px] leading-relaxed text-slate-600">{tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Subject line templates */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="mb-2 text-xs font-semibold text-slate-700">Subject line templates</p>
        <div className="space-y-1.5">
          {SUBJECT_LINE_TEMPLATES.map((tpl, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
              <p className="flex-1 font-mono text-[11px] text-slate-600">{tpl}</p>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(tpl)}
                className="shrink-0 text-[10px] font-medium"
                style={{ color: "#534AB7" }}
              >
                Copy
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Company & period */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Company name</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Inc."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Period</label>
          <input
            type="text"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="January 2026"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {SECTIONS.map((s) => (
          <SectionEditor key={s.id} section={s} value={values[s.id]} onChange={(v) => update(s.id, v)} />
        ))}
      </div>

      {/* Preview / copy */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setShowPreview((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <p className="text-sm font-semibold text-slate-800">Preview update</p>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="transition-transform" style={{ transform: showPreview ? "rotate(180deg)" : "rotate(0deg)" }}>
            <path d="M6 9l6 6 6-6" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {showPreview ? (
          <div className="border-t border-slate-100 px-4 py-3">
            <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-xs leading-relaxed text-slate-700">
              {buildUpdate()}
            </pre>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={copyUpdate}
          disabled={!filledRequired}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-40"
          style={{ background: "#534AB7" }}
        >
          {copied ? "Copied!" : "Copy full update"}
        </button>
        {!filledRequired ? (
          <p className="text-[11px] text-slate-400">Fill in all required sections to copy</p>
        ) : null}
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700">Sending best practices</p>
        <div className="space-y-1">
          {[
            "Send on the same day each period — consistency signals professionalism",
            "BCC all investors, not a shared list — avoids awkward reply-alls",
            "Don't send at 9am Monday or 5pm Friday — Tuesday–Thursday mid-morning gets the best open rates",
            "Archive every update somewhere — they become your fundraising narrative for the next round",
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-0.5 text-[10px] text-amber-600">•</span>
              <p className="text-[11px] leading-relaxed text-amber-800">{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
