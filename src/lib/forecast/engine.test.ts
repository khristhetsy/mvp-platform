import { describe, it, expect } from "vitest";
import {
  runForecast, resolveDriver, ENGINE_VERSION, SEGMENTS,
  type AssumptionRow, type ForecastInput,
} from "./engine";

// Build a full global driver set from overrides; every driver must be present or the
// engine throws (by design). `month_to: 999` = open-ended.
function drivers(overrides: Record<string, number>): AssumptionRow[] {
  const base: Record<string, number> = {
    leads_per_month: 0, lead_growth_rate_mom: 0, lead_to_mql: 0, mql_to_sql: 0,
    sql_to_trial: 0, trial_to_paid: 0, avg_sales_cycle_days: 0, arpu_monthly: 10000,
    annual_prepay_mix: 0, price_change_pct: 0, logo_churn_monthly: 0,
    expansion_mrr_pct_monthly: 0, contraction_mrr_pct_monthly: 0,
  };
  const merged = { ...base, ...overrides };
  return Object.entries(merged).map(([driver_key, value]) => ({
    driver_key, segment: null, month_from: 0, month_to: 999, value,
  }));
}

const zeroAnchor = { endingMrrCents: { founder: 0, investor: 0 }, activeSubs: { founder: 0, investor: 0 } };

function input(over: Partial<ForecastInput> & { assumptions: AssumptionRow[] }): ForecastInput {
  return {
    horizonMonths: 12, startMonth: "2026-07-01", anchor: zeroAnchor, pipeline: [], blendMonths: 6,
    ...over,
  };
}

describe("resolveDriver", () => {
  const rows: AssumptionRow[] = [
    { driver_key: "arpu_monthly", segment: null, month_from: 0, month_to: 999, value: 100 },
    { driver_key: "arpu_monthly", segment: "founder", month_from: 6, month_to: 999, value: 200 },
    { driver_key: "leads_per_month", segment: null, month_from: 0, month_to: 0, value: 50 },
    { driver_key: "leads_per_month", segment: null, month_from: 1, month_to: 999, value: 80 },
  ];

  it("falls back to the global default", () => {
    expect(resolveDriver(rows, "arpu_monthly", "investor", 3)).toBe(100);
  });
  it("prefers a segment-specific override in range", () => {
    expect(resolveDriver(rows, "arpu_monthly", "founder", 8)).toBe(200);
    expect(resolveDriver(rows, "arpu_monthly", "founder", 2)).toBe(100); // before the override window
  });
  it("resolves stepped month ranges (most-specific open-ended)", () => {
    expect(resolveDriver(rows, "leads_per_month", "founder", 0)).toBe(50);
    expect(resolveDriver(rows, "leads_per_month", "founder", 5)).toBe(80);
  });
  it("throws on a missing driver — never a silent zero", () => {
    expect(() => resolveDriver(rows, "trial_to_paid", "founder", 1)).toThrow(/Missing forecast driver/);
  });
});

describe("funnel math", () => {
  it("computes the funnel and new MRR for month 1 (no lag)", () => {
    const out = runForecast(input({
      assumptions: drivers({
        leads_per_month: 100, lead_to_mql: 0.5, mql_to_sql: 0.5, sql_to_trial: 0.5,
        trial_to_paid: 0.5, avg_sales_cycle_days: 0, arpu_monthly: 10000,
      }),
    }));
    const f1 = out.rows.find((r) => r.month === 1 && r.segment === "founder")!;
    expect(f1.leads).toBe(100);
    expect(f1.mql).toBe(50);
    expect(f1.sql).toBe(25);
    expect(f1.trials).toBe(12.5);
    // 12.5 trials × 0.5 paid × $100 = $625 = 62500 cents; 6.25 subs.
    expect(f1.new_mrr).toBe(62500);
    expect(f1.new_subs).toBe(6.25);
    expect(f1.ending_mrr).toBe(62500);
  });

  it("applies month-over-month lead growth", () => {
    const out = runForecast(input({
      assumptions: drivers({ leads_per_month: 100, lead_growth_rate_mom: 0.1, lead_to_mql: 1 }),
    }));
    const f2 = out.rows.find((r) => r.month === 2 && r.segment === "founder")!;
    expect(f2.leads).toBe(110); // 100 × 1.1^(2-1)
  });
});

