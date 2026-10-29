"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { Company } from "@/lib/supabase/types";
import { AIFieldHelper } from "@/components/ui/AIFieldHelper";
import {
  USE_OF_FUNDS_OPTIONS as FUND_USES,
  INVESTOR_TYPE_OPTIONS as INVESTOR_TYPE_OPTS,
  CAPITAL_TYPE_OPTIONS as CAPITAL_TYPE_OPTS,
  INVESTOR_PREFERENCE_OPTIONS as INVESTOR_PREF_OPTS,
  BUSINESS_ENTITY_OPTIONS as BUSINESS_ENTITY_OPTS,
  FUNDING_STAGE_OPTIONS as FUNDING_STAGE_OPTS,
  OPERATING_STAGE_OPTIONS as OPERATING_STAGE_OPTS,
  moneyBandFor,
  isMoneyBand,
} from "@/lib/profile/options";
import { useVocabularies, useVocabulary } from "@/lib/vocabulary/provider";
import { offered, type VocabularyOption } from "@/lib/vocabulary/lists";
import { SKIPPABLE_STEPS, type ResolvedSurface } from "@/lib/profile-fields/display";
import { nextQuestion, previousQuestion, questionPosition, type QuestionNum } from "@/lib/onboarding/question-order";
import { founderMeter, type Meter } from "@/lib/matching/matchable-points";
import type { EngineWeights } from "@/lib/matching/investor-company-matching";
import { MatchablePointsMeter, ReadByPersonBadge } from "@/components/matching/MatchablePointsMeter";
import { saveCapitalStructureInline } from "@/app/founder/onboarding/capital-structure-action";
import type { OfferingType } from "@/lib/onboarding/offering-type-schema";
import { INDUSTRY_MAX, joinIndustries, splitIndustries } from "@/lib/industry/list";

/* ─────────────────────────── data ─────────────────────────── */

// Option lists shared with the Company Profile settings form + matching inputs
// live in @/lib/profile/options. Industries come from the stored list (the same
// one every other picker reads); timelines stay local to onboarding.

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
  if (opts.amount) s += 10;
  if (opts.description.trim().length >= 20) s += 15;
  if (opts.useOfFunds.length > 0) s += 10;
  return Math.min(s, 100);
}

/* ─────────────────────── sub-components ───────────────────── */

function ContextCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 rounded-xl px-4 py-3.5 text-sm leading-6" style={{ background: "#EEEDFE", color: "#1A6CE4" }}>
      {children}
    </div>
  );
}

/* ── Dropdown fields: one look for every list in the wizard ── */

export type DDOpt = { value: string; label: string; sub?: string };

const DD_BTN =
  "flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-base font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const DD_LIST =
  "absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg";

/** Closes an open dropdown on a click outside it or on Escape. */
function useCloseOutside(open: boolean, setOpen: (v: boolean) => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("touchstart", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("touchstart", down);
      document.removeEventListener("keydown", key);
    };
  }, [open, setOpen]);
  return ref;
}

function Caret({ open }: { open: boolean }) {
  return <i aria-hidden="true" className={`ti ${open ? "ti-chevron-up" : "ti-chevron-down"} text-slate-400`} />;
}

/** Pick one. Closed, it shows the chosen label or the placeholder; open, the chosen row carries a check.
 *  `allowClear` lets a tap on the chosen row unselect it, for optional fields. */
