/**
 * Match campaigns: pure helpers (no I/O), shared by the admin routes, the sender and
 * the public match page. Unit tested in core.test.ts.
 *
 * Matching rule (khris, Sep 30 2026): use ALL filled founder values, including guessed
 * and low confidence ones. Provenance is shown, never used to exclude. A founder is
 * excluded only when industry or stage is empty, the email cannot be sent to, the
 * contact is suppressed, or (open decision settled) the founder is in the EU.
 */
import { parseMoneyBand } from "@/lib/investors/preference-match";
import { canonicalizeIndustries } from "@/lib/industries/canonical";
import type { FitAnswers } from "@/lib/fit/options";

/** One founder lead as the match_campaign_founder_fields view returns it. */
export type FounderFields = {
  id: string;
  name: string | null;
  email: string | null;
  email_status: string | null;
  suppressed: boolean | null;
  company: string | null;
  country: string | null;
  industries: string[] | null;
  funding_stages: string[] | null;
  seeking_amount: string[] | null;
  seeking_investor_types: string[] | null;
  supabase_profile_id: string | null;
  pipeline_stage: string | null;
  founder_type: "lead" | "existing_user" | "in_pipeline" | null;
  industry_source: string | null;
  stage_source: string | null;
};

/** Extra fields read from crm_contacts for matching (not in the view). */
export type FounderExtra = { operatingStages: string[]; revenue: string[] };

export type MatchConfig = {
  founder_list_id?: string | null;
  daily_cap: number;
  top_n: number;
  preview_count: number;
  exclude_eu: boolean;
  verified_only: boolean;
  dry_run: boolean;
  /** Sources the admin chose to leave out (default none: use all values). */
  exclude_sources: SourceKey[];
  schedule_url: string;
  subject: string;
  time_zone?: string | null;
  /** Admin-entered campaign cost for ROI (email cost plus admin hours), in cents. */
  campaign_cost_cents: number | null;
};

export const DEFAULT_SCHEDULE_URL = "/schedule/dc2f3667-ca80-4f35-a1cd-ba0c3adac510";
export const DEFAULT_SUBJECT = "{match_count} investors in our network match {company}";

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  founder_list_id: null,
  daily_cap: 150,
  top_n: 50,
  preview_count: 3,
  exclude_eu: true,
  verified_only: false,
  dry_run: false,
  exclude_sources: [],
  schedule_url: DEFAULT_SCHEDULE_URL,
  subject: DEFAULT_SUBJECT,
  time_zone: null,
  campaign_cost_cents: null,
};

export function readMatchConfig(raw: unknown): MatchConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<MatchConfig>;
  const num = (v: unknown, d: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : d;
  };
  return {
    founder_list_id: typeof r.founder_list_id === "string" ? r.founder_list_id : null,
    daily_cap: num(r.daily_cap, DEFAULT_MATCH_CONFIG.daily_cap, 1, 5000),
    top_n: num(r.top_n, DEFAULT_MATCH_CONFIG.top_n, 3, 200),
    preview_count: num(r.preview_count, DEFAULT_MATCH_CONFIG.preview_count, 1, 5),
    exclude_eu: r.exclude_eu !== false,
    verified_only: r.verified_only === true,
    dry_run: r.dry_run === true,
    exclude_sources: Array.isArray(r.exclude_sources) ? r.exclude_sources.filter((s): s is SourceKey => SOURCE_KEYS.includes(s as SourceKey)) : [],
    schedule_url: typeof r.schedule_url === "string" && r.schedule_url.trim() ? r.schedule_url.trim() : DEFAULT_SCHEDULE_URL,
    subject: typeof r.subject === "string" && r.subject.trim() ? r.subject.trim() : DEFAULT_SUBJECT,
    time_zone: typeof r.time_zone === "string" ? r.time_zone : null,
    campaign_cost_cents: r.campaign_cost_cents != null && Number.isFinite(Number(r.campaign_cost_cents)) && Number(r.campaign_cost_cents) >= 0 ? Math.round(Number(r.campaign_cost_cents)) : null,
  };
}

// ── Provenance tags ────────────────────────────────────────────────────────────

export const SOURCE_KEYS = ["crm", "high", "medium", "low", "summary", "derived", "guess"] as const;
export type SourceKey = (typeof SOURCE_KEYS)[number];
export type SourceTag = { key: SourceKey; label: string; tone: "good" | "warn" | "bad" };