describe("cycle lag", () => {
  it("delays paid conversions by the sales cycle", () => {
    const out = runForecast(input({
      assumptions: drivers({
        leads_per_month: 100, lead_to_mql: 1, mql_to_sql: 1, sql_to_trial: 1,
        trial_to_paid: 1, avg_sales_cycle_days: 30, // → 1-month lag
      }),
    }));
    const f1 = out.rows.find((r) => r.month === 1 && r.segment === "founder")!;
    const f2 = out.rows.find((r) => r.month === 2 && r.segment === "founder")!;
    expect(f1.new_mrr).toBe(0);          // month-1 paid comes from month-0 trials (= 0)
    expect(f2.new_mrr).toBeGreaterThan(0); // month-2 paid comes from month-1 trials
  });
});

describe("churn compounding", () => {
  it("compounds logo churn on the anchored base with no new business", () => {
    const out = runForecast(input({
      anchor: { endingMrrCents: { founder: 100000, investor: 0 }, activeSubs: { founder: 10, investor: 0 } },
      assumptions: drivers({ logo_churn_monthly: 0.1 }),
    }));
    const f1 = out.rows.find((r) => r.month === 1 && r.segment === "founder")!;
    const f2 = out.rows.find((r) => r.month === 2 && r.segment === "founder")!;
    expect(f1.ending_mrr).toBe(90000);       // 100000 − 10%
    expect(f2.ending_mrr).toBe(81000);       // 90000 − 10%
    expect(f1.churned_mrr).toBe(10000);
  });
});

describe("blend zone", () => {
  it("layers pipeline into the near term and de-dups against the driver funnel", () => {
    const out = runForecast(input({
      pipeline: [{ segment: "founder", monthlyMrrCents: 50000, winProbability: 1, lagDays: 30 }],
      assumptions: drivers({ leads_per_month: 1, lead_to_mql: 1, mql_to_sql: 1, sql_to_trial: 1, trial_to_paid: 1, arpu_monthly: 10000 }),
    }));
    const f1 = out.rows.find((r) => r.month === 1 && r.segment === "founder")!;
    // driver new MRR (1 trial × $100 = 10000) < pipeline 50000 → blend takes the max.
    expect(f1.blend_pipeline_mrr).toBe(50000);
    expect(f1.new_mrr).toBe(50000);
  });

  it("stops blending after blendMonths", () => {
    const out = runForecast(input({
      blendMonths: 3,
      pipeline: [{ segment: "founder", monthlyMrrCents: 50000, winProbability: 1, lagDays: 150 }], // closes ~month 5
      assumptions: drivers({ leads_per_month: 1, lead_to_mql: 1, mql_to_sql: 1, sql_to_trial: 1, trial_to_paid: 1 }),
    }));
    const f5 = out.rows.find((r) => r.month === 5 && r.segment === "founder")!;
    expect(f5.blend_pipeline_mrr).toBe(0); // month 5 > blendMonths(3): no pipeline layer
  });
});

describe("golden structure", () => {
  it("produces a well-formed 36-month × 2-segment series with no NaN", () => {
    const out = runForecast(input({
      horizonMonths: 36,
      anchor: { endingMrrCents: { founder: 500000, investor: 200000 }, activeSubs: { founder: 40, investor: 15 } },
      assumptions: drivers({
        leads_per_month: 120, lead_growth_rate_mom: 0.04, lead_to_mql: 0.4, mql_to_sql: 0.5,
        sql_to_trial: 0.6, trial_to_paid: 0.3, avg_sales_cycle_days: 30, arpu_monthly: 49900,
        logo_churn_monthly: 0.03, expansion_mrr_pct_monthly: 0.01, contraction_mrr_pct_monthly: 0.005,
      }),
    }));
    expect(out.engineVersion).toBe(ENGINE_VERSION);
    expect(out.rows).toHaveLength(37 * SEGMENTS.length);
    expect(out.totals.endingMrrByMonth).toHaveLength(37);
    // Month 0 = anchor sum (500000 + 200000).
    expect(out.totals.endingMrrByMonth[0]).toBe(700000);
    // Every value finite; ARR = 12 × ending MRR.
    for (let m = 0; m <= 36; m++) {
      expect(Number.isFinite(out.totals.endingMrrByMonth[m])).toBe(true);
      expect(out.totals.arrByMonth[m]).toBe(out.totals.endingMrrByMonth[m] * 12);
    }
    // With healthy net-new > churn, MRR grows over the horizon.
    expect(out.totals.endingMrrByMonth[36]).toBeGreaterThan(out.totals.endingMrrByMonth[0]);
  });
});
