import { describe, expect, it, vi } from "vitest";
import {
  changeForPeriod,
  computeChange,
  departmentSpecs,
  loadDepartmentMetrics,
  openItemsByDepartment,
  periodWindow,
  weeklyBuckets,
  DEPARTMENT_ORDER,
  type DepartmentMetric,
} from "./department-metrics";

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-25T12:00:00Z");
const ago = (days: number) => NOW - days * DAY;

describe("computeChange", () => {
  it("reports percent change against the prior period", () => {
    expect(computeChange(12, 10)).toEqual({ current: 12, prior: 10, delta: 2, percent: 20, direction: "up" });
    expect(computeChange(5, 10)).toEqual({ current: 5, prior: 10, delta: -5, percent: -50, direction: "down" });
  });

  it("never invents a percentage when the prior period had none", () => {
    expect(computeChange(3, 0).percent).toBeNull();
    expect(computeChange(0, 0)).toMatchObject({ percent: null, direction: "flat" });
  });

  it("rounds to one decimal place", () => {
    expect(computeChange(2, 3).percent).toBe(-33.3);
  });
});

describe("periodWindow and changeForPeriod", () => {
  it("builds rolling windows of N days and the N days before", () => {
    const w = periodWindow(NOW, "week");
    expect(w.currentFrom).toBe(ago(7));
    expect(w.priorFrom).toBe(ago(14));
  });

  it("counts timestamps into the current and prior window", () => {
    const stamps = [ago(1), ago(3), ago(6.9), ago(8), ago(13), ago(20)];
    expect(changeForPeriod(stamps, NOW, "week")).toMatchObject({ current: 3, prior: 2 });
    expect(changeForPeriod(stamps, NOW, "month")).toMatchObject({ current: 6, prior: 0 });
  });

  it("ignores timestamps in the future", () => {
    expect(changeForPeriod([NOW + DAY], NOW, "week")).toMatchObject({ current: 0, prior: 0 });
  });
});

describe("weeklyBuckets", () => {
  it("returns twelve buckets, oldest first, the last being the latest 7 days", () => {
    const b = weeklyBuckets([ago(1), ago(2), ago(8), ago(83)], NOW);
    expect(b).toHaveLength(12);
    expect(b[11]).toBe(2);
    expect(b[10]).toBe(1);
    expect(b[0]).toBe(1);
  });

  it("drops readings older than the window", () => {
    expect(weeklyBuckets([ago(90)], NOW).every((n) => n === 0)).toBe(true);
  });
});

describe("departmentSpecs", () => {
  it("covers the four departments and gives every metric a unique id", () => {
    const specs = departmentSpecs(new Date(NOW).toISOString());
    const ids = specs.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of DEPARTMENT_ORDER) expect(specs.some((s) => s.department === d)).toBe(true);
  });
});

describe("loadDepartmentMetrics", () => {
  function fakeDb(opts: { fail?: string }) {
    const builder = (table: string) => {
      const state = { head: false };
      const q: Record<string, unknown> = {};
      const chain = () => q;
      for (const m of ["eq", "neq", "in", "ilike", "lt", "not", "gte", "order"]) q[m] = chain;
      q.select = (_c: string, o?: { head?: boolean }) => {
        state.head = Boolean(o?.head);
        return q;
      };
      q.limit = () => Promise.resolve({ data: [{ created_at: new Date(ago(2)).toISOString(), occurred_at: null, published_at: null, resolved_at: null }], error: null });
      q.then = (resolve: (v: unknown) => unknown) =>
        resolve(state.head ? (opts.fail === table ? { count: null, error: { message: "x" } } : { count: 4, error: null }) : { data: [], error: null });
      return q;
    };
    return { from: vi.fn((t: string) => builder(t)) } as never;
  }

  it("returns one metric per spec", async () => {
    const out = await loadDepartmentMetrics(fakeDb({}), new Date(NOW));
    expect(out.length).toBe(departmentSpecs("").length);
    expect(out.find((m) => m.id === "sales_companies")).toMatchObject({ value: 4 });
    expect(out.find((m) => m.id === "sales_companies")?.changes?.week.current).toBe(1);
  });

  it("degrades one tile instead of the page when a query fails", async () => {
    const out = await loadDepartmentMetrics(fakeDb({ fail: "support_requests" }), new Date(NOW));
    const support = out.find((m) => m.id === "support_open");
    expect(support?.note).toMatch(/Not available/);
    expect(support?.changes).toBeNull();
    expect(out.find((m) => m.id === "sales_companies")?.note).toBeUndefined();
  });
});