function SelectField({
  value, options, onChange, placeholder, ariaLabel, allowClear = false, className = "mt-2",
}: {
  value: string | null;
  options: DDOpt[];
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
  allowClear?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useCloseOutside(open, setOpen);
  const current = options.find((o) => o.value === value);
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} className={DD_BTN} onClick={() => setOpen((o) => !o)}>
        <span className={current ? "" : "font-normal text-slate-400"}>{current ? current.label : placeholder}</span>
        <Caret open={open} />
      </button>
      {open ? (
        <ul role="listbox" aria-label={ariaLabel} className={DD_LIST}>
          {options.map((o) => {
            const on = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={on}>
                <button
                  type="button"
                  className={"flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50 " + (on ? "bg-indigo-50 text-indigo-700" : "text-slate-800")}
                  onClick={() => { onChange(allowClear && on ? "" : o.value); setOpen(false); }}
                >
                  <span>
                    <span className="font-medium">{o.label}</span>
                    {o.sub ? <span className="mt-0.5 block text-xs text-slate-400">{o.sub}</span> : null}
                  </span>
                  {on ? <i aria-hidden="true" className="ti ti-check mt-0.5 flex-none" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** Pick several. Rows carry checkboxes and stay open while ticking; the button reads "N selected"
 *  and the chosen values also appear below as removable tags. Shared with the Industry
 *  pickers on founder settings and the admin company editors. With `max`, unchecked rows
 *  stop being selectable once that many are ticked and `maxHint` (or a generic line) says so. */
export function MultiSelectField({
  values, options, onToggle, ariaLabel, placeholder, className = "mt-2", max, maxHint,
}: {
  values: string[];
  options: DDOpt[];
  onToggle: (v: string) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  max?: number;
  maxHint?: string;
}) {
  const t = useTranslations("founderCmp");
  const [open, setOpen] = useState(false);
  const ref = useCloseOutside(open, setOpen);
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const atMax = max != null && values.length >= max;
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} className={DD_BTN} onClick={() => setOpen((o) => !o)}>
        <span className={values.length ? "" : "font-normal text-slate-400"}>
          {values.length ? t("dd_n_selected", { count: values.length }) : (placeholder ?? t("dd_select_all_that_apply"))}
        </span>
        <Caret open={open} />
      </button>
      {open ? (
        <ul role="listbox" aria-multiselectable="true" aria-label={ariaLabel} className={DD_LIST}>
          {options.map((o) => {
            const on = values.includes(o.value);
            const blocked = atMax && !on;
            return (
              <li key={o.value} role="option" aria-selected={on} aria-disabled={blocked || undefined}>
                <button
                  type="button"
                  disabled={blocked}
                  className={"flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm " + (on ? "bg-indigo-50 text-indigo-700" : blocked ? "cursor-not-allowed text-slate-400" : "text-slate-800 hover:bg-slate-50")}
                  onClick={() => onToggle(o.value)}
                >
                  <span aria-hidden="true" className={"flex h-4 w-4 flex-none items-center justify-center rounded border text-[10px] " + (on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300")}>
                    {on ? <i className="ti ti-check" /> : null}
                  </span>
                  <span className="font-medium">{o.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {atMax ? <p className="mt-1.5 text-xs text-slate-500">{maxHint ?? t("dd_up_to_n_selections", { count: max })}</p> : null}
      {values.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onToggle(v)}
              aria-label={t("dd_remove", { label: labelOf(v) })}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
            >
              {labelOf(v)} <i aria-hidden="true" className="ti ti-x" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const plainOpts = (list: readonly string[]): DDOpt[] => list.map((v) => ({ value: v, label: v }));
const vocabOpts = (list: VocabularyOption[]): DDOpt[] => list.map((o) => ({ value: o.slug, label: o.label, sub: o.description ?? undefined }));

function ScoreRing({ score }: { score: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={100} height={100} viewBox="0 0 100 100">
      <circle cx={50} cy={50} r={r} fill="none" stroke="#e2e8f0" strokeWidth={8} />
      <circle
        cx={50} cy={50} r={r} fill="none"
        stroke="#2E78F5" strokeWidth={8}
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

type StepNum = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
// 8 is Traction (the last question); 9 is the done screen, which is why TOTAL
// stops at 8 — the progress bar should never count the confirmation as a step.
const TOTAL = 8;

// Asked in QUESTION_ORDER: scored questions first, prose last. Question
// numbers are unchanged, so canAdvance, SKIPPABLE_STEPS and the save are too.
/** Meter rows keyed by the Profile and fields key that hides them. */
const METER_FIELD_KEYS: Record<string, string | null> = {
  Industry: null,
  Stage: "funding_stage",
  "Amount of capital": "funding_amount_band",
  "Headquarters location": null,
  "Seeking investor type": "seeking_investor_types",
  "Seeking capital type": "seeking_capital_types",
  ARR: "arr",
  MRR: "mrr",
};

const HIGHLIGHT_PLACEHOLDERS = [
  "Pilot line running at 400 units/month",
  "Two LOIs signed with tier-1 manufacturers",
  "US patent granted",
  "",
  "",
];

export function FounderConversationalOnboarding({
  company,
  founderName,
  display,
  engineWeights,
  showCapitalStructure = false,
  initialOfferingType = null,
}: Readonly<{
  company: Company;
  founderName: string;
  /** Shown and Required per field, from Admin, Profile and fields. Absent means today's behaviour. */
  display?: ResolvedSurface;
  /** The matching engine's weights, for the matchable points meter. Absent hides the meter. */
  engineWeights?: EngineWeights;
  /** Adds the optional Capital structure select to the amount step. Off unless the page turns it on. */
  showCapitalStructure?: boolean;
  /** The attested capital structure already on the company, if any. */
  initialOfferingType?: OfferingType | null;
}>) {
  /** Whether a managed field is asked. */
  const shows = (key: string) => display?.[key]?.shown !== false;
  /** Whether a managed field must be answered; `base` is its built in rule. */
  const needs = (key: string, base: boolean) => shows(key) && (display?.[key]?.required ?? base);
  /** A step is skipped when its only question is hidden. */
  const skipped = (n: number) => Boolean(SKIPPABLE_STEPS[n]) && !shows(SKIPPABLE_STEPS[n]);
  const star = (key: string, base: boolean) => (needs(key, base) ? <span className="text-rose-600">*</span> : <span className="font-normal text-slate-400">· optional</span>);
  // Option lists edited on Admin, Profile and fields (built in lists if not provided).
  const vocab = useVocabularies();
  const menu = (all: VocabularyOption[], held: string | null): VocabularyOption[] =>
    [...offered(all), ...all.filter((o) => o.archived && o.slug === held)];
  const t = useTranslations("founderCmp");
  // Capital structure (optional, amount step). Saved only with the attestation ticked.
  const [offeringType, setOfferingType] = useState<OfferingType | "">(initialOfferingType ?? "");
  const [offeringAttested, setOfferingAttested] = useState<boolean>(Boolean(initialOfferingType));
  const router = useRouter();
  const [step, setStep]             = useState<StepNum>(1);
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState<string | null>(null);

  const [companyName, setCompanyName] = useState(company.company_name ?? "");
  const [phone, setPhone]             = useState(company.contact_phone ?? "");
  // Industries are stored as one comma separated list; the wizard edits them as an array.
  const [industries, setIndustries]   = useState<string[]>(() => splitIndustries(company.industry));
  // Offered values, plus whatever this company already holds, so a founder
  // whose value was since retired still sees their answer.
  const { options: industryOptions } = useVocabulary("industry", industries);
  // The stored form, for the meter, the score and the description draft.
  const industryText = industries.length ? joinIndustries(industries) : null;
  const [stage, setStage]             = useState<string | null>(company.revenue_stage ?? null);
  // Amount of capital as one of the money bands: the stored band, else the band an
  // existing exact amount falls in.
  const [amount, setAmount]           = useState<string>(() => {
    const stored = (company as unknown as Record<string, unknown>).funding_amount_band;
    return isMoneyBand(stored) ? stored : (moneyBandFor(company.funding_amount ?? null) ?? "");
  });
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

  // Seeking + Company & stage (columns added in migration 20260803002; not yet in
  // the generated Company type, so read via a Record view).
  const cx = company as unknown as Record<string, unknown>;
  const splitCsv = (v: unknown): string[] =>
    typeof v === "string" && v.trim() ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const [invTypes, setInvTypes]       = useState<string[]>(splitCsv(cx.seeking_investor_types));
  const [capTypes, setCapTypes]       = useState<string[]>(splitCsv(cx.seeking_capital_types));
  const [invPref, setInvPref]         = useState<string[]>(splitCsv(cx.active_investor_preference));
  const [fundingStage, setFundingStage] = useState<string[]>(splitCsv(cx.funding_stage));
  const [opStage, setOpStage]         = useState<string[]>(splitCsv(cx.operating_stage));
  const [bizEntity, setBizEntity]     = useState<string | null>(typeof cx.business_entity === "string" ? cx.business_entity : null);
  // Only a stored value that is one of the bands pre-selects a chip.
  const [ebitda, setEbitda]           = useState(isMoneyBand(cx.annual_ebitda) ? cx.annual_ebitda : "");
  const [mgmtTeam, setMgmtTeam]       = useState(typeof cx.management_team === "string" ? cx.management_team : "");
  // Traction (step 8). All optional: forcing a number here would make
  // pre-revenue founders invent one, and the CRR engine would then score fiction.
  const [revSize, setRevSize]         = useState<string | null>(typeof cx.annual_revenue_size === "string" && cx.annual_revenue_size ? cx.annual_revenue_size : null);
  // Pre-select only a stored value that is on the list; a typed legacy value is kept on the record untouched.
  const [arr, setArr]                 = useState(typeof cx.arr === "string" && vocab.arr_band.some((o) => o.slug === cx.arr) ? cx.arr : "");
  const [mrr, setMrr]                 = useState(typeof cx.mrr === "string" && vocab.mrr_band.some((o) => o.slug === cx.mrr) ? cx.mrr : "");
  const [highlights, setHighlights]   = useState<string[]>(() => {
    const raw = typeof cx.key_highlights === "string" ? cx.key_highlights : "";
    const rows = raw.split("\n").map((r) => r.trim());
    return [0, 1, 2, 3, 4].map((i) => rows[i] ?? "");
  });

  function toggleFund(label: string) {
    setUseOfFunds((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label],
    );
  }
  const toggleIn = (setter: React.Dispatch<React.SetStateAction<string[]>>, val: string) =>
    setter((prev) => (prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]));

  function canAdvance(): boolean {
    switch (step) {
      case 1: return companyName.trim().length >= 2 && isValidPhone(phone) && country.trim().length >= 2;
      case 2: return industries.length > 0;
      case 3: return !needs("revenue_stage", true) || Boolean(stage);
      case 4:
        return (
          (!needs("funding_amount_band", true) || isMoneyBand(amount)) &&
          (!showCapitalStructure || !offeringType || offeringAttested)
        );
      case 5: return description.trim().length >= 20;
      case 6: return !needs("use_of_funds", false) || useOfFunds.length > 0;
      case 7:
        // Active investor preference and management team are not managed on
        // Profile and fields, so they keep their built in requirement.
        return (
          (!needs("seeking_investor_types", true) || invTypes.length > 0) &&
          (!needs("seeking_capital_types", true) || capTypes.length > 0) &&
          invPref.length > 0 &&
          (!needs("business_entity", true) || Boolean(bizEntity)) &&
          (!needs("funding_stage", true) || fundingStage.length > 0) &&
          (!needs("operating_stage", true) || opStage.length > 0) &&
          (!needs("annual_ebitda", true) || isMoneyBand(ebitda)) &&
          mgmtTeam.trim().length > 0
        );
      // Step 8 is optional by default; Profile and fields can require a field.
      case 8:
        return (
          (!needs("annual_revenue_size", false) || Boolean(revSize)) &&
          (!needs("arr", false) || Boolean(arr)) &&
          (!needs("mrr", false) || Boolean(mrr))
        );
      default: return true;
    }
  }

  async function handleNext() {
    const next = nextQuestion(step as QuestionNum, skipped);
    if (next !== null) {
      setStep(next);
      return;
    }
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
          industry: joinIndustries(industries),
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
          funding_amount_band: amount,
          revenue_stage: stage ?? "",
          use_of_funds: useOfFunds.join(", "),
          // Seeking + Company & stage (step 7)
          seeking_investor_types: invTypes.join(", "),
          seeking_capital_types: capTypes.join(", "),
          active_investor_preference: invPref.join(", "),
          funding_stage: fundingStage.join(", "),
          operating_stage: opStage.join(", "),
          business_entity: bizEntity ?? "",
          annual_ebitda: ebitda,
          management_team: mgmtTeam.trim(),
          // Traction (step 8)
          annual_revenue_size: revSize ?? "",
          arr: arr.trim(),
          mrr: mrr.trim(),
          key_highlights: highlights.map((h) => h.trim()).filter(Boolean).join("\n"),
        }),
      });
      if (!r2.ok) throw new Error("Could not save funding information.");

      // Capital structure is optional and never blocks onboarding. If this save
      // fails the founder is asked again by the existing Capital structure prompt.
      if (showCapitalStructure && offeringType && offeringAttested && offeringType !== initialOfferingType) {
        await saveCapitalStructureInline({ offeringType, attested: true }).catch(() => undefined);
      }

      setStep(9);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  // The meter: a point shown is a point the matcher scores. Rows for fields
  // hidden on Profile and fields are left out, since they cannot be answered.
  const meter: Meter | null = useMemo(() => {
    if (!engineWeights) return null;
    const full = founderMeter(
      {
        industry: industryText,
        stages: fundingStage,
        amountBand: amount || null,
        country,
        state: companyState,
        seekingInvestorTypes: invTypes,
        seekingCapitalTypes: capTypes,
        arr: arr || null,
        mrr: mrr || null,
      },
      engineWeights,
    );
    const rows = full.rows.filter((r) => {
      const key = METER_FIELD_KEYS[r.label];
      return !key || shows(key);
    });
    return {
      rows,
      answeredPoints: rows.reduce((n, r) => n + (r.answered ? r.weight : 0), 0),
      totalPoints: rows.reduce((n, r) => n + r.weight, 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineWeights, industryText, fundingStage, amount, country, companyState, invTypes, capTypes, arr, mrr, display]);
  const position = step === 9 ? TOTAL : questionPosition(step);

  const firstName = founderName.split(" ")[0] || founderName;
  const actionPlan = computeActionPlan({ stage, amount, timeline });
  const score      = computeScore({ name: companyName, industry: industryText, stage, amount, description, useOfFunds });

  /* ─── Done screen ─── */
  if (step === 9) {
    return (
      <>
        <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <div style={{ animation: "fadeUp 0.3s ease both" }} className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-3xl mb-5"
              style={{ background: "#EEEDFE" }}
            >
              <i className="ti ti-circle-check" aria-hidden="true" />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <i className="ti ti-check" aria-hidden="true" /> Stage 1 complete
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
                Completion
              </p>
              <p className="mt-1 text-xs text-slate-400 max-w-[220px]">
                Your Stage 2 progress. Add your documents and complete the readiness checklist to raise it.
              </p>
            </div>
          </div>

          <div className="mt-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{t("your_next_steps_in_stage_2")}</p>
            <div className="space-y-3">
              {actionPlan.map((action, i) => (
                <div
                  key={action}
                  className="flex items-start gap-3 rounded-xl px-4 py-3"
                  style={{ background: "#F8F7FD" }}
                >
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white mt-0.5"
                    style={{ background: "#2E78F5" }}
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
              style={{ background: "linear-gradient(135deg,#2E78F5,#7c3aed)" }}
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

      <div className={meter ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start" : ""}>
      {meter ? (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] lg:hidden" aria-label="Matchable points">
          <span className="text-slate-500">Matchable points</span>
          <span className="font-semibold text-[#0A1A40]">{meter.answeredPoints} of {meter.totalPoints}</span>
          <div className="h-1.5 flex-1 rounded-full bg-slate-200" aria-hidden="true">
            <div className="h-1.5 rounded-full bg-[#1A6CE4]" style={{ width: `${meter.totalPoints ? Math.round((meter.answeredPoints / meter.totalPoints) * 100) : 0}%` }} />
          </div>
        </div>
      ) : null}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        {/* Progress */}
        <div className="mb-8 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Step {position} of {TOTAL}
          </p>
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL }, (_, i) => (
              <div
                key={i}
                style={{
                  width: i + 1 <= position ? 20 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: i + 1 <= position ? "#2E78F5" : "#e2e8f0",
                  transition: "all 0.3s ease",
                  opacity: i + 1 <= position ? 1 : 0.5,
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
              <p className="mt-1 text-sm text-slate-500">{t("we_ll_use_this_to_personalise_your_experienc")}</p>
              <input
                autoFocus
                className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                placeholder={t("e_g_acme_labs")}
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
                placeholder={t("e_g_1_555_123_4567")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && canAdvance()) void handleNext(); }}
                aria-required="true"
              />
              {phone.trim().length > 0 && !isValidPhone(phone) ? (
                <p className="mt-1.5 text-xs text-rose-600">{t("enter_a_valid_phone_number_7_15_digits")}</p>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Country <span className="text-rose-600">*</span>
                  </label>
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    placeholder={t("e_g_united_states")}
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    aria-required="true"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">{t("state_province")}</label>
                  <input
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    placeholder={t("e_g_california")}
                    value={companyState}
                    onChange={(e) => setCompanyState(e.target.value)}
                  />
                </div>
              </div>

              <label className="mt-4 block text-sm font-medium text-slate-700">{t("country_of_incorporation")}</label>
              <input
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                placeholder={t("e_g_delaware_c_corp_uk_ltd_singapore_pte")}
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
                {t("what_industries_are_you_in")}
              </p>
              <p className="mt-1 text-sm text-slate-500">{t("select_all_that_apply_we_use_this_to_target")}</p>
              <MultiSelectField
                className="mt-5"
                ariaLabel={t("industry")}
                values={industries}
                options={[
                  ...industryOptions.map((o) => ({ value: o.label, label: o.label })),
                  // A value this company already holds that is no longer on the list stays visible and removable.
                  ...industries.filter((v) => !industryOptions.some((o) => o.label === v)).map((v) => ({ value: v, label: v })),
                ]}
                onToggle={(v) => toggleIn(setIndustries, v)}
                max={INDUSTRY_MAX}
                maxHint={t("dd_up_to_n_industries", { count: INDUSTRY_MAX })}
              />
              <ContextCard>
                Industry matching is one of the strongest signals our algorithm uses. Investors who back companies in your sector already understand your market — they move faster and ask better questions.
              </ContextCard>
            </>
          ) : step === 3 ? (
            <>
              <p className="text-2xl font-semibold tracking-tight text-slate-900">
                What stage is your company at right now?
              </p>
              <p className="mt-1 text-sm text-slate-500">{t("this_calibrates_the_benchmarks_and_investor")}</p>
              <SelectField
                className="mt-5"
                ariaLabel={t("dd_aria_revenue_stage")}
                placeholder={t("dd_select_stage")}
                value={stage}
                options={vocabOpts(menu(vocab.revenue_stage, stage))}
                onChange={setStage}
              />
              <ContextCard>
                Most founders on iCapOS are raising at Pre-revenue or Early revenue stage. Knowing your stage helps us surface stage-appropriate investors — ones who already back companies like yours.
              </ContextCard>
            </>
          ) : step === 4 ? (
            <>
              <p className="text-2xl font-semibold tracking-tight text-slate-900">
                How much are you looking to raise?
              </p>
              <p className="mt-1 text-sm text-slate-500">Pick the range for the total target of this round, in USD.</p>
              <SelectField
                className="mt-5"
                ariaLabel={t("dd_aria_amount_to_raise")}
                placeholder={t("dd_select_range")}
                value={amount || null}
                options={vocabOpts(menu(vocab.money_band, amount))}
                onChange={setAmount}
              />
              {showCapitalStructure ? (
                <div className="mt-6">
                  <label htmlFor="capital-structure" className="block text-sm font-semibold text-slate-700">
                    {t("cs_label")} <span className="font-normal text-slate-400">· {t("cs_optional")}</span>
                  </label>
                  <select
                    id="capital-structure"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    value={offeringType}
                    onChange={(e) => {
                      const v = e.target.value as OfferingType | "";
                      setOfferingType(v);
                      if (!v) setOfferingAttested(false);
                    }}
                  >
                    <option value="">{t("cs_placeholder")}</option>
                    <option value="reg_d_506b">{t("cs_506b_title")}</option>
                    <option value="reg_d_506c">{t("cs_506c_title")}</option>
                    <option value="not_raising">{t("cs_none_title")}</option>
                  </select>
                  {offeringType ? (
                    <>
                      <p className="mt-2 text-xs text-slate-500">
                        {offeringType === "reg_d_506b" ? t("cs_506b_desc") : offeringType === "reg_d_506c" ? t("cs_506c_desc") : t("cs_none_desc")}
                      </p>
                      {offeringType !== "not_raising" ? (
                        <p className="mt-3 rounded-lg border-l-4 border-blue-600 bg-blue-50 px-3 py-2 text-xs text-slate-700">{t("cs_private_note")}</p>
                      ) : null}
                      <label className="mt-3 flex items-start gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={offeringAttested}
                          onChange={(e) => setOfferingAttested(e.target.checked)}
                        />
                        <span>{t("cs_attest")}</span>
                      </label>
                      {!offeringAttested ? <p className="mt-1 text-xs text-amber-700">{t("cs_attest_needed")}</p> : null}
                    </>
                  ) : null}
                  <details className="mt-3 text-xs text-slate-600">
                    <summary className="cursor-pointer text-blue-600">{t("cs_not_sure")}</summary>
                    <p className="mt-1">{t("cs_counsel")}</p>
                  </details>
                </div>
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
              <div className="mt-2"><ReadByPersonBadge /></div>
              <p className="mt-1 text-sm text-slate-500">2–3 sentences is all you need. Lead with the problem you solve.</p>
              <textarea
                autoFocus
                rows={4}
                className="mt-5 w-full resize-none rounded-xl border border-slate-200 px-4 py-3.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                placeholder={t("e_g_we_help_smb_operators_cut_payroll_proces")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <AIFieldHelper
                benchmark="Investors spend ~8 seconds reading company descriptions. Lead with the problem you solve — not how you solve it. Replace each [bracket] with your specifics, then trim to 3–4 tight sentences."
                draft={generateOnboardingDraft({ companyName, industry: industryText, stage })}
                onInsert={(text) => setDescription(text)}
              />
            </>
          ) : step === 6 ? (
            <>
              <p className="text-2xl font-semibold tracking-tight text-slate-900">
                What will you use this funding for?
              </p>
              <div className="mt-2"><ReadByPersonBadge /></div>
              <p className="mt-1 text-sm text-slate-500">{t("select_all_that_apply_then_tell_us_your_time")}</p>
              {shows("use_of_funds") ? (
                <MultiSelectField
                  className="mt-5"
                  ariaLabel={t("dd_aria_use_of_funds")}
                  values={useOfFunds}
                  options={plainOpts(FUND_USES)}
                  onToggle={toggleFund}
                />
              ) : null}
              <p className="mt-6 mb-3 text-sm font-semibold text-slate-700">{t("when_are_you_looking_to_close")}</p>
              <SelectField
                className=""
                ariaLabel={t("dd_aria_close_timeline")}
                placeholder={t("dd_select_timeline")}
                value={timeline}
                options={TIMELINES.map((x) => ({ value: x.id, label: x.label, sub: x.sub }))}
                onChange={setTimeline}
              />
              <ContextCard>
                Founders who start 6+ months before their target close date are 2× more likely to successfully close a round. The earlier you build pipeline, the more leverage you have in negotiations.
              </ContextCard>
            </>
          ) : step === 7 ? (
            <>
              <p className="text-2xl font-semibold tracking-tight text-slate-900">
                Who you&apos;re raising from, and where you are
              </p>
              <p className="mt-1 text-sm text-slate-500">Select all that apply. This sharpens your investor matches and your Preparation completeness.</p>

              <p className="mt-6 mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Seeking</p>
              {shows("seeking_investor_types") ? (
                <>
              <label className="block text-sm font-medium text-slate-700">Type of investor(s) {star("seeking_investor_types", true)}</label>
              <MultiSelectField ariaLabel={t("dd_aria_investor_types")} values={invTypes} options={plainOpts(INVESTOR_TYPE_OPTS)} onToggle={(v) => toggleIn(setInvTypes, v)} />
                </>
              ) : null}
              {shows("seeking_capital_types") ? (
                <>
              <label className="mt-4 block text-sm font-medium text-slate-700">Type(s) of capital {star("seeking_capital_types", true)}</label>
              <MultiSelectField ariaLabel={t("dd_aria_capital_types")} values={capTypes} options={plainOpts(CAPITAL_TYPE_OPTS)} onToggle={(v) => toggleIn(setCapTypes, v)} />
                </>
              ) : null}
              <label className="mt-4 block text-sm font-medium text-slate-700">Active investor preference <span className="text-rose-600">*</span></label>
              <MultiSelectField ariaLabel={t("dd_aria_investor_preference")} values={invPref} options={plainOpts(INVESTOR_PREF_OPTS)} onToggle={(v) => toggleIn(setInvPref, v)} />
              {shows("business_entity") ? (
                <>
              <label className="mt-4 block text-sm font-medium text-slate-700">Business entity {star("business_entity", true)} <span className="font-normal text-slate-400">(pick one)</span></label>
              <SelectField ariaLabel={t("dd_aria_business_entity")} placeholder={t("dd_select_entity")} value={bizEntity} options={plainOpts(BUSINESS_ENTITY_OPTS)} onChange={setBizEntity} />
                </>
              ) : null}

              <p className="mt-7 mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Company &amp; stage</p>
              {shows("funding_stage") ? (
                <>
              <label className="block text-sm font-medium text-slate-700">Funding stage {star("funding_stage", true)}</label>
              <MultiSelectField ariaLabel={t("dd_aria_funding_stage")} values={fundingStage} options={plainOpts(FUNDING_STAGE_OPTS)} onToggle={(v) => toggleIn(setFundingStage, v)} />
                </>
              ) : null}
              {shows("operating_stage") ? (
                <>
              <label className="mt-4 block text-sm font-medium text-slate-700">Operating stage {star("operating_stage", true)}</label>
              <MultiSelectField ariaLabel={t("dd_aria_operating_stage")} values={opStage} options={plainOpts(OPERATING_STAGE_OPTS)} onToggle={(v) => toggleIn(setOpStage, v)} />
                </>
              ) : null}
              {shows("annual_ebitda") ? (
                <>
              <label className="mt-4 block text-sm font-medium text-slate-700">Annual EBITDA {star("annual_ebitda", true)} <span className="font-normal text-slate-400">(pick one)</span></label>
              <SelectField ariaLabel={t("dd_aria_annual_ebitda")} placeholder={t("dd_select_range")} value={ebitda || null} options={vocabOpts(menu(vocab.money_band, ebitda))} onChange={setEbitda} />
              <p className="mt-1.5 text-xs text-slate-400">Current EBITDA only, not projected.</p>
                </>
              ) : null}
              <div className="mt-4">
                <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">Management team <span className="text-rose-600">*</span> <ReadByPersonBadge /></label>
                <input
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  placeholder="e.g. 2 co-founders, 3 full-time"
                  value={mgmtTeam}
                  onChange={(e) => setMgmtTeam(e.target.value)}
                />
              </div>

              <ContextCard>
                Investors filter hard on these. Getting your capital type, stage, and entity right means we only surface investors whose mandate actually fits — fewer, better conversations.
              </ContextCard>
            </>
          ) : step === 8 ? (
            <>
              <p className="text-2xl font-semibold tracking-tight text-slate-900">Your numbers</p>
              <p className="mt-1 text-sm text-slate-500">
                Investors look at these first. Leave anything blank if it doesn&apos;t apply — a blank is better than a guess.
              </p>

              {/* Say what's public before they type it, not after. */}
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-emerald-900">
                <i className="ti ti-eye mt-0.5" aria-hidden="true" />
                <span>
                  Revenue and highlights appear on your <b>investor one-pager</b>.{" "}
                  <b>EBITDA and your team summary stay internal</b> — staff and your own dashboard only.
                </span>
              </div>

              {shows("annual_revenue_size") ? (
                <>
                  <label className="mt-6 block text-sm font-medium text-slate-700">
                    Annual revenue size <span className="font-normal text-slate-400">· last 12 months</span> {needs("annual_revenue_size", false) ? <span className="text-rose-600">*</span> : null}
                  </label>
                  <SelectField ariaLabel={t("dd_aria_annual_revenue_size")} placeholder={t("dd_select_range")} allowClear value={revSize} options={vocabOpts(menu(vocab.revenue_size, revSize))} onChange={(v) => setRevSize(v || null)} />
                </>
              ) : null}

              {/* ARR and MRR: pick one from their lists, the same chips as founder settings. */}
              {shows("arr") ? (
                <>
                  <label className="mt-5 block text-sm font-medium text-slate-700">ARR {star("arr", false)}</label>
                  <SelectField ariaLabel={t("dd_aria_arr")} placeholder={t("dd_select_range")} allowClear value={arr || null} options={vocabOpts(menu(vocab.arr_band, arr))} onChange={setArr} />
                  <p className="mt-1 text-xs text-slate-400">Subscription or contracted revenue only.</p>
                </>
              ) : null}
              {shows("mrr") ? (
                <>
                  <label className="mt-5 block text-sm font-medium text-slate-700">MRR {star("mrr", false)}</label>
                  <SelectField ariaLabel={t("dd_aria_mrr")} placeholder={t("dd_select_range")} allowClear value={mrr || null} options={vocabOpts(menu(vocab.mrr_band, mrr))} onChange={setMrr} />
                  <p className="mt-1 text-xs text-slate-400">Leave blank if you have no recurring revenue.</p>
                </>
              ) : null}

              <label className="mt-5 block text-sm font-medium text-slate-700">
                Five key highlights <span className="font-normal text-slate-400">· what makes this fundable</span>
              </label>
              <div className="mt-2 space-y-2">
                {highlights.map((h, i) => (
                  <div key={`hl-${i}`} className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-600">
                      {i + 1}
                    </span>
                    <input
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      placeholder={HIGHLIGHT_PLACEHOLDERS[i]}
                      value={h}
                      onChange={(e) => setHighlights((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-400">These become the bullet list on your one-pager. Three is enough to start.</p>

              <ContextCard>
                These are the numbers the readiness engine scores your Traction and Revenue on. Leaving them blank
                doesn&apos;t hurt your score any more than a low number would — but an invented one will, once an
                investor asks about it.
              </ContextCard>
            </>
          ) : null}
        </div>

        {/* Navigation */}
        {err ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>
        ) : null}

        <div className="mt-8 flex items-center justify-between">
          {position > 1 ? (
            <button
              type="button"
              onClick={() => {
                const prev = previousQuestion(step as QuestionNum, skipped);
                if (prev !== null) setStep(prev);
              }}
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
            style={{ background: "linear-gradient(135deg,#2E78F5,#7c3aed)" }}
          >
            {saving
              ? "Saving…"
              : position === TOTAL
              ? "Finish →"
              : "Continue →"}
          </button>
        </div>
      </div>
      {meter ? <MatchablePointsMeter meter={meter} className="hidden lg:sticky lg:top-6 lg:block" /> : null}
      </div>
    </>
  );
}
