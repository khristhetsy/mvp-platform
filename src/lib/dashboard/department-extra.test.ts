import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sales/pipelines", () => ({ listPipelines: vi.fn(async () => []) }));

import { loadAiSpend, loadMrr, loadSupportTimings, summariseOpportunities, yearAverage } from "./department-extra";

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-25T12:00:00Z");
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

function fakeDb(tables: Record<string, { data?: unknown[]; error?: unknown }>) {
  const q = (t: string) => {
    const r = tables[t] ?? { data: [] };
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "gte", "eq", "order", "limit", "in", "lt", "not"]) chain[m] = () => chain;
    chain.then = (res: (v: unknown) => unknown) => res({ data: r.data ?? [], error: r.error ?? null });
    return chain;
  };
  return { from: (t: string) => q(t) } as never;
}

describe("yearAverage", () => {
  it("averages only the last 365 days", () => {
    expect(yearAverage([{ t: NOW - DAY, v: 4 }, { t: NOW - 2 * DAY, v: 6 }, { t: NOW - 400 * DAY, v: 100 }], NOW)).toBe(5);
  });
  it("is null with no data", () => expect(yearAverage([], NOW)).toBeNull());
});

describe("summariseOpportunities", () => {
  const o = (over: Record<string, unknown>) => ({ id: "x", title: "t", status: "open", value_cents: 100_00, stage_id: "s", billing: "yearly", probability: 50, updated_at: iso(1), created_at: iso(1), ...over }) as never;
  it("totals pipeline, weighted value and MRR for open opportunities only", () => {
    const s = summariseOpportunities([o({}), o({ value_cents: 1200_00, billing: "monthly", probability: 100 }), o({ status: "won" })], NOW, 14);
    expect(s.open).toHaveLength(2);
    expect(s.pipelineValue).toBe(1300);
    expect(s.weightedValue).toBe(1250);
    expect(s.expectedMrr).toBe(1208);
    expect(s.wonCount).toBe(1);
  });
  it("counts stalled opportunities against the stalled window", () => {
    const s = summariseOpportunities([o({ updated_at: iso(20), value_cents: 500_00 }), o({ updated_at: iso(2) })], NOW, 14);
    expect(s.stalled).toEqual({ count: 1, value: 500, days: 14 });
  });
  it("gives a win rate per period, null when nothing was closed", () => {
    const s = summariseOpportunities([o({ status: "won", updated_at: iso(2) }), o({ status: "lost", updated_at: iso(3) }), o({ status: "lost", updated_at: iso(100) })], NOW, 14);
    expect(s.winRate.week).toBe(50);
    expect(s.winRate.month).toBe(50);
    expect(s.winRate.year).toBe(33);
    expect(summariseOpportunities([], NOW, 14).winRate.week).toBeNull();
  });
});

describe("loadSupportTimings", () => {
  it("measures hours to first reply and to resolution from real timestamps", async () => {
    const db = fakeDb({ support_requests: { data: [
      { created_at: iso(3), first_staff_reply_at: new Date(NOW - 3 * DAY + 4 * 3_600_000).toISOString(), resolved_at: new Date(NOW - 3 * DAY + 10 * 3_600_000).toISOString(), rating: 5 },
      { created_at: iso(2), first_staff_reply_at: null, resolved_at: null, rating: null },
    ] } });
    const [first, resolve, rating] = await loadSupportTimings(db, NOW);
    expect(first!.valueText).toBe("4h");
    expect(resolve!.valueText).toBe("10h");
    expect(rating!.valueText).toBe("5");
    expect(first!.higherIsWorse).toBe(true);
  });
  it("degrades to not available when the read fails", async () => {
    const out = await loadSupportTimings(fakeDb({ support_requests: { error: { message: "x" } } }), NOW);
    expect(out.every((m) => m.note?.startsWith("Not available"))).toBe(true);
  });
});

describe("loadAiSpend", () => {
  it("gives a ring fill only when a budget exists", async () => {
    const withBudget = await loadAiSpend(fakeDb({ ai_spend_events: { data: [{ created_at: iso(1), cost_usd: 25 }] }, ai_budgets: { data: [{ monthly_usd: 100 }] } }), NOW);
    expect(withBudget.percent).toBe(25);
    expect(withBudget.valueText).toBe("$25 of $100");
    const noBudget = await loadAiSpend(fakeDb({ ai_spend_events: { data: [{ created_at: iso(1), cost_usd: 25 }] }, ai_budgets: { data: [] } }), NOW);
    expect(noBudget.percent).toBeNull();
  });
});

describe("loadMrr", () => {
  it("uses the latest complete month and leaves out a year comparison for ending MRR", async () => {
    const db = fakeDb({ v_sales_forecast_actuals: { data: [
      { month: "2026-09-01", new_mrr_cents: 100_00, churned_mrr_cents: 0, ending_mrr_cents: 500_00 },
      { month: "2026-10-01", new_mrr_cents: 200_00, churned_mrr_cents: 50_00, ending_mrr_cents: 650_00 },
      { month: "2026-11-01", new_mrr_cents: 999_00, churned_mrr_cents: 0, ending_mrr_cents: 999_00 },
    ] } });
    const [added, churned, ending] = await loadMrr(db, NOW);
    expect(added!.value).toBe(200);
    expect(added!.changes?.month).toMatchObject({ current: 200, prior: 100, percent: 100 });
    expect(churned!.higherIsWorse).toBe(true);
    expect(ending!.value).toBe(650);
    expect(ending!.changes?.year).toBeUndefined();
    expect(added!.changes?.week).toBeUndefined();
  });
});
