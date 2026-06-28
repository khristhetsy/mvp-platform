"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Company } from "@/lib/supabase/types";
import { AIFieldHelper } from "@/components/ui/AIFieldHelper";

/* ─────────────────────────── data ─────────────────────────── */

const INDUSTRIES = [
  "FinTech", "HealthTech", "SaaS / B2B Software", "EdTech", "CleanTech",
  "E-commerce", "AI / ML", "Real Estate", "Consumer", "Deep Tech",
  "Marketplace", "Logistics", "Hardware", "Other",
];

const STAGES = [
  { id: "pre_revenue",   label: "Pre-revenue",   sub: "Idea, prototype, or early development" },
  { id: "early_revenue", label: "Early revenue", sub: "Up to $100K ARR" },
  { id: "growing",       label: "Growing",       sub: "$100K – $1M ARR" },
  { id: "scaling",       label: "Scaling",       sub: "$1M+ ARR" },
];

const FUND_USES = [
  "Hire team", "Build product", "Marketing & sales",
  "R&D", "Operations", "International expansion", "Working capital",
];

const TIMELINES = [
  { id: "3m",        label: "Within 3 months", sub: "Actively closing now" },
  { id: "6m",        label: "3 – 6 months",    sub: "Building pipeline" },
  { id: "12m",       label: "6 – 12 months",   sub: "Early planning phase" },
  { id: "exploring", label: "Just exploring",  sub: "Learning the process" },
];

/* ─────────────────────────── helpers ──────────────────────── */

function raiseHint(stage: string | null): string {
  switch (stage) {
    case "pre_revenue":   return "Pre-seed rounds typically range $150K – $750K. Seed rounds: $500K – $3M.";
    case "early_revenue": return "Seed rounds typically range $500K – $3M. Series A starts at $3M+.";
    case "growing":       return "Series A typically ranges $3M – $15M.";
    case "scaling":       return "Series A/B rounds typically range $5M – $50M.";
    default:              return "Enter the total you plan to raise in this round.";
  }
}

/** Loose phone check — at least 7 digits, allowing +, spaces, dashes, parens. */
function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function generateOnboardingDraft(opts: {
  companyName: string;
  industry: string | null;
  stage: string | null;
}): string {
  const name = opts.companyName.trim() || "Your company";
  const ind  = (opts.industry ?? "").toLowerCase();
  const stageNote =
    opts.stage && opts.stage !== "pre_revenue"
      ? `\n\nCurrently at [${opts.stage.replaceAll("_", " ")} stage], we're focused on [next growth lever].`
      : "";

  if (ind.includes("fintech") || ind.includes("financial")) {
    return `${name} is a fintech platform helping [target customers] [manage/process/automate] [payments/lending/financial operations] without [key pain point].\n\nWe [your core differentiator]. Unlike [legacy providers], ${name} [your key advantage].${stageNote}`;
  }
  if (ind.includes("health")) {
    return `${name} is a healthtech company enabling [patients / providers] to [access / deliver] [care / diagnostics] more [affordably / effectively].\n\nWe [your mechanism]. Our platform helps [target] [outcome] while [secondary benefit].${stageNote}`;
  }
  if (ind.includes("saas") || ind.includes("software") || ind.includes("b2b")) {
    return `${name} is a [B2B / SMB-focused] software platform that helps [target buyer] [achieve outcome] by [mechanism].\n\nUnlike [legacy approach / spreadsheets], we [your key advantage]. Customers typically see [X% improvement] within [timeframe].${stageNote}`;
  }
  if (ind.includes("ai") || ind.includes("ml")) {
    return `${name} is an AI platform that helps [target users] [automate / predict / analyse] [workflow / data] [faster / more accurately].\n\nWe [your core technology]. Unlike [rule-based tools / manual processes], ${name} [your key advantage].${stageNote}`;
  }
  if (ind.includes("marketplace")) {
    return `${name} is a marketplace connecting [buyers] with [sellers] in the [industry] space.\n\nWe [how you create value for both sides]. Unlike [existing alternatives], ${name} [your key advantage].${stageNote}`;
  }

  return `${name} is a [industry] company that helps [target customers] [achieve a specific outcome] by [your mechanism].\n\nUnlike [existing alternatives], we [your key differentiator]. [One sentence on traction or why now.]${stageNote}`;
}

