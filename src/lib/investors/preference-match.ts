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

export function scoreInvestorPreferenceMatch(
  company: CompanyMatchInput,
  pref: InvestorPreferences,
): PreferenceMatch {
  let points = 0;
  let possible = 0;
  const reasons: string[] = [];

  // Sector / industry focus vs. the company (weight 35). This is usually the
  // field that actually varies between investors, so it drives real spread.
  if (pref.sectors.length > 0 && company.industry) {
    possible += 35;
    const ind = company.industry.toLowerCase();
    const hit = pref.sectors.some((s) => {
      const sl = s.toLowerCase();
      return sl.includes(ind) || ind.includes(sl);
    });
    if (hit) {
      points += 35;
      reasons.push("Sector focus matches");
    }
  }

  // Check size vs. raise (weight 35).
  if (pref.investmentSize.length > 0) {
    possible += 35;
    if (company.fundingAmount != null && inAnyBand(company.fundingAmount, pref.investmentSize)) {
      points += 35;
      reasons.push("Check size fits the raise");
    }
  }

  // Revenue band vs. company revenue (weight 20).
  if (pref.revenueRange.length > 0 && company.revenue != null) {
    possible += 20;
    if (inAnyBand(company.revenue, pref.revenueRange)) {
      points += 20;
      reasons.push("Revenue band matches");
    }
  }

  // Use-of-funds / stage overlap (weight 30).
  if (pref.useOfFunds.length > 0) {
    possible += 30;
    const stageWords = new Set([
      ...(company.revenueStage ? STAGE_WORDS[company.revenueStage] ?? [] : []),
      ...tokens(company.useOfFunds),
      ...tokens(company.industry),
    ]);
    const hit = pref.useOfFunds.some((u) => tokens(u).some((w) => stageWords.has(w)));
    if (hit) {
      points += 30;
      reasons.push("Use-of-funds / stage fit");
    }
  }

  // Active-investor rating quality (weight 15).
  const rating = activeRatingScore(pref);
  if (rating != null) {
    possible += 15;
    const r = Math.round((rating / 5) * 15);
    points += r;
    if (rating >= 4) reasons.push("Highly active investor");
  }

  // No structured preferences set → neutral 50 so they're not falsely excluded.
  if (possible === 0) return { score: 50, reasons: ["No stated preferences — neutral fit"] };

  return { score: Math.round((points / possible) * 100), reasons };
}
