// Market Claim Grader — grades a founder's MARKET NARRATIVE (sizing, competitive
// position, timing, evidence, customer proof) the way an institutional reviewer reads
// it, from the founder's own pitch deck. Everything here is derived from the founder's
// document by the AI — there are deliberately NO comparable-deal medians, percentiles,
// or trajectory figures, because the platform has no comparable-deals dataset to back
// them. Add those only when real data exists.

export type ClaimSeverity = "high" | "med" | "clear";

export type ClaimDimension = {
  name: string;             // e.g. "Market sizing"
  score: number;            // 0-100
  verdict: "strong" | "good" | "needs_work" | "weak";
};

export type ClaimObjection = {
  title: string;            // the objection, short
  category: string;         // e.g. "Sizing method"
  severity: ClaimSeverity;  // high | med | clear (clear = already answered)
  body: string;             // why a reviewer raises it
  fix: string;              // the concrete fix (empty when severity = clear)
};

export type ClaimCompetitor = {
  company: string;
  stage: string;            // e.g. "Series B" or "" if unknown
  raised: string;           // e.g. "$52M", "Undisclosed", "n/a"
};

export type ClaimField = {
  field: string;            // e.g. "Stated market size"
  value: string;            // extracted value
  cite: string;             // supporting quote / note ("" if none)
  source: "deck" | "profile" | "missing"; // provenance bucket
};

export type ClaimFix = {
  name: string;             // what to do
  effort: string;           // rough effort ("About one week")
  points: number;           // projected grade lift (1-12)
};

export type MarketClaimReport = {
  overallScore: number;     // 0-100
  summary: string;          // one-sentence verdict
  dimensions: ClaimDimension[];
  objections: ClaimObjection[];
  competitors: ClaimCompetitor[];
  extracted: ClaimField[];
  fixes: ClaimFix[];        // powers the What-if simulator
  source: "ai" | "fallback";
};

export const CLAIM_DIMENSIONS = [
  "Market sizing",
  "Competitive position",
  "Timing thesis",
  "Evidence quality",
  "Customer proof",
] as const;

export function dimensionVerdict(score: number): ClaimDimension["verdict"] {
  if (score >= 75) return "strong";
  if (score >= 60) return "good";
  if (score >= 40) return "needs_work";
  return "weak";
}

// The grading instruction. Deliberately scoped to the MARKET CLAIM only, and forbidden
// from inventing comparables/medians/percentiles that we can't back with data.
export function buildMarketClaimSystemPrompt(companyName: string, industry: string, stage: string): string {
  return `You are an institutional venture reviewer grading ONLY the MARKET CLAIM of a company's materials — how they size the market, position against competitors, argue timing, evidence their claims, and prove customer pull. You are reviewing ${companyName} (${industry || "unknown industry"}, ${stage || "unknown stage"}).

Grade strictly and specifically, like a partner writing an internal memo. Judge only what the documents actually say. Do NOT grade product, team, or financials except where they bear on the market claim.

Hard rules:
- Base every score, objection, competitor, and extracted field ONLY on the provided document. If something isn't in the document, say so — never invent it.
- Do NOT reference "comparable deals", industry medians, percentiles, benchmarks, or a month-over-month trajectory. You have no such dataset. Grade the claim on its own merits.
- Institutional reviewers discount top-down / analyst TAM figures; reward bottom-up sizing with shown arithmetic. Reward a named customer who switched from an incumbent. Penalise unaddressed incumbent risk.

Return ONLY valid JSON matching this exact schema (no prose, no code fences):
{
  "overallScore": <0-100 grade for the market claim overall>,
  "summary": "<one sentence: the single biggest reason the claim grades where it does>",
  "dimensions": [
    { "name": "Market sizing", "score": <0-100>, "verdict": "<strong|good|needs_work|weak>" },
    { "name": "Competitive position", "score": <0-100>, "verdict": "..." },
    { "name": "Timing thesis", "score": <0-100>, "verdict": "..." },
    { "name": "Evidence quality", "score": <0-100>, "verdict": "..." },
    { "name": "Customer proof", "score": <0-100>, "verdict": "..." }
  ],
  "objections": [
    { "title": "<the objection, short>", "category": "<e.g. Sizing method>", "severity": "<high|med|clear>", "body": "<2-3 sentences on why a reviewer raises this>", "fix": "<one concrete fix; empty string if severity is clear>" }
  ],
  "competitors": [
    { "company": "<name>", "stage": "<funding stage or empty>", "raised": "<amount, 'Undisclosed', or 'n/a'>" }
  ],
  "extracted": [
    { "field": "<e.g. Stated market size>", "value": "<extracted value or 'Not stated'>", "cite": "<short supporting quote or note, empty if none>", "source": "<deck|profile|missing>" }
  ],
  "fixes": [
    { "name": "<actionable fix, matches an objection>", "effort": "<rough effort, e.g. About one week>", "points": <1-12 projected grade lift> }
  ]
}

Rank objections by severity (high first). Include 3-6 objections, 3-6 extracted fields, and one fix per open (non-clear) objection. Keep every string tight and specific to this company.`;
}