function computeActionPlan(opts: {
  stage: string | null;
  amount: string;
  timeline: string | null;
}): string[] {
  const actions: string[] = [
    "Upload your pitch deck — it's the #1 document investors ask for first.",
  ];

  if (opts.timeline === "3m") {
    actions.push("Your timeline is tight. Prioritise your top 5 investor matches and start outreach this week.");
  } else {
    actions.push("Run your Capital Readiness check to see exactly what investors will ask in diligence.");
  }

  if (opts.stage === "pre_revenue") {
    actions.push("Pre-revenue raises live or die on vision and team. Strengthen your description and add a team summary.");
  } else if (opts.stage === "early_revenue") {
    actions.push("Early-stage investors look for momentum signals — add your key metrics to the company profile.");
  } else {
    actions.push("At your stage, investors expect a financial model. Make sure it's ready before investor calls.");
  }

  return actions;
}

function computeScore(opts: {
  name: string;
  industry: string | null;
  stage: string | null;
  amount: string;
  description: string;
  useOfFunds: string[];
}): number {
  let s = 20;
  if (opts.name.trim().length >= 2) s += 10;
  if (opts.industry) s += 15;
  if (opts.stage) s += 15;
  if (Number(opts.amount) > 0) s += 10;
  if (opts.description.trim().length >= 20) s += 15;
  if (opts.useOfFunds.length > 0) s += 10;
  return Math.min(s, 100);
}

/* ─────────────────────── sub-components ───────────────────── */

function ContextCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 rounded-xl px-4 py-3.5 text-sm leading-6" style={{ background: "#EEEDFE", color: "#3C3489" }}>
      {children}
    </div>
  );
}

function Chip({
  selected, onClick, children,
}: {
  selected: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-4 py-2 text-sm font-medium transition-all"
      style={{
        background: selected ? "#534AB7" : "transparent",
        borderColor: selected ? "#534AB7" : "#e2e8f0",
        color: selected ? "white" : "#475569",
      }}
    >
      {children}
    </button>
  );
}

