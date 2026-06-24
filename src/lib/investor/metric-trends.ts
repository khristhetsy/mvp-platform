/**
 * Pure derivations over company metric snapshots. No imports — safe to unit test
 * in isolation. Feeds the Private Market readiness sparkline and "filling fast".
 */

export type MetricSnapshot = {
  capturedAt: string; // ISO timestamp
  readinessScore: number | null;
  totalIndicated: number;
};

export type TrendDirection = "up" | "down" | "flat";

export type ReadinessTrend = {
  direction: TrendDirection;
  /** Latest readiness vs ~`windowDays` ago (or oldest available). Null if < 2 points. */
  delta: number | null;
  /** Readiness points oldest→newest (nulls dropped) for the sparkline. */
  sparkline: number[];
};

function sortedPoints<T>(
  snapshots: MetricSnapshot[],
  value: (s: MetricSnapshot) => number | null,
): { t: number; v: number }[] {
  return snapshots
    .map((s) => ({ t: new Date(s.capturedAt).getTime(), v: value(s) }))
    .filter((p): p is { t: number; v: number } => p.v != null && Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
}

/** Pick the most recent point at or before the cutoff; else the oldest available. */
function baselineAt(points: { t: number; v: number }[], cutoff: number) {
  let baseline = points[0];
  for (const p of points) {
    if (p.t <= cutoff) baseline = p;
    else break;
  }
  return baseline;
}

export function readinessTrend(snapshots: MetricSnapshot[], windowDays = 7): ReadinessTrend {
  const points = sortedPoints(snapshots, (s) => s.readinessScore);
  const sparkline = points.map((p) => p.v);
  if (points.length < 2) return { direction: "flat", delta: null, sparkline };

  const latest = points[points.length - 1];
  const cutoff = latest.t - windowDays * 24 * 60 * 60 * 1000;
  const baseline = baselineAt(points, cutoff);
  const delta = Math.round((latest.v - baseline.v) * 10) / 10;
  const direction: TrendDirection = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return { direction, delta, sparkline };
}

export type FillingFastOpts = {
  windowDays?: number;
  /** Minimum % growth in indicated interest over the window. */
  minPctGain?: number;
  /** Minimum absolute growth (currency) — filters out tiny moves. */
  minAbsGain?: number;
};

/** True when indicated interest grew meaningfully over the recent window. */
export function isFillingFast(
  snapshots: MetricSnapshot[],
  { windowDays = 7, minPctGain = 15, minAbsGain = 50_000 }: FillingFastOpts = {},
): boolean {
  const points = sortedPoints(snapshots, (s) => s.totalIndicated);
  if (points.length < 2) return false;

  const latest = points[points.length - 1];
  const cutoff = latest.t - windowDays * 24 * 60 * 60 * 1000;
  const baseline = baselineAt(points, cutoff);

  const absGain = latest.v - baseline.v;
  if (absGain < minAbsGain) return false;

  const pctGain = baseline.v > 0 ? (absGain / baseline.v) * 100 : latest.v > 0 ? Infinity : 0;
  return pctGain >= minPctGain;
}
