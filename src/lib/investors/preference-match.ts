import { type InvestorPreferences, activeRatingScore } from "./preferences";

/**
 * Scores how well a founder's company fits an investor's structured preferences
 * (check size, revenue band, use-of-funds / stage, active rating). Deterministic
 * and forgiving: any field the investor hasn't set simply doesn't contribute.
 * Returns a 0–100 score plus the human-readable reasons that fired — the same
 * "hit" reasons surfaced in the directory and founder matches.
 */

export type CompanyMatchInput = {
  /** The company's raise / ask, USD. */
  fundingAmount: number | null;
  /** The company's annual revenue, USD, if known. */
  revenue: number | null;
  /** e.g. "early_revenue", "growing". */
  revenueStage: string | null;
  /** Free-text use of funds / focus. */
  useOfFunds: string | null;
  industry: string | null;
};

export type PreferenceMatch = { score: number; reasons: string[] };

/** Parse a money band like "$250k - $500k", "Less than $50k", "$500k - $1m". */
export function parseMoneyBand(raw: string): { min: number; max: number } | null {
  const s = raw.toLowerCase();
  const toNum = (numStr: string, unit: string): number => {
    const n = Number(numStr.replace(/[,$\s]/g, ""));
    if (Number.isNaN(n)) return NaN;
    if (unit === "k") return n * 1_000;
    if (unit === "m") return n * 1_000_000;
    if (unit === "b") return n * 1_000_000_000;
    return n;
  };
  const nums = [...s.matchAll(/\$?\s*([\d.,]+)\s*([kmb])?/g)]
    .map((m) => toNum(m[1], m[2] ?? ""))
    .filter((n) => !Number.isNaN(n));
  if (nums.length === 0) return null;
  if (/less than|under|up to|below|<\s/.test(s)) return { min: 0, max: nums[0] };
  if (/more than|over|above|\+|>\s/.test(s)) return { min: nums[0], max: Number.POSITIVE_INFINITY };
  if (nums.length >= 2) return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) };
  return { min: nums[0] * 0.75, max: nums[0] * 1.25 };
}

function inAnyBand(amount: number, bands: string[]): boolean {
  return bands.some((b) => {
    const r = parseMoneyBand(b);
    return r != null && amount >= r.min && amount <= r.max;
  });
}

const STAGE_WORDS: Record<string, string[]> = {
  pre_revenue: ["pre-revenue", "seed", "early", "startup"],
  early_revenue: ["early revenue", "early", "seed", "growth"],
  growing: ["growth", "growing", "scale", "expansion"],
  scaling: ["scale", "scaling", "growth", "late"],
};

function tokens(s: string | null): string[] {
  return (s ?? "").toLowerCase().split(/[^a-z]+/).filter(Boolean);
}

/** Weights for each match factor (admin-adjustable). Sum is the denominator. */
export type MatchWeights = { sector: number; specificity: number; stage: number; checkSize: number; activity: number };
export const DEFAULT_WEIGHTS: MatchWeights = { sector: 35, specificity: 15, stage: 20, checkSize: 15, activity: 15 };

/**
 * Graded match: compares the founder's company profile against the investor's
 * profile and returns a 0–100 score with reasons. Unlike a yes/no match, sector
 * fit is scored by POSITION (primary sector > secondary) and SPECIFICITY (a
 * focused 1–2 sector investor > a generalist), so investors spread out instead
 * of all pegging to 100. Stage, check size and activity add graded points.
 */
export function scoreInvestorPreferenceMatch(
  company: CompanyMatchInput,
  pref: InvestorPreferences,
  weights: MatchWeights = DEFAULT_WEIGHTS,
): PreferenceMatch {
  const W = weights;
  const total = W.sector + W.specificity + W.stage + W.checkSize + W.activity;
  if (total <= 0) return { score: 50, reasons: [] };

  let points = 0;
  const reasons: string[] = [];

  // Sector fit by POSITION — the company industry earlier in the investor's list
  // (their primary focus) scores higher than a secondary/tertiary tag.
  if (company.industry && pref.sectors.length > 0) {
    const ind = company.industry.trim().toLowerCase();
    const pos = pref.sectors.findIndex((s) => {
      const sl = s.trim().toLowerCase();
      return sl.includes(ind) || ind.includes(sl);
    });
    if (pos >= 0) {
      const fit = Math.max(0, 1 - pos * 0.25); // primary=1.0, 2nd=0.75, 3rd=0.5, 4th=0.25
      points += W.sector * fit;
      reasons.push(pos === 0 ? "Primary sector match" : "Secondary sector match");
    }
  }

  // Specificity — a focused investor (few sectors) fits better than a generalist.
  if (pref.sectors.length > 0) {
    points += W.specificity * (1 / pref.sectors.length);
    if (pref.sectors.length <= 2) reasons.push("Focused investor");
  }

  // Stage / use-of-funds overlap.
  if (pref.useOfFunds.length > 0) {
    const stageWords = new Set([
      ...(company.revenueStage ? STAGE_WORDS[company.revenueStage] ?? [] : []),
      ...tokens(company.useOfFunds),
      ...tokens(company.industry),
    ]);
    if (pref.useOfFunds.some((u) => tokens(u).some((w) => stageWords.has(w)))) {
      points += W.stage;
      reasons.push("Use-of-funds / stage fit");
    }
  }

  // Check size vs. the raise.
  if (pref.investmentSize.length > 0 && company.fundingAmount != null && inAnyBand(company.fundingAmount, pref.investmentSize)) {
    points += W.checkSize;
    reasons.push("Check size fits the raise");
  }

  // Active-investor rating quality (graded by the 1–5 rating).
  const rating = activeRatingScore(pref);
  if (rating != null) {
    points += W.activity * (rating / 5);
    if (rating >= 4) reasons.push("Highly active investor");
  }

  return { score: Math.round((points / total) * 100), reasons };
}