/** Map a stored provenance tag (overrides._industry_source / _funding_stage_source) to a
 *  display tag. No tag means the value was entered in the CRM by the founder or team. */
export function sourceTag(raw: string | null | undefined): SourceTag {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s || s.startsWith("crm")) return { key: "crm", label: "CRM", tone: "good" };
  if (s === "inferred:high") return { key: "high", label: "High", tone: "warn" };
  if (s === "inferred:medium") return { key: "medium", label: "Medium", tone: "warn" };
  if (s === "inferred:low") return { key: "low", label: "Low", tone: "bad" };
  if (s === "derived:summary") return { key: "summary", label: "Summary", tone: "warn" };
  if (s.startsWith("derived:")) return { key: "derived", label: s === "derived:revenue" ? "From revenue" : "From amount", tone: "warn" };
  if (s.startsWith("guess")) return { key: "guess", label: "Guess", tone: "warn" };
  return { key: "guess", label: "Guess", tone: "warn" };
}

export const SOURCE_FILTER_LABELS: Record<SourceKey, string> = {
  crm: "CRM",
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
  summary: "From summary",
  derived: "From amount or revenue",
  guess: "Guess",
};

/** True when a founder uses a non CRM value for industry or stage. */
export function usesGuessedValue(f: Pick<FounderFields, "industry_source" | "stage_source">): boolean {
  return sourceTag(f.industry_source).key !== "crm" || sourceTag(f.stage_source).key !== "crm";
}

// ── Data check ─────────────────────────────────────────────────────────────────

export type ExcludedReason =
  | "missing_industry" | "missing_stage" | "no_email" | "invalid_email"
  | "email_unverified" | "suppressed" | "eu_excluded" | "no_matches" | "unconfirmed_data";

export const EXCLUDED_LABEL: Record<ExcludedReason, string> = {
  missing_industry: "Excluded, missing industry",
  missing_stage: "Excluded, missing stage",
  no_email: "Excluded, no email",
  invalid_email: "Excluded, email invalid",
  email_unverified: "Excluded, email unverified",
  suppressed: "Excluded, unsubscribed",
  eu_excluded: "Excluded, EU",
  no_matches: "No matches, skipped",
  unconfirmed_data: "Excluded, source filtered out",
};

export const EU_COUNTRIES = new Set([
  "austria", "belgium", "bulgaria", "croatia", "cyprus", "czechia", "czech republic", "denmark", "estonia",
  "finland", "france", "germany", "greece", "hungary", "ireland", "italy", "latvia", "lithuania",
  "luxembourg", "malta", "netherlands", "poland", "portugal", "romania", "slovakia", "slovenia", "spain", "sweden",
]);

