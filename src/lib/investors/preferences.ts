/**
 * Structured investor preferences.
 *
 * Investor contacts carry a set of Odoo-synced "Additional details" questionnaire
 * answers (label → values) — e.g. investment size, use-of-funds, deals/year,
 * revenue & EBITDA ranges, active rating. This module normalizes those loosely
 * labeled fields into one typed shape so the whole app can search, filter, and
 * match on them consistently instead of re-parsing free-text tags everywhere.
 *
 * It's intentionally forgiving about labels (Odoo phrasing drifts) and returns
 * whatever's present; missing fields come back null / empty.
 */

export type InvestorExtraField = { label: string; values: string[] };

export type InvestorPreferences = {
  /** e.g. "5-Excellent" */
  activeRating: string | null;
  /** e.g. ["$250k - $500k"] */
  investmentSize: string[];
  /** e.g. ["Growth Stage", "Research & Development"] */
  useOfFunds: string[];
  /** e.g. "Less than 5 Deals" */
  dealsPerYear: string | null;
  /** Preferred company annual revenue ranges */
  revenueRange: string[];
  /** Preferred company annual EBITDA ranges */
  ebitdaRange: string[];
  /** e.g. ["Strong Management Team"] */
  managementTeam: string[];
  /** e.g. "Verified" */
  contactPreference: string | null;
  /** Focus sectors / industries (from the profile's industries list, not a label). */
  sectors: string[];
  shortBio: string | null;
  workExperience: string | null;
  specialSkills: string | null;
  howHeard: string | null;
};

export const EMPTY_PREFERENCES: InvestorPreferences = {
  activeRating: null,
  investmentSize: [],
  useOfFunds: [],
  dealsPerYear: null,
  revenueRange: [],
  ebitdaRange: [],
  managementTeam: [],
  contactPreference: null,
  sectors: [],
  shortBio: null,
  workExperience: null,
  specialSkills: null,
  howHeard: null,
};

/** Field → the Odoo label(s) it may appear under. Matched case-insensitively. */
const LABELS = {
  activeRating: ["active investor", "active investor?"],
  investmentSize: ["investor investment size", "investor investment size?"],
  useOfFunds: ["investor preferences for use of funds", "investor preferences for use of funds?"],
  dealsPerYear: [
    "investor preferences for the number of deals per year",
    "investor preferences for the number of deals per year?",
  ],
  revenueRange: [
    "investor preferences for the company with an annual revenue range of",
    "investor preferences for the company with an annual revenue range of?",
    "investor preferences for company with an annual revenue range of?",
  ],
  ebitdaRange: [
    "investor preferences for company with annual ebitda range of",
    "investor preferences for company with annual ebitda range of?",
    "investor preferences for the company with an annual ebitda range of?",
  ],
  managementTeam: ["investor preferences for the management team", "investor preferences for the management team?"],
  contactPreference: ["investor contact preference"],
  shortBio: ["investor short bio"],
  workExperience: ["investor work experience"],
  specialSkills: ["investor special skills"],
  howHeard: ["investor: how did you hear about us", "investor: how did you hear about us?"],
} as const;

/** All the structured field keys, in display order. */
export const PREFERENCE_KEYS = Object.keys(LABELS) as (keyof typeof LABELS)[];

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Turn the raw label/value "extra" fields into the typed preference shape. */
export function extractInvestorPreferences(extra: InvestorExtraField[] | null | undefined): InvestorPreferences {
  const byLabel = new Map<string, string[]>();
  for (const f of extra ?? []) {
    if (f && typeof f.label === "string") byLabel.set(norm(f.label), Array.isArray(f.values) ? f.values : []);
  }

  const find = (labels: readonly string[]): string[] => {
    for (const l of labels) {
      const v = byLabel.get(norm(l));
      if (v && v.length) return v.map((x) => String(x).trim()).filter(Boolean);
    }
    return [];
  };
  const first = (labels: readonly string[]): string | null => find(labels)[0] ?? null;

  return {
    activeRating: first(LABELS.activeRating),
    investmentSize: find(LABELS.investmentSize),
    useOfFunds: find(LABELS.useOfFunds),
    dealsPerYear: first(LABELS.dealsPerYear),
    revenueRange: find(LABELS.revenueRange),
    ebitdaRange: find(LABELS.ebitdaRange),
    managementTeam: find(LABELS.managementTeam),
    contactPreference: first(LABELS.contactPreference),
    // Sectors come from the profile's top-level industries list, set by the loader.
    sectors: [],
    shortBio: first(LABELS.shortBio),
    workExperience: first(LABELS.workExperience),
    specialSkills: first(LABELS.specialSkills),
    howHeard: first(LABELS.howHeard),
  };
}

/** Numeric active-investor rating (1–5) parsed from e.g. "5-Excellent". */
export function activeRatingScore(pref: InvestorPreferences): number | null {
  if (!pref.activeRating) return null;
  const m = pref.activeRating.match(/(\d)/);
  return m ? Number(m[1]) : null;
}