export function parseMarketClaim(raw: string): MarketClaimReport | null {
  const noFences = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const tryParse = (s: string): MarketClaimReport | null => {
    try {
      return JSON.parse(s) as MarketClaimReport;
    } catch {
      return null;
    }
  };
  const whole = tryParse(noFences);
  if (whole) return whole;
  const start = noFences.indexOf("{");
  const end = noFences.lastIndexOf("}");
  if (start !== -1 && end > start) return tryParse(noFences.slice(start, end + 1));
  return null;
}

// Normalise an AI report: clamp scores, fix verdicts, drop malformed rows. Never trust
// the model's numbers blindly.
export function normalizeMarketClaim(r: MarketClaimReport): MarketClaimReport {
  const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  return {
    overallScore: clamp(r.overallScore),
    summary: String(r.summary ?? "").slice(0, 400),
    dimensions: (Array.isArray(r.dimensions) ? r.dimensions : [])
      .filter((d) => d && d.name)
      .map((d) => ({ name: String(d.name), score: clamp(d.score), verdict: dimensionVerdict(clamp(d.score)) })),
    objections: (Array.isArray(r.objections) ? r.objections : [])
      .filter((o) => o && o.title)
      .map((o) => ({
        title: String(o.title),
        category: String(o.category ?? ""),
        severity: (["high", "med", "clear"].includes(o.severity) ? o.severity : "med") as ClaimSeverity,
        body: String(o.body ?? ""),
        fix: String(o.fix ?? ""),
      })),
    competitors: (Array.isArray(r.competitors) ? r.competitors : [])
      .filter((c) => c && c.company)
      .map((c) => ({ company: String(c.company), stage: String(c.stage ?? ""), raised: String(c.raised ?? "n/a") })),
    extracted: (Array.isArray(r.extracted) ? r.extracted : [])
      .filter((f) => f && f.field)
      .map((f) => ({
        field: String(f.field),
        value: String(f.value ?? "Not stated"),
        cite: String(f.cite ?? ""),
        source: (["deck", "profile", "missing"].includes(f.source) ? f.source : "deck") as ClaimField["source"],
      })),
    fixes: (Array.isArray(r.fixes) ? r.fixes : [])
      .filter((x) => x && x.name)
      .map((x) => ({ name: String(x.name), effort: String(x.effort ?? ""), points: Math.max(1, Math.min(12, Math.round(Number(x.points) || 1))) })),
    source: "ai",
  };
}

export function marketClaimFallback(reason?: string): MarketClaimReport {
  return {
    overallScore: 0,
    summary: reason ? `Grade could not run — ${reason}.` : "Grading unavailable — AI is not configured.",
    dimensions: CLAIM_DIMENSIONS.map((name) => ({ name, score: 0, verdict: "weak" as const })),
    objections: [],
    competitors: [],
    extracted: [],
    fixes: [],
    source: "fallback",
  };
}