export function isEu(country: string | null | undefined): boolean {
  return EU_COUNTRIES.has((country ?? "").trim().toLowerCase());
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function firstEmail(raw: string | null | undefined): string | null {
  const parts = (raw ?? "").split(/[;,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return parts.find((p) => EMAIL_RE.test(p)) ?? null;
}

export function nonEmpty(list: string[] | null | undefined): string[] {
  return (list ?? []).map((s) => String(s).trim()).filter(Boolean);
}

/** Why a founder can't be matched or emailed, or null when ready. Order matters: the
 *  first failing rule is the reason shown. */
export function excludedReason(f: FounderFields, cfg: Pick<MatchConfig, "exclude_eu" | "verified_only" | "exclude_sources">, unsubscribed = false): ExcludedReason | null {
  if (f.suppressed || unsubscribed) return "suppressed";
  const email = firstEmail(f.email);
  if (!(f.email ?? "").trim()) return "no_email";
  if (!email || (f.email_status ?? "").toLowerCase() === "invalid") return "invalid_email";
  if (cfg.exclude_eu && isEu(f.country)) return "eu_excluded";
  if (nonEmpty(f.industries).length === 0) return "missing_industry";
  if (nonEmpty(f.funding_stages).length === 0) return "missing_stage";
  if (cfg.exclude_sources.length) {
    const tags = [sourceTag(f.industry_source).key, sourceTag(f.stage_source).key];
    if (tags.some((t) => cfg.exclude_sources.includes(t))) return "unconfirmed_data";
  }
  if (cfg.verified_only && (f.email_status ?? "").toLowerCase() !== "valid") return "email_unverified";
  return null;
}

// ── Founder → /fit answers ─────────────────────────────────────────────────────

const OP_TO_Q1: Record<string, string> = {
  startup: "pre_revenue", prototype: "pre_revenue",
  "expand growth": "revenue_pre_a", "small business": "revenue_pre_a",
  "midsize company": "series_a_plus", "large corporation": "series_a_plus", "large company": "series_a_plus",
};

/** Funding stage (the CRM question) to the /fit stage key, used when no operating stage. */
export function fundingStageToQ1(stage: string): string | null {
  const s = stage.trim().toLowerCase();
  if (!s) return null;
  if (/pre[\s-]?seed|^seed|bootstrap|grant/.test(s)) return "pre_revenue";
  if (/series\s*a|series\s*b/.test(s)) return "revenue_pre_a";
  if (/series\s*[c-z]|growth|acquired|ipo/.test(s)) return "series_a_plus";
  return null;
}

function bandKeyForRaise(value: string): string | null {
  const band = parseMoneyBand(value);
  if (!band) return null;
  const hi = Number.isFinite(band.max) ? band.max : band.min;
  if (hi <= 1_000_000) return "under_1m";
  if (band.min >= 10_000_000) return "over_10m";
  return "1m_10m";
}

function revenueKey(value: string): string | null {
  const s = value.trim().toLowerCase();
  if (!s) return null;
  if (s.includes("pre-revenue") || s.includes("pre revenue") || s === "less than $50k") return "pre_revenue";
  if (s === "$5m+" || /\$(10|50)m|over \$100m/.test(s)) return "over_5m";
  if (s.startsWith("$1m")) return "1m_5m";
  if (s.startsWith("under") || /\$(50|100|250|500)k/.test(s)) return "under_1m";
  return null;
}

const TYPE_TO_Q5: Array<[RegExp, string]> = [
  [/angel/i, "angel"],
  [/venture/i, "vc"],
  [/private equity/i, "pe"],
  [/family office/i, "family_office"],
  [/corporate|strategic/i, "corporate"],
];

const uniq = (xs: Array<string | null>) => [...new Set(xs.filter((x): x is string => Boolean(x)))];

/** Build the five /fit answers from a founder lead, so the lead is matched exactly the
 *  way icapos.com/fit would match the same answers. Every filled value is used. */
export function founderToFitAnswers(f: FounderFields, extra: FounderExtra): FitAnswers {
  const industry = canonicalizeIndustries(nonEmpty(f.industries));
  let stage = uniq(extra.operatingStages.map((s) => OP_TO_Q1[s.trim().toLowerCase()] ?? null));
  if (stage.length === 0) stage = uniq(nonEmpty(f.funding_stages).map(fundingStageToQ1));
  const raise = uniq(nonEmpty(f.seeking_amount).map(bandKeyForRaise));
  const revenue = uniq(extra.revenue.map(revenueKey));
  const investorType = uniq(nonEmpty(f.seeking_investor_types).map((t) => TYPE_TO_Q5.find(([re]) => re.test(t))?.[1] ?? null));
  return { industry, stage, raise, revenue, investorType: investorType.length ? investorType : ["any"] };
}

// ── Display helpers ────────────────────────────────────────────────────────────

/** "7,245" → "7,000+". Rounds down to the thousand so the claim is always true. */
export function networkLabel(total: number): string {
  if (total >= 1000) return `${(Math.floor(total / 1000) * 1000).toLocaleString("en-US")}+`;
  return total.toLocaleString("en-US");
}

export function fillSubject(template: string, vars: { match_count: number; company: string }): string {
  return template
    .replace(/\{\s*match_count\s*\}/gi, String(vars.match_count))
    .replace(/\{\s*company\s*\}/gi, vars.company || "your company");
}

export type TopMatch = {
  investor_type: string | null;
  sectors: string[];
  stages: string[];
  check_band: string | null;
  fit: number;
};

/** First display stage label from the founder's funding stages ("Seed Round" → "Seed"). */
export function displayStage(stages: string[] | null | undefined): string {
  const s = nonEmpty(stages)[0] ?? "";
  return s.replace(/\s+round$/i, "");
}
