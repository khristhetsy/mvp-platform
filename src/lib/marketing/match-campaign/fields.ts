/**
 * Founder lead fields and the data check. Pure: the caller loads rows from the
 * match_campaign_founder_fields view (industry and stage as the team fills them).
 * The campaign only reads these fields, it never writes them.
 */
import { buildCompanyMatchProfile } from "@/lib/matching/contact-match";
import type { CompanyMatchProfile } from "@/lib/matching/investor-company-matching";
import { firstValidEmail } from "@/lib/marketing/recipient";
import type { ExcludedReason, FounderFieldsRow } from "./types";

/**
 * Funding stage vocabulary shared by founder and investor Odoo records. Values
 * outside it (Other, Acquired, Bootstrap, Grant) are not a stage an investor
 * can be matched on, so a founder with only those counts as missing a stage.
 */
const STAGE_CANON: Array<[RegExp, string]> = [
  [/^pre[\s-]?seed$/i, "Pre-Seed"],
  [/^seed( round)?$/i, "Seed Round"],
  [/^series a$/i, "Series A"],
  [/^series b$/i, "Series B"],
  [/^series c\+?$/i, "Series C"],
  [/^growth( stage)?$/i, "Growth"],
];

export function canonicalStage(value: string): string | null {
  const v = value.trim();
  for (const [re, label] of STAGE_CANON) if (re.test(v)) return label;
  return null;
}

export function canonicalStages(values: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const v of values ?? []) {
    const c = canonicalStage(v);
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

/** Short display label for a canonical stage ("Seed Round" reads as "Seed"). */
export function stageLabel(stage: string): string {
  return stage === "Seed Round" ? "Seed" : stage === "Pre-Seed" ? "Pre-seed" : stage;
}

/** EU and EEA members plus the UK and Switzerland (GDPR and its equivalents). */
const EU_COUNTRIES = new Set(
  [
    "austria", "belgium", "bulgaria", "croatia", "cyprus", "czechia", "czech republic", "denmark", "estonia",
    "finland", "france", "germany", "greece", "hungary", "ireland", "italy", "latvia", "lithuania",
    "luxembourg", "malta", "netherlands", "the netherlands", "poland", "portugal", "romania", "slovakia",
    "slovenia", "spain", "sweden", "iceland", "liechtenstein", "norway", "united kingdom", "uk",
    "great britain", "england", "scotland", "wales", "northern ireland", "switzerland",
  ],
);

export function isEuCountry(country: string | null | undefined): boolean {
  return Boolean(country && EU_COUNTRIES.has(country.trim().toLowerCase()));
}

export type CheckOptions = { verifiedOnly: boolean; excludeEu: boolean; unsubscribed: boolean };

/**
 * The data check. Returns why a founder can't be matched or emailed, or null
 * when the founder is ready. Order matters: data first, then deliverability.
 */
export function checkFounder(row: FounderFieldsRow, opts: CheckOptions): ExcludedReason | null {
  if ((row.industries ?? []).length === 0) return "missing_industry";
  if (canonicalStages(row.funding_stages).length === 0) return "missing_stage";
  if (!row.email || !row.email.trim()) return "no_email";
  if (!firstValidEmail(row.email) || row.email_status === "invalid") return "invalid_email";
  if (row.suppressed || opts.unsubscribed) return "suppressed";
  if (opts.verifiedOnly && row.email_status !== "valid") return "email_unverified";
  if (opts.excludeEu && isEuCountry(row.country)) return "eu_excluded";
  return null;
}

/**
 * Contact adapter: a founder lead as the CompanyMatchProfile that
 * matchInvestorToCompany scores. Reuses buildCompanyMatchProfile (the same
 * bridge the founder board uses), fed from the lead's questionnaire answers.
 */
export function founderCompanyProfile(row: FounderFieldsRow): CompanyMatchProfile {
  return buildCompanyMatchProfile({
    id: row.id,
    company_name: row.company ?? row.name ?? "",
    industry: (row.industries ?? []).join(", ") || null,
    funding_stage: canonicalStages(row.funding_stages).join(", ") || null,
    seeking_investor_types: (row.seeking_investor_types ?? []).join(", ") || null,
    country: row.country,
    funding_amount_band: row.seeking_amount?.[0] ?? null,
  });
}
