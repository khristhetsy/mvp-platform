// Measures that need more than a row count: averages of durations, sums of money, the monthly MRR
// view, and the Sales pipeline snapshot. Same rules as department-metrics.ts: every figure and every
// comparison comes from a real timestamp, and a period that cannot be measured is left out, never guessed.

import type { SupabaseClient } from "@supabase/supabase-js";
import { listPipelines } from "@/lib/sales/pipelines";
import {
  monthlyChanges,
  valueChange,
  PERIODS,
  type DepartmentMetric,
  type Period,
} from "@/lib/dashboard/department-metrics";

type Db = SupabaseClient<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const HISTORY_DAYS = 2 * 365;
const ROW_LIMIT = 5000;

const sinceIso = (nowMs: number) => new Date(nowMs - HISTORY_DAYS * DAY_MS).toISOString();
const round1 = (n: number) => Math.round(n * 10) / 10;

export function periodChanges(
  rows: { t: number; v: number }[],
  nowMs: number,
  agg: "sum" | "avg",
): Record<Period, ReturnType<typeof valueChange>> {
  return {
    week: valueChange(rows, nowMs, "week", agg),
    month: valueChange(rows, nowMs, "month", agg),
    year: valueChange(rows, nowMs, "year", agg),
  };
}

/** Average of the values whose timestamp is inside the last 365 days. */
export function yearAverage(rows: { t: number; v: number }[], nowMs: number): number | null {
  const xs = rows.filter((r) => r.t > nowMs - 365 * DAY_MS && r.t <= nowMs).map((r) => r.v);
  return xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
}

const unavailable = (m: Pick<DepartmentMetric, "id" | "department" | "label" | "detail">, note: string): DepartmentMetric => ({
  ...m, flowLabel: null, value: 0, valueText: "n/a", changes: null, weekly: null, note,
});

/** Customer Support: hours to the first staff reply and to resolution, plus the average rating. */
export async function loadSupportTimings(db: Db, nowMs: number): Promise<DepartmentMetric[]> {
  const first = { id: "support_first_response", department: "support" as const, label: "Time to first response", detail: "Average hours from a request being created to the first staff reply. The target is 48 hours." };
  const resolve = { id: "support_resolve_time", department: "support" as const, label: "Time to resolve", detail: "Average hours from a request being created to being resolved." };
  const rating = { id: "support_rating", department: "support" as const, label: "Average rating", detail: "Average rating founders gave to resolved requests." };
  try {
    const { data, error } = await db
      .from("support_requests")
      .select("created_at, first_staff_reply_at, resolved_at, rating")
      .gte("created_at", sinceIso(nowMs))
      .limit(ROW_LIMIT);
    if (error) throw error;
    const rows = (data ?? []) as Array<{ created_at: string; first_staff_reply_at: string | null; resolved_at: string | null; rating: number | null }>;
    const hours = (end: string | null, start: string) => (end ? (Date.parse(end) - Date.parse(start)) / HOUR_MS : NaN);
    const firstRows = rows
      .map((r) => ({ t: r.first_staff_reply_at ? Date.parse(r.first_staff_reply_at) : NaN, v: hours(r.first_staff_reply_at, r.created_at) }))
      .filter((r) => Number.isFinite(r.t) && Number.isFinite(r.v) && r.v >= 0);
    const resolveRows = rows
      .map((r) => ({ t: r.resolved_at ? Date.parse(r.resolved_at) : NaN, v: hours(r.resolved_at, r.created_at) }))
      .filter((r) => Number.isFinite(r.t) && Number.isFinite(r.v) && r.v >= 0);
    const rated = rows.filter((r) => typeof r.rating === "number").map((r) => r.rating as number);
    const make = (m: typeof first, rs: { t: number; v: number }[]): DepartmentMetric => {
      const avg = yearAverage(rs, nowMs);
      return {
        ...m, flowLabel: "hours on average", higherIsWorse: true, value: avg ?? 0,
        valueText: avg === null ? "no data" : `${avg}h`, changes: periodChanges(rs, nowMs, "avg"), weekly: null,
        source: "support_requests", href: "/admin/support",
        note: rows.length >= ROW_LIMIT ? `Counts the latest ${ROW_LIMIT} requests only.` : undefined,
      };
    };
    return [
      make(first, firstRows),
      make(resolve, resolveRows),
      {
        ...rating, flowLabel: null, value: rated.length ? round1(rated.reduce((a, b) => a + b, 0) / rated.length) : 0,
        valueText: rated.length ? String(round1(rated.reduce((a, b) => a + b, 0) / rated.length)) : "no ratings",
        changes: null, weekly: null, source: "support_requests", href: "/admin/support",
      },
    ];
  } catch {
    const note = "Not available: support requests could not be read.";
    return [unavailable(first, note), unavailable(resolve, note), unavailable(rating, note)];
  }
}

