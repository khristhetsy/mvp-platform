// Valuation Studio — advisor prompt, response contract, validation, sample mode.
// Server-only helpers (no API key here; the route calls claudeComplete). The
// advisor tells a founder what to change in the BUSINESS to move the range — it
// never recommends a price. Guardrails from compliance appendix §6.

import { findBannedTerm } from "@/lib/valuation/compliance";

export type Lever = {
  title: string;
  diagnosis: string;
  action: string;
  methods: string[];
  upliftLow: number;
  upliftHigh: number;
  effort: "Low" | "Medium" | "High";
  timeframe: string;
};

export type Advice = {
  read: string;
  spread: string;
  caution: string;
  levers: Lever[];
};

export type AdvisePayload = {
  stage: string;
  sector: string;
  convergedRange: [number, number];
  methods: { method: string; low: number; high: number; basis: string }[];
  drivers: Record<string, unknown>;
  provenance?: Record<string, "profile" | "manual">;
};

/** System prompt with the appendix §6 guardrails baked in. */
export const ADVISOR_SYSTEM = [
  "You are a valuation advisor inside iCapOS, a founder capital-readiness platform.",
  "A founder has run a multi-method valuation. Tell them what to change in the BUSINESS to move the range up — never re-run the math and never recommend a price.",
  "Hard rules:",
  "- Never state or recommend a price, share price, or a pre-money to raise at. Levers describe business changes only.",
  "- Never predict investor behavior as certainty. 'A lead will typically anchor on' is fine; 'investors will pay' is not.",
  "- Never reference specific funds, firms, or individuals.",
  "- Never suggest changing an input to raise the number without the underlying business change. 'Improve retention so the multiple is defensible' is right; 'put in a higher multiple' is wrong.",
  "- Uplift figures are modeled percentage lifts to the range, not promised returns.",
  "- Do not use the words: certified, appraisal, fairness opinion, opinion of value, valuation report, 409A, guaranteed.",
  "Return ONLY a JSON object, no preamble, no markdown fences.",
].join("\n");

/** The user message: the snapshot plus the exact response contract. */
export function buildAdvicePrompt(payload: AdvisePayload): string {
  return `Valuation snapshot:
${JSON.stringify(payload, null, 2)}

Return a JSON object matching exactly:
{
  "read": "2-3 sentences on what is currently driving and capping this range. Name the specific weakest input.",
  "spread": "1-2 sentences on why the methods disagree (or agree) and what that means for negotiation.",
  "levers": [
    {
      "title": "short imperative lever name",
      "diagnosis": "what specifically is weak now, referencing the actual numbers above",
      "action": "the concrete thing to do, specific enough to start this week",
      "methods": ["which valuation methods this moves"],
      "upliftLow": 8,
      "upliftHigh": 20,
      "effort": "Low",
      "timeframe": "e.g. 30 days, one quarter"
    }
  ],
  "caution": "one sentence on any input above that looks aggressive and would not survive investor diligence"
}

Give exactly 5 levers, ordered by valuation impact per unit of effort, highest first. upliftLow/upliftHigh are modeled percentage lifts (numbers under 100). Be specific to this stage and these numbers. No generic advice like "improve your team".`;
}

type ValidationResult =
  | { ok: true; advice: Advice }
  | { ok: false; reason: string; bannedTerm?: string };

/**
 * Parse and validate advisor output against the contract + guardrails.
 * Fails closed: exactly five levers, required fields present, numeric uplift
 * under 100, and no banned term anywhere. Returns the offending term so the
 * caller can regenerate once before falling back to a safe message.
 */
