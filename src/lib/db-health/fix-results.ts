/**
 * Before and after results for database load fixes, with no database access so it
 * can be tested. Every percentage is computed here from the stored request counts.
 * A measured "after" that has not been recorded stays null and is shown as not
 * measured, never estimated.
 */

export type FixResultRow = {
  area: string;
  label: string;
  step: number | null;
  sort_order: number;
  fixed_at: string | null;
  before_per_day: number;
  projected_per_day: number;
  after_per_day: number | null;
  measured_at: string | null;
  source: string;
  note: string | null;
};

export type Change = { percent: number; direction: "fewer" | "more" | "same" };

/** How much lower (or higher) `after` is than `before`, to one decimal. Null when it cannot be worked out. */
export function changeFrom(before: number, after: number | null): Change | null {
  if (after === null || !Number.isFinite(before) || before <= 0) return null;
  const percent = Math.round((Math.abs(before - after) / before) * 1000) / 10;
  return { percent, direction: after < before ? "fewer" : after > before ? "more" : "same" };
}

/** Share of the total, to one decimal. Null when there is no total. */
export function shareOf(part: number, total: number | null | undefined): number | null {
  if (!total || total <= 0) return null;
  return Math.round((part / total) * 1000) / 10;
}

export type FixResultView = {
  area: string;
  label: string;
  step: number | null;
  before: number;
  projected: number;
  measured: number | null;
  measuredAt: string | null;
  projectedChange: Change | null;
  measuredChange: Change | null;
  shareOfTotal: number | null;
  source: string;
  note: string | null;
};

export type FixResultsView = { total: FixResultView | null; areas: FixResultView[] };

export function buildFixResultsView(rows: FixResultRow[]): FixResultsView {
  const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);
  const totalRow = sorted.find((r) => r.area === "total") ?? null;
  const toView = (r: FixResultRow): FixResultView => ({
    area: r.area,
    label: r.label,
    step: r.step,
    before: r.before_per_day,
    projected: r.projected_per_day,
    measured: r.after_per_day,
    measuredAt: r.measured_at,
    projectedChange: changeFrom(r.before_per_day, r.projected_per_day),
    measuredChange: changeFrom(r.before_per_day, r.after_per_day),
    shareOfTotal: r.area === "total" ? null : shareOf(r.before_per_day, totalRow?.before_per_day),
    source: r.source,
    note: r.note,
  });
  return { total: totalRow ? toView(totalRow) : null, areas: sorted.filter((r) => r.area !== "total").map(toView) };
}

export function formatChange(c: Change | null): string {
  if (!c) return "";
  return c.direction === "same" ? "No change" : `${c.percent}% ${c.direction}`;
}