/** Administration: AI spend this calendar month against the monthly budgets. */
export async function loadAiSpend(db: Db, nowMs: number): Promise<DepartmentMetric> {
  const m = { id: "admin_ai_spend", department: "administration" as const, label: "AI spend vs budget", detail: "AI spend this calendar month against the monthly AI budgets added together." };
  try {
    const [spend, budgets] = await Promise.all([
      db.from("ai_spend_events").select("created_at, cost_usd").gte("created_at", sinceIso(nowMs)).limit(ROW_LIMIT),
      db.from("ai_budgets").select("monthly_usd"),
    ]);
    if (spend.error || budgets.error) throw spend.error ?? budgets.error;
    const rows = ((spend.data ?? []) as Array<{ created_at: string; cost_usd: number | null }>)
      .map((r) => ({ t: Date.parse(r.created_at), v: Number(r.cost_usd ?? 0) }))
      .filter((r) => Number.isFinite(r.t));
    const now = new Date(nowMs);
    const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const monthSpend = round1(rows.filter((r) => r.t >= monthStart).reduce((a, r) => a + r.v, 0));
    const budget = ((budgets.data ?? []) as Array<{ monthly_usd: number | null }>).reduce((a, r) => a + Number(r.monthly_usd ?? 0), 0);
    return {
      ...m, flowLabel: "USD spent", higherIsWorse: true, value: monthSpend,
      valueText: budget > 0 ? `$${monthSpend} of $${budget}` : `$${monthSpend}, no budget set`,
      percent: budget > 0 ? Math.min(100, Math.round((monthSpend / budget) * 100)) : null,
      changes: periodChanges(rows, nowMs, "sum"), weekly: null, source: "ai_spend_events", href: "/admin/ai-usage",
      note: rows.length >= ROW_LIMIT ? `Counts the latest ${ROW_LIMIT} events only.` : undefined,
    };
  } catch {
    return unavailable(m, "Not available: AI spend could not be read.");
  }
}