export function validateAdvice(raw: string): ValidationResult {
  let parsed: unknown;
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(clean);
  } catch {
    return { ok: false, reason: "not-json" };
  }

  const a = parsed as Partial<Advice> & { levers?: unknown };
  if (typeof a.read !== "string" || typeof a.spread !== "string" || typeof a.caution !== "string") {
    return { ok: false, reason: "missing-fields" };
  }
  if (!Array.isArray(a.levers) || a.levers.length !== 5) {
    return { ok: false, reason: "lever-count" };
  }

  const levers: Lever[] = [];
  for (const l of a.levers as unknown[]) {
    const lv = l as Partial<Lever>;
    if (
      typeof lv.title !== "string" ||
      typeof lv.diagnosis !== "string" ||
      typeof lv.action !== "string" ||
      !Array.isArray(lv.methods) ||
      typeof lv.upliftLow !== "number" ||
      typeof lv.upliftHigh !== "number" ||
      typeof lv.timeframe !== "string" ||
      (lv.effort !== "Low" && lv.effort !== "Medium" && lv.effort !== "High")
    ) {
      return { ok: false, reason: "lever-shape" };
    }
    if (!Number.isFinite(lv.upliftLow) || !Number.isFinite(lv.upliftHigh) || lv.upliftLow < 0 || lv.upliftHigh >= 100) {
      return { ok: false, reason: "uplift-range" };
    }
    levers.push({
      title: lv.title,
      diagnosis: lv.diagnosis,
      action: lv.action,
      methods: lv.methods.map(String),
      upliftLow: lv.upliftLow,
      upliftHigh: lv.upliftHigh,
      effort: lv.effort,
      timeframe: lv.timeframe,
    });
  }

  // Banned-term scan across every rendered text field.
  const haystack = [
    a.read, a.spread, a.caution,
    ...levers.flatMap((l) => [l.title, l.diagnosis, l.action, ...l.methods]),
  ].join("\n");
  const banned = findBannedTerm(haystack);
  if (banned) return { ok: false, reason: "banned-term", bannedTerm: banned };

  return { ok: true, advice: { read: a.read, spread: a.spread, caution: a.caution, levers } };
}

/**
 * Fully populated sample advice — no API call, no hardcoded dollar figures so it
 * reads sensibly at any stage (spec §7.1). Internal/demo accounts default to it.
 */
export const SAMPLE_ADVICE: Advice = {
  read:
    "Your range is held up by exit-story methods and held down by present-day evidence. VC Method and ownership pricing both run off assumptions you have not proven yet, while trading comps price off real revenue. The binding constraint is the exit-revenue assumption — nothing in the inputs demonstrates the growth it requires.",
  spread:
    "The methods disagree widely at the low end. A lead will anchor on the Scorecard and comps floors, not your ceiling. Closing that spread is worth more than raising any single method.",
  caution:
    "The exit revenue and multiple together imply an outcome far above current revenue; expect the first serious investor to test that number before anything else in the model.",
  levers: [
    {
      title: "Prove the growth curve with cohort data",
      diagnosis: "The exit multiple and return band are doing all the work in the VC Method, with no retention or expansion evidence behind the exit revenue.",
      action: "Pull three consecutive quarters of net revenue retention and logo retention by cohort. If NRR clears 110%, the comparable multiple defensibly moves up a band and the exit revenue stops being a guess.",
      methods: ["VC Method", "Trading comparables"],
      upliftLow: 18, upliftHigh: 34, effort: "Medium", timeframe: "30 days",
    },
    {
      title: "Name three real comparables",
      diagnosis: "A wide comparable band is a large spread on the one method grounded in real revenue. That width invites the lead to price at the bottom.",
      action: "Pick three companies with disclosed multiples at your revenue and growth rate, put them in a one-page table with source and date, and narrow to those three. A defended narrow band beats an undefended wide one.",
      methods: ["Trading comparables"],
      upliftLow: 12, upliftHigh: 22, effort: "Low", timeframe: "One week",
    },
    {
      title: "Get a second term sheet",
      diagnosis: "Target ownership swings the pre-money more than any other single variable in the model.",
      action: "Run a compressed process so two funds are live in the same two weeks. Competition, not argument, moves a lead down the ownership band.",
      methods: ["Ownership-target pricing", "VC Method"],
      upliftLow: 15, upliftHigh: 30, effort: "High", timeframe: "One quarter",
    },
    {
      title: "Raise less, price higher",
      diagnosis: "The raise is heavy against this pre-money and forces the ownership conversation toward the top of the band.",
      action: "Cut the raise against a named 18-month milestone, or split it with an extension tied to that milestone. Smaller ask, less dilution pressure, same runway.",
      methods: ["Ownership-target pricing"],
      upliftLow: 8, upliftHigh: 15, effort: "Medium", timeframe: "Two weeks",
    },
    {
      title: "Close the competitive gap",
      diagnosis: "Competitive environment is the lowest Scorecard factor, and it is what a lead probes hardest in the first meeting.",
      action: "Document one thing a competitor cannot copy in twelve months — proprietary data, an exclusive channel, or a switching cost — with evidence rather than assertion.",
      methods: ["Scorecard (Payne)"],
      upliftLow: 6, upliftHigh: 11, effort: "Low", timeframe: "30 days",
    },
  ],
};
