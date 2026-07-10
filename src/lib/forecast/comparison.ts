// Period comparison for the Comparison tab. Monthly/quarterly/yearly derive from
// v_sales_forecast_actuals (subscription MRR); weekly shows operational velocity
// (new opportunities per ISO week) since there is no snapshot at weekly grain.
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadActualsSeries } from "./store";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type Grain = "weekly" | "monthly" | "quarterly" | "yearly";
export interface PeriodPoint { label: string; newMrrCents: number; endingMrrCents: number; count: number }
export interface Comparison {
  grain: Grain;
  series: PeriodPoint[];              // chronological, last N periods
  current: PeriodPoint | null;
  previous: PeriodPoint | null;
  deltaPct: number | null;
  footnote: string;
}

function periodKey(month: string, grain: Grain): string {
  const [y, m] = month.slice(0, 7).split("-").map(Number);
  if (grain === "yearly") return `${y}`;
  if (grain === "quarterly") return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
  return `${y}-${String(m).padStart(2, "0")}`;
}

async function fromActuals(grain: Grain): Promise<PeriodPoint[]> {
  const series = await loadActualsSeries();
  // Sum segments per calendar month first.
  const byMonth = new Map<string, { newMrr: number; endingMrr: number }>();
  for (const s of series) {
    const k = String(s.month).slice(0, 7);
    const cur = byMonth.get(k) ?? { newMrr: 0, endingMrr: 0 };
    cur.newMrr += Number(s.new_mrr_cents) || 0;
    cur.endingMrr += Number(s.ending_mrr_cents) || 0;
    byMonth.set(k, cur);
  }
  const buckets = new Map<string, PeriodPoint>();
  for (const [month, v] of [...byMonth.entries()].sort()) {
    const key = periodKey(month, grain);
    const b = buckets.get(key) ?? { label: key, newMrrCents: 0, endingMrrCents: 0, count: 0 };
    b.newMrrCents += v.newMrr;
    b.endingMrrCents = v.endingMrr; // last month of the period wins (chronological)
    b.count += 1;
    buckets.set(key, b);
  }
  return [...buckets.values()];
}

async function weeklyVelocity(): Promise<PeriodPoint[]> {
  const { data } = await db().from("sales_opportunities").select("created_at").order("created_at", { ascending: true }).limit(5000);
  const rows = (data ?? []) as Array<{ created_at: string }>;
  const buckets = new Map<string, PeriodPoint>();
  for (const r of rows) {
    const d = new Date(r.created_at);
    // ISO week key
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    const key = `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
    const b = buckets.get(key) ?? { label: key, newMrrCents: 0, endingMrrCents: 0, count: 0 };
    b.count += 1;
    buckets.set(key, b);
  }
  return [...buckets.values()];
}

export async function getComparison(grain: Grain): Promise<Comparison> {
  const all = grain === "weekly" ? await weeklyVelocity() : await fromActuals(grain);
  const series = all.slice(-8);
  const current = series[series.length - 1] ?? null;
  const previous = series[series.length - 2] ?? null;
  const curVal = grain === "weekly" ? current?.count ?? 0 : current?.newMrrCents ?? 0;
  const prevVal = grain === "weekly" ? previous?.count ?? 0 : previous?.newMrrCents ?? 0;
  const deltaPct = prevVal !== 0 ? (curVal - prevVal) / prevVal : null;
  const footnote = grain === "weekly"
    ? "Weekly shows operational velocity (new opportunities) — no snapshot exists at weekly grain."
    : grain === "yearly"
      ? "Yearly compares recurring-revenue actuals year over year."
      : "Monthly/quarterly compare recurring-revenue actuals; variance vs. the Base snapshot lives on the Variance tab.";
  return { grain, series, current, previous, deltaPct, footnote };
}