/** Sales: new, churned and ending MRR from the monthly forecast view. Latest complete month against the one before. */
export async function loadMrr(db: Db, nowMs: number): Promise<DepartmentMetric[]> {
  const base = [
    { id: "sales_mrr_new", department: "sales" as const, label: "New MRR", detail: "Monthly recurring revenue added in the latest complete month.", key: "new_mrr_cents", flow: "USD of new MRR", worse: false },
    { id: "sales_mrr_churned", department: "sales" as const, label: "Churned MRR", detail: "Monthly recurring revenue lost in the latest complete month.", key: "churned_mrr_cents", flow: "USD of churned MRR", worse: true },
    { id: "sales_mrr_ending", department: "sales" as const, label: "Ending MRR", detail: "Monthly recurring revenue at the end of the latest complete month.", key: "ending_mrr_cents", flow: "USD of MRR", worse: false },
  ];
  try {
    const { data, error } = await db.from("v_sales_forecast_actuals").select("month, new_mrr_cents, churned_mrr_cents, ending_mrr_cents");
    if (error) throw error;
    const rows = (data ?? []) as Array<Record<string, string | number | null>>;
    const now = new Date(nowMs);
    const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    return base.map((b) => {
      const byMonth = new Map<string, number>();
      for (const r of rows) {
        const month = String(r.month ?? "").slice(0, 7);
        if (!month || month >= thisMonth) continue;
        byMonth.set(month, (byMonth.get(month) ?? 0) + Number(r[b.key] ?? 0) / 100);
      }
      const series = [...byMonth.entries()].map(([month, v]) => ({ month, v: Math.round(v) })).sort((a, c) => a.month.localeCompare(c.month));
      const latest = series.length ? series[series.length - 1]!.v : null;
      const changes = monthlyChanges(series);
      // A stock figure: summing twelve month-end values for a year comparison would be meaningless.
      if (b.id === "sales_mrr_ending") delete changes.year;
      return {
        id: b.id, department: b.department, label: b.label, detail: b.detail, flowLabel: b.flow, higherIsWorse: b.worse,
        value: latest ?? 0, valueText: latest === null ? "no data" : `$${latest.toLocaleString("en-US")}`,
        changes: series.length ? changes : null, weekly: null, source: "v_sales_forecast_actuals", href: "/admin/sales/forecast",
        note: "Month and year only. A week cannot be read from monthly figures.",
      } satisfies DepartmentMetric;
    });
  } catch {
    return base.map((b) => unavailable(b, "Not available: the MRR view could not be read."));
  }
}

export type SalesSnapshot = {
  stages: DepartmentMetric[];
  openCount: number;
  pipelineValue: number;
  weightedValue: number;
  expectedMrr: number;
  /** Win rate by period, null when nothing was won or lost in that window. */
  winRate: Record<Period, number | null>;
  wonAllTime: number;
  bottleneck: string | null;
  stalled: { count: number; value: number; days: number };
  overdueTasks: number;
  topMovers: { id: string; name: string; stage: string; value: number }[];
  newOpportunities: DepartmentMetric;
};

type Opp = { id: string; title: string | null; status: string; value_cents: number | null; stage_id: string | null; billing: string | null; probability: number | null; updated_at: string | null; created_at: string | null };

/** Pure part of the snapshot, so it can be tested without a database. */
export function summariseOpportunities(opps: Opp[], nowMs: number, stalledDays: number) {
  const open = opps.filter((o) => o.status === "open");
  const won = opps.filter((o) => o.status === "won");
  const lost = opps.filter((o) => o.status === "lost");
  const winRate = Object.fromEntries(
    PERIODS.map((p) => {
      const since = nowMs - { week: 7, month: 30, year: 365 }[p] * DAY_MS;
      const inWin = (o: Opp) => o.updated_at != null && Date.parse(o.updated_at) >= since;
      const w = won.filter(inWin).length;
      const l = lost.filter(inWin).length;
      return [p, w + l > 0 ? Math.round((w / (w + l)) * 100) : null];
    }),
  ) as Record<Period, number | null>;
  const mrrCents = (o: Opp) => (o.value_cents == null ? 0 : o.billing === "monthly" ? o.value_cents : Math.round(o.value_cents / 12));
  const staleBefore = nowMs - stalledDays * DAY_MS;
  const stalled = open.filter((o) => o.updated_at && Date.parse(o.updated_at) < staleBefore);
  return {
    open,
    wonCount: won.length,
    winRate,
    pipelineValue: Math.round(open.reduce((a, o) => a + (o.value_cents ?? 0), 0) / 100),
    weightedValue: Math.round(open.reduce((a, o) => a + (o.value_cents ?? 0) * ((o.probability ?? 0) / 100), 0) / 100),
    expectedMrr: Math.round(open.reduce((a, o) => a + mrrCents(o), 0) / 100),
    stalled: { count: stalled.length, value: Math.round(stalled.reduce((a, o) => a + (o.value_cents ?? 0), 0) / 100), days: stalledDays },
  };
}

