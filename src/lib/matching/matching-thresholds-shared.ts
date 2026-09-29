/**
 * The two thresholds the matching pass uses (Scheduled jobs, Matching pass,
 * Settings). Pure, so the settings tab and the server read them the same way.
 */
export type MatchingThresholds = { readiness: number; match: number };

export const DEFAULT_MATCHING_THRESHOLDS: MatchingThresholds = { readiness: 60, match: 60 };
export const THRESHOLD_MIN = 30;
export const THRESHOLD_MAX = 90;

export function validThreshold(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= THRESHOLD_MIN && n <= THRESHOLD_MAX;
}

/** Stored value, or the defaults for anything missing or out of range. */
export function readThresholds(v: unknown): MatchingThresholds {
  const o = v && typeof v === "object" ? (v as Partial<MatchingThresholds>) : {};
  return {
    readiness: validThreshold(o.readiness) ? o.readiness : DEFAULT_MATCHING_THRESHOLDS.readiness,
    match: validThreshold(o.match) ? o.match : DEFAULT_MATCHING_THRESHOLDS.match,
  };
}

/** How many of the scored companies reach the threshold. */
export function countAtOrAbove(scores: readonly number[], threshold: number): number {
  return scores.filter((s) => s >= threshold).length;
}
