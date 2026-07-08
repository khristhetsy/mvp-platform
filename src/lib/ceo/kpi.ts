// CEO Hub KPI engine — pure, unit-tested functions. No I/O. Weekly snapshots are the
// only stored grain; period views aggregate at read time; comparisons run on weekly
// run-rates (avg weekly value), never period-total vs week-total.

export type KpiDirection = "up_good" | "down_good";
export type KpiStatus = "g" | "y" | "r";
export type Period = "wk" | "mo" | "qtr" | "ytd";

export interface KpiThresholds {
  direction: KpiDirection;
  target: number;
  redLine: number;
}

/** g = on target, y = watch, r = off track. Direction-aware. Mirrors mockup kpiStatus. */
export function status(value: number, kpi: KpiThresholds): KpiStatus {
  if (kpi.direction === "up_good") {
    if (value >= kpi.target) return "g";
    if (value <= kpi.redLine) return "r";
    return "y";
  }
  // down_good
  if (value <= kpi.target) return "g";
  if (value >= kpi.redLine) return "r";
  return "y";
}

/**
 * Aggregate weekly values across a period:
 *   scalesWithPeriod=true  -> SUM (volume metrics)
 *   scalesWithPeriod=false -> AVG (rates, times, point-in-time)
 * Returns null for an empty set (UI shows n/a).
 */
export function aggregate(values: number[], scalesWithPeriod: boolean): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return scalesWithPeriod ? sum : sum / values.length;
}

export interface Comparison {
  pct: number; // signed percent change of current vs baseline
  good: boolean; // whether the move is in the KPI's favorable direction
}

/**
 * Compare current run-rate to a baseline run-rate (both avg weekly values).
 * Returns null when no baseline exists (pre-launch) so the UI can render n/a.
 */
export function compare(currentRunRate: number | null, baselineRunRate: number | null, direction: KpiDirection): Comparison | null {
  if (currentRunRate == null || baselineRunRate == null || baselineRunRate === 0) return null;
  const pct = Math.round(((currentRunRate - baselineRunRate) / Math.abs(baselineRunRate)) * 1000) / 10;
  const rose = currentRunRate >= baselineRunRate;
  const good = direction === "up_good" ? rose : !rose;
  return { pct, good };
}

/** Number of weeks in a period (Year = YTD from launch; caller may override). */
export function periodWeeks(period: Period, ytdWeeks = 6): number {
  switch (period) {
    case "wk": return 1;
    case "mo": return 4;
    case "qtr": return 13;
    case "ytd": return ytdWeeks;
  }
}

const POINTS: Record<KpiStatus, number> = { g: 1, y: 0.5, r: 0 };

/** Weighted department score on a 0–10 scale: Σ(weight×points)/Σweight × 10. */
export function deptScore(kpis: Array<{ status: KpiStatus; weight: number }>): number | null {
  const totalWeight = kpis.reduce((a, k) => a + k.weight, 0);
  if (totalWeight === 0) return null;
  const earned = kpis.reduce((a, k) => a + k.weight * POINTS[k.status], 0);
  return Math.round((earned / totalWeight) * 10 * 10) / 10;
}

/** Format a value for display given the registry fmt code. */
export function formatKpi(value: number, fmt: string): string {
  switch (fmt) {
    case "%": return `${value}%`;
    case "$": return `$${value}`;
    case "x": return `${value}×`;
    case "h": return `${value}h`;
    case "d": return `${value}d`;
    default: return String(value);
  }
}
