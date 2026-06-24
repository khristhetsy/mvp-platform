/**
 * Pure derivations for the Investor Private Market board.
 *
 * Everything here is backed by data that already exists (pledge totals,
 * funding targets, readiness scores, match scores). No score-history or
 * velocity logic lives here — those are deferred to the snapshot fast-follow.
 */

export type ReadinessBandKey = "high" | "mid" | "low" | "none";

export type PrivateMarketDeal = {
  companyId: string;
  companyName: string;
  symbol: string;
  slug: string | null;
  industry: string | null;
  readinessScore: number | null;
  matchScore: number;
  /** Aggregate non-binding indicated interest across all investors, in `currency`. */
  totalIndicated: number;
  /** Fundraise target, if known. */
  fundingTarget: number | null;
  /** 0–100, or null when no target is known. */
  fillPct: number | null;
  currency: string;
};

export type PrivateMarketSummary = {
  matchedCount: number;
  /** Sum of this investor's own indications updated in the last 30 days. */
  indicated30d: number;
  /** Number of distinct deals the investor indicated on in the last 30 days. */
  indicated30dCount: number;
  avgReadiness: number | null;
};

/** Percent of a fundraise target that has been indicated. Null when target is unknown. */
export function fillPercent(totalIndicated: number, target: number | null): number | null {
  if (target == null || !Number.isFinite(target) || target <= 0) return null;
  if (!Number.isFinite(totalIndicated) || totalIndicated < 0) return 0;
  const pct = (totalIndicated / target) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/** Mean readiness across a set, ignoring nulls. One decimal. Null when nothing valid. */
export function averageReadiness(scores: Array<number | null | undefined>): number | null {
  const valid = scores.filter((s): s is number => typeof s === "number" && Number.isFinite(s));
  if (valid.length === 0) return null;
  const sum = valid.reduce((a, b) => a + b, 0);
  return Math.round((sum / valid.length) * 10) / 10;
}

/** Band + label for a readiness score. Mirrors the marketing/board thresholds. */
export function readinessBand(score: number | null | undefined): {
  key: ReadinessBandKey;
  label: string;
} {
  if (score == null || !Number.isFinite(score)) return { key: "none", label: "—" };
  if (score >= 80) return { key: "high", label: "Strong" };
  if (score >= 70) return { key: "mid", label: "Moderate" };
  return { key: "low", label: "Building" };
}

/** A short uppercase ticker derived from a company name (e.g. "FoxEyes Vision" → "FOXEYE"). */
export function toSymbol(name: string): string {
  const cleaned = name.replace(/[^a-z0-9]/gi, " ").trim();
  const firstWord = cleaned.split(/\s+/)[0] ?? "";
  const base = firstWord || name;
  return base.slice(0, 6).toUpperCase();
}