export async function loadSalesSnapshot(db: Db, nowMs: number): Promise<SalesSnapshot | null> {
  try {
    const [oppRes, pipelines, settings, tasks] = await Promise.all([
      db.from("sales_opportunities").select("id, title, status, value_cents, stage_id, billing, probability, updated_at, created_at"),
      listPipelines(),
      db.from("sales_settings").select("stalled_days").eq("id", "default").maybeSingle(),
      db.from("sales_tasks").select("id", { count: "exact", head: true }).eq("status", "open").lt("due_date", new Date(nowMs).toISOString().slice(0, 10)),
    ]);
    if (oppRes.error) throw oppRes.error;
    const opps = (oppRes.data ?? []) as Opp[];
    const stalledDays = (settings.data?.stalled_days as number | undefined) ?? 14;
    const sum = summariseOpportunities(opps, nowMs, stalledDays);
    const stages = (pipelines.find((p) => p.is_default) ?? pipelines[0])?.stages ?? [];
    const ordered = [...stages].sort((a, b) => a.sort_order - b.sort_order);
    const totalOpen = sum.open.length || 1;
    const stageMetrics: DepartmentMetric[] = ordered.map((s) => {
      const count = sum.open.filter((o) => o.stage_id === s.id).length;
      return {
        id: `sales_stage_${s.id}`, department: "sales", label: s.name, detail: "Open opportunities in this stage",
        flowLabel: null, value: count, percent: Math.round((count / totalOpen) * 100), changes: null, weekly: null,
        href: `/admin/sales/pipeline?stage=${s.id}`, source: "sales_opportunities",
        definition: "Open opportunities in this stage. The ring shows its share of the open funnel. Stage history is not stored, so there is no period comparison.",
      };
    });
    let bottleneck: string | null = null;
    for (let i = 1; i < stageMetrics.length; i++) {
      if (stageMetrics[i - 1]!.value > 0 && stageMetrics[i]!.value < stageMetrics[i - 1]!.value) {
        bottleneck = `${stageMetrics[i - 1]!.label} → ${stageMetrics[i]!.label}`;
        break;
      }
    }
    const stageName = new Map(ordered.map((s) => [s.id, s.name] as const));
    const topMovers = [...sum.open]
      .sort((a, b) => (b.value_cents ?? 0) - (a.value_cents ?? 0))
      .slice(0, 4)
      .map((o) => ({ id: o.id, name: o.title ?? "Opportunity", stage: (o.stage_id && stageName.get(o.stage_id)) || "No stage", value: Math.round((o.value_cents ?? 0) / 100) }));
    const created = opps.map((o) => (o.created_at ? Date.parse(o.created_at) : NaN)).filter((t) => Number.isFinite(t));
    const rowsForNew = created.map((t) => ({ t, v: 1 }));
    const newOpportunities: DepartmentMetric = {
      id: "sales_new_opps", department: "sales", label: "New opportunities", detail: "Opportunities created",
      flowLabel: "new opportunities", value: created.length, changes: periodChanges(rowsForNew, nowMs, "sum"), weekly: null,
      href: "/admin/sales/opportunities", source: "sales_opportunities", definition: "Every opportunity created, counted by its creation date.",
    };
    return {
      stages: stageMetrics, openCount: sum.open.length, pipelineValue: sum.pipelineValue, weightedValue: sum.weightedValue,
      expectedMrr: sum.expectedMrr, winRate: sum.winRate, wonAllTime: sum.wonCount, bottleneck, stalled: sum.stalled,
      overdueTasks: tasks.count ?? 0, topMovers, newOpportunities,
    };
  } catch {
    return null;
  }
}