function OptionCard({
  selected, onClick, label, sub,
}: {
  selected: boolean; onClick: () => void; label: string; sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-all"
      style={{
        background: selected ? "#EEEDFE" : "white",
        borderColor: selected ? "#534AB7" : "#e2e8f0",
      }}
    >
      <div
        style={{
          width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 2,
          background: selected ? "#534AB7" : "transparent",
          border: selected ? "none" : "2px solid #cbd5e1",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {selected ? <div style={{ width: 6, height: 6, borderRadius: "50%", background: "white" }} /> : null}
      </div>
      <div>
        <p className="text-sm font-medium" style={{ color: selected ? "#3C3489" : "#0f172a", margin: 0 }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: selected ? "#7F77DD" : "#94a3b8", margin: 0 }}>{sub}</p>
      </div>
    </button>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={100} height={100} viewBox="0 0 100 100">
      <circle cx={50} cy={50} r={r} fill="none" stroke="#e2e8f0" strokeWidth={8} />
      <circle
        cx={50} cy={50} r={r} fill="none"
        stroke="#534AB7" strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
      />
      <text x={50} y={46} textAnchor="middle" fontSize={20} fontWeight={600} fill="#1e1b4b">{score}</text>
      <text x={50} y={60} textAnchor="middle" fontSize={10} fill="#7F77DD">/ 100</text>
    </svg>
  );
}

/* ─────────────────────────── main ─────────────────────────── */

type StepNum = 1 | 2 | 3 | 4 | 5 | 6 | 7;
const TOTAL = 6;

export function FounderConversationalOnboarding({
  company,
  founderName,
}: Readonly<{
  company: Company;
  founderName: string;
}>) {
  const router = useRouter();
  const [step, setStep]             = useState<StepNum>(1);
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState<string | null>(null);

  const [companyName, setCompanyName] = useState(company.company_name ?? "");
  const [phone, setPhone]             = useState(company.contact_phone ?? "");
  const [industry, setIndustry]       = useState<string | null>(company.industry ?? null);
  const [stage, setStage]             = useState<string | null>(company.revenue_stage ?? null);
  const [amount, setAmount]           = useState(company.funding_amount?.toString() ?? "");
  const [description, setDescription] = useState(
    !company.business_description || company.business_description.startsWith("Company profile created")
      ? ""
      : company.business_description,
  );
  const [useOfFunds, setUseOfFunds]   = useState<string[]>(
    company.use_of_funds
      ? company.use_of_funds.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
  );
  const [timeline, setTimeline]       = useState<string | null>(null);
  const [country, setCountry]         = useState(company.country ?? "");
  const [companyState, setCompanyState] = useState(company.state ?? "");
  const [jurisdiction, setJurisdiction] = useState(company.incorporation_jurisdiction ?? "");

  function toggleFund(label: string) {
    setUseOfFunds((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label],
    );
  }

  function canAdvance(): boolean {
    switch (step) {
      case 1: return companyName.trim().length >= 2 && isValidPhone(phone) && country.trim().length >= 2;
      case 2: return Boolean(industry);
      case 3: return Boolean(stage);
      case 4: return Number(amount) > 0;
      case 5: return description.trim().length >= 20;
      case 6: return true;
      default: return true;
    }
  }

  async function handleNext() {
    if (step < TOTAL) { setStep((s) => (s + 1) as StepNum); return; }
    // step 6 → save & show done
    setSaving(true);
    setErr(null);
    try {
      const r1 = await fetch("/api/founder/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "company_profile",
          advanceToStep: "funding_information",
          company_name: companyName.trim(),
          contact_phone: phone.trim(),
          industry: industry ?? "",
          country: country.trim(),
          state: companyState.trim(),
          incorporation_jurisdiction: jurisdiction.trim(),
          business_description: description.trim(),
          founder_goals: timeline ? `Looking to close: ${timeline}` : "",
          website: company.website ?? "",
        }),
      });
      if (!r1.ok) throw new Error("Could not save company profile.");

      const r2 = await fetch("/api/founder/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "funding_information",
          advanceToStep: "documents_uploaded",
          funding_amount: Number(amount) || 0,
          revenue_stage: stage ?? "",
          use_of_funds: useOfFunds.join(", "),
        }),
      });
      if (!r2.ok) throw new Error("Could not save funding information.");

      setStep(7);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const firstName = founderName.split(" ")[0] || founderName;
  const actionPlan = computeActionPlan({ stage, amount, timeline });
  const score      = computeScore({ name: companyName, industry, stage, amount, description, useOfFunds });

  /* ─── Done screen ─── */
  if (step === 7) {
    return (
      <>
        <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <div style={{ animation: "fadeUp 0.3s ease both" }} className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-3xl mb-5"
              style={{ background: "#EEEDFE" }}
            >
              🎉
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              ✓ Stage 1 complete
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              Nice work, {firstName} — you&apos;re in Stage 2.
            </h2>
            <p className="mt-2 text-sm text-slate-500 max-w-sm">
              Onboarding&apos;s done and your workspace is unlocked. Here&apos;s what to do next to get investor-ready.
            </p>

            <div className="mt-6">
              <ScoreRing score={score} />
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                Capital Readiness Score
              </p>
              <p className="mt-1 text-xs text-slate-400 max-w-[220px]">
                Your Stage 2 progress. Add your documents and complete the readiness checklist to raise it.
              </p>
            </div>
          </div>

          <div className="mt-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Your next steps in Stage 2</p>
            <div className="space-y-3">
              {actionPlan.map((action, i) => (
                <div
                  key={action}
                  className="flex items-start gap-3 rounded-xl px-4 py-3"
                  style={{ background: "#F8F7FD" }}
                >
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white mt-0.5"
                    style={{ background: "#534AB7" }}
                  >
                    {i + 1}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{action}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.push("/founder/dashboard")}
              className="rounded-full px-6 py-3 text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg,#534AB7,#7c3aed)" }}
            >
              Open my dashboard
            </button>
            <button
              type="button"
              onClick={() => router.push("/founder/documents")}
              className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Upload pitch deck →
            </button>
          </div>
        </div>
      </>
    );
  }

  /* ─── Question steps ─── */
  return (
    <>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        {/* Progress */}
        <div className="mb-8 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Step {step} of {TOTAL}
          </p>
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL }, (_, i) => (
              <div
                key={i}
                style={{
                  width: i + 1 <= step ? 20 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: i + 1 < step ? "#534AB7" : i + 1 === step ? "#534AB7" : "#e2e8f0",
                  transition: "all 0.3s ease",
                  opacity: i + 1 <= step ? 1 : 0.5,
                }}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div key={step} style={{ animation: "fadeUp 0.25s ease both" }}>
          {step === 1 ? (
            <>
              <p className="text-2xl font-semibold tracking-tight text-slate-900">
                What&apos;s your company called?
              </p>
              <p className="mt-1 text-sm text-slate-500">We&apos;ll use this to personalise your experience.</p>
              <input
                autoFocus
                className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                placeholder="e.g. Acme Labs"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />

              <label className="mt-4 block text-sm font-medium text-slate-700">
                Contact phone number <span className="text-rose-600">*</span>
              </label>
              <input
                type="tel"
                inputMode="tel"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                placeholder="e.g. +1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && canAdvance()) void handleNext(); }}
                aria-required="true"
              />
              {phone.trim().length > 0 && !isValidPhone(phone) ? (
                <p className="mt-1.5 text-xs text-rose-600">Enter a valid phone number (7–15 digits).</p>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Country <span className="text-rose-600">*</span>
                  </label>
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    placeholder="e.g. United States"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    aria-required="true"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">State / Province</label>
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    placeholder="e.g. California"
                    value={companyState}
                    onChange={(e) => setCompanyState(e.target.value)}
                  />
                </div>
              </div>

              <label className="mt-4 block text-sm font-medium text-slate-700">Country of incorporation</label>
              <input
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                placeholder="e.g. Delaware C-Corp, UK Ltd, Singapore Pte"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-slate-400">
                Where your company is legally incorporated — often different from where you operate. Investors use this to assess fit.
              </p>

              <ContextCard>
                Your company name is the first thing investors see. Your phone number is required so our team can reach
                you about your raise — it stays private and is never shown publicly.
              </ContextCard>
            </>
          ) : step === 2 ? (
            <>
              <p className="text-2xl font-semibold tracking-tight text-slate-900">
                What industry are you in?
              </p>
              <p className="mt-1 text-sm text-slate-500">Select the closest match — we use this to target the right investors.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {INDUSTRIES.map((ind) => (
                  <Chip key={ind} selected={industry === ind} onClick={() => setIndustry(ind)}>
                    {ind}
                  </Chip>
                ))}
              </div>
              <ContextCard>
                Industry matching is one of the strongest signals our algorithm uses. Investors who back companies in your sector already understand your market — they move faster and ask better questions.
              </ContextCard>
            </>
          ) : step === 3 ? (
            <>
              <p className="text-2xl font-semibold tracking-tight text-slate-900">
                What stage is your company at right now?
              </p>
              <p className="mt-1 text-sm text-slate-500">This calibrates the benchmarks and investor matches we show you.</p>
              <div className="mt-5 space-y-2">
                {STAGES.map((s) => (
                  <OptionCard
                    key={s.id}
                    selected={stage === s.id}
                    onClick={() => setStage(s.id)}
                    label={s.label}
                    sub={s.sub}
                  />
                ))}
              </div>
              <ContextCard>
                Most founders on CapitalOS are raising at Pre-revenue or Early revenue stage. Knowing your stage helps us surface stage-appropriate investors — ones who already back companies like yours.
              </ContextCard>
            </>
          ) : step === 4 ? (
            <>
              <p className="text-2xl font-semibold tracking-tight text-slate-900">
                How much are you looking to raise?
              </p>
              <p className="mt-1 text-sm text-slate-500">Enter the total target for this round in USD.</p>
              <div className="mt-5 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-slate-400">$</span>
                <input
                  autoFocus
                  type="number"
                  min={1}
                  className="w-full rounded-xl border border-slate-200 py-3.5 pl-8 pr-4 text-base font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  placeholder="1000000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canAdvance()) void handleNext(); }}
                />
              </div>
              {Number(amount) > 0 ? (
                <p className="mt-2 text-sm font-semibold" style={{ color: "#534AB7" }}>
                  {formatAmount(Number(amount))}
                </p>
              ) : null}
              <ContextCard>
                {raiseHint(stage)}
                {" "}Raising too little or too much for your stage can slow down conversations — we&apos;ll flag if your target is outside the typical range.
              </ContextCard>
            </>
          ) : step === 5 ? (
            <>
              <p className="text-2xl font-semibold tracking-tight text-slate-900">
                What does your company do?
              </p>
              <p className="mt-1 text-sm text-slate-500">2–3 sentences is all you need. Lead with the problem you solve.</p>
              <textarea
                autoFocus
                rows={4}
                className="mt-5 w-full resize-none rounded-xl border border-slate-200 px-4 py-3.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                placeholder="e.g. We help SMB operators cut payroll processing time by 70% using AI-powered automation. Unlike legacy providers, we integrate in 10 minutes with no IT required."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <AIFieldHelper
                benchmark="Investors spend ~8 seconds reading company descriptions. Lead with the problem you solve — not how you solve it. Replace each [bracket] with your specifics, then trim to 3–4 tight sentences."
                draft={generateOnboardingDraft({ companyName, industry, stage })}
                onInsert={(text) => setDescription(text)}
              />
            </>
          ) : step === 6 ? (
            <>
              <p className="text-2xl font-semibold tracking-tight text-slate-900">
                What will you use this funding for?
              </p>
              <p className="mt-1 text-sm text-slate-500">Select all that apply. Then tell us your timeline.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {FUND_USES.map((u) => (
                  <Chip key={u} selected={useOfFunds.includes(u)} onClick={() => toggleFund(u)}>
                    {u}
                  </Chip>
                ))}
              </div>
              <p className="mt-6 mb-3 text-sm font-semibold text-slate-700">When are you looking to close?</p>
              <div className="space-y-2">
                {TIMELINES.map((t) => (
                  <OptionCard
                    key={t.id}
                    selected={timeline === t.id}
                    onClick={() => setTimeline(t.id)}
                    label={t.label}
                    sub={t.sub}
                  />
                ))}
              </div>
              <ContextCard>
                Founders who start 6+ months before their target close date are 2× more likely to successfully close a round. The earlier you build pipeline, the more leverage you have in negotiations.
              </ContextCard>
            </>
          ) : null}
        </div>

        {/* Navigation */}
        {err ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>
        ) : null}

        <div className="mt-8 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as StepNum)}
              className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            disabled={!canAdvance() || saving}
            onClick={() => void handleNext()}
            className="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#534AB7,#7c3aed)" }}
          >
            {saving
              ? "Saving…"
              : step === TOTAL
              ? "Finish →"
              : "Continue →"}
          </button>
        </div>
      </div>
    </>
  );
}