describe("openItemsByDepartment", () => {
  const m = (department: DepartmentMetric["department"], value: number, extra: Partial<DepartmentMetric> = {}): DepartmentMetric => ({
    id: `${department}-${value}`, department, label: "x", value, detail: "", flowLabel: null, changes: null, weekly: null, openItem: true, ...extra,
  });

  it("sums open-item metrics per department and marks departments with none as unmeasured", () => {
    const rows = openItemsByDepartment([m("support", 3), m("support", 2), m("administration", 7), m("sales", 9, { openItem: false })]);
    expect(rows.find((r) => r.department === "support")).toMatchObject({ measured: true, total: 5 });
    expect(rows.find((r) => r.department === "administration")?.total).toBe(7);
    expect(rows.find((r) => r.department === "marketing")).toMatchObject({ measured: false, total: 0 });
    expect(rows.find((r) => r.department === "sales")?.measured).toBe(false);
  });

  it("leaves out a metric whose count could not be read", () => {
    const rows = openItemsByDepartment([m("support", 3, { note: "Not available" })]);
    expect(rows.find((r) => r.department === "support")?.measured).toBe(false);
  });
});

import { changeBreakdown, describeChange, shareOf } from "./department-metrics";

describe("describeChange", () => {
  const metric = (over: Partial<DepartmentMetric> = {}): DepartmentMetric => ({
    id: "m", department: "sales", label: "Companies", value: 48, detail: "", flowLabel: "new companies", weekly: null,
    changes: { week: computeChange(12, 10), month: computeChange(0, 0), year: computeChange(3, 0) }, ...over,
  });

  it("shows arrow, percent and the counts behind it", () => {
    expect(describeChange(metric(), "week")).toEqual({ text: "▲ 20% · 12 new companies vs 10 in the prior week", tone: "good" });
  });

  it("reads an up arrow as bad when higher is worse", () => {
    expect(describeChange(metric({ higherIsWorse: true }), "week")?.tone).toBe("bad");
  });

  it("says so instead of printing a percent when the prior period had none", () => {
    expect(describeChange(metric(), "year")).toEqual({ text: "▲ 3 new companies this year, none in the prior year", tone: "good" });
  });

  it("returns nothing when there is no change or no measured flow", () => {
    expect(describeChange(metric(), "month")).toBeNull();
    expect(describeChange(metric({ changes: null }), "week")).toBeNull();
    expect(describeChange(metric({ flowLabel: null }), "week")).toBeNull();
  });
});

describe("changeBreakdown", () => {
  it("lists all three periods for the drawer", () => {
    const rows = changeBreakdown({
      id: "m", department: "sales", label: "x", value: 1, detail: "", flowLabel: "new", weekly: null,
      changes: { week: computeChange(12, 10), month: computeChange(5, 10), year: computeChange(3, 0) },
    });
    expect(rows).toHaveLength(3);
    expect(rows[0]!.value).toBe("12 vs 10 · +20%");
    expect(rows[1]!.value).toBe("5 vs 10 · -50%");
    expect(rows[2]!.value).toContain("nothing in the prior period");
  });
  it("is empty when no flow is measured", () => {
    expect(changeBreakdown({ id: "m", department: "sales", label: "x", value: 1, detail: "", flowLabel: null, weekly: null, changes: null })).toEqual([]);
  });
});

describe("shareOf", () => {
  it("returns whole percent shares of a real total", () => {
    expect(shareOf([{ label: "a", value: 19 }, { label: "b", value: 1 }]).map((p) => p.percent)).toEqual([95, 5]);
  });
  it("returns null shares when the total is zero", () => {
    expect(shareOf([{ label: "a", value: 0 }])[0]!.percent).toBeNull();
  });
});
