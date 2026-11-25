import { describe, expect, it } from "vitest";
import { compose, type ComposeInput } from "./admin-dashboard";
import type { DepartmentMetric } from "./department-metrics";

const m = (id: string, department: DepartmentMetric["department"], label: string, value: number, extra: Partial<DepartmentMetric> = {}): DepartmentMetric => ({
  id, department, label, value, detail: "", flowLabel: null, changes: null, weekly: null, href: `/admin/${id}`, ...extra,
});

const base = (over: Partial<ComposeInput> = {}): ComposeInput => ({
  metrics: [
    m("sales_companies", "sales", "Companies", 48),
    m("sales_investors", "sales", "Investors", 3),
    m("sales_active_raises", "sales", "Active raises", 17, { definition: "Published listings" }),
    m("sales_pending_reviews", "sales", "Companies awaiting review", 0, { openItem: true, higherIsWorse: true }),
    m("admin_compliance", "administration", "Open compliance events", 11, { openItem: true, higherIsWorse: true }),
    m("admin_upgrades", "administration", "Upgrade requests", 14, { openItem: true, higherIsWorse: true }),
    m("support_open", "support", "Open requests", 6, { openItem: true, higherIsWorse: true }),
    m("support_overdue", "support", "Past due date", 2, { higherIsWorse: true }),
  ],
  sales: null, campaigns: [], oldestRequests: [], loadedAt: "2026-11-25T12:00:00Z", ...over,
});

describe("compose", () => {
  it("returns the five tabs in order", () => {
    expect(compose(base()).map((t) => t.id)).toEqual(["dashboard", "sales", "marketing", "support", "administration"]);
  });

  it("shows active raises as a share of companies only when companies exist", () => {
    const dash = compose(base())[0]!;
    expect(dash.pill).toBe("17 active raises · 35% of companies");
    expect(dash.rings.find((r) => r.id === "sales_active_raises")?.percent).toBe(35);
    const none = compose(base({ metrics: [m("sales_companies", "sales", "Companies", 0), m("sales_active_raises", "sales", "Active raises", 4)] }))[0]!;
    expect(none.pill).toBe("4 active raises");
  });

  it("lists the largest waiting queues first in Needs you today and never double counts past due", () => {
    const dash = compose(base())[0]!;
    expect(dash.need.map((n) => n.value)).toEqual(["14", "11", "6", "2"]);
    expect(dash.need.at(-1)!.label).toBe("requests past their due date");
    expect(dash.rows.find((r) => r.tab === "support")?.value).toBe("6 open");
  });

  it("marks a department with no open item counts as not measured", () => {
    const dash = compose(base())[0]!;
    expect(dash.rows.find((r) => r.tab === "marketing")?.value).toBe("Not measured");
  });

  it("leaves a metric whose read failed out of totals and the need strip", () => {
    const dash = compose(base({ metrics: [m("admin_compliance", "administration", "Open compliance events", 0, { openItem: true, note: "Not available" })] }))[0]!;
    expect(dash.need).toEqual([]);
    expect(dash.rows.find((r) => r.tab === "administration")?.value).toBe("Not measured");
  });

  it("says nothing is waiting instead of inventing an action", () => {
    const empty = compose(base({ metrics: [] }));
    expect(empty[0]!.actions[0]).toMatchObject({ tone: "good" });
    expect(empty[0]!.advisor).toMatch(/Nothing measured/);
  });

  it("builds the Sales tab from the snapshot with opportunity links and a win rate per period", () => {
    const sales = {
      stages: [m("sales_stage_a", "sales", "Pending", 244, { percent: 62 })], openCount: 395, pipelineValue: 148884, weightedValue: 130546, expectedMrr: 53092,
      winRate: { week: null, month: 21, year: 33 }, wonAllTime: 128, bottleneck: "A → B", stalled: { count: 393, value: 148884, days: 14 }, overdueTasks: 256,
      topMovers: [{ id: "abc", name: "Deal", stage: "Proposal", value: 50000 }], newOpportunities: m("sales_new_opps", "sales", "New opportunities", 9),
    };
    const tab = compose(base({ sales }))[1]!;
    expect(tab.subtitle).toBe("395 in funnel");
    expect((tab.pill as Record<string, string>).week).toContain("none won or lost");
    expect((tab.pill as Record<string, string>).month).toContain("21%");
    expect(tab.rows[0]).toMatchObject({ href: "/admin/sales/opportunities/abc", value: "Proposal · $50,000" });
    expect(tab.actions.map((a) => a.href)).toEqual(["/admin/sales/pipeline", "/admin/sales/tasks"]);
    expect(tab.need.map((n) => n.label)).toContain("deals stalled 14d+");
  });

  it("reports the pipeline as not available when the snapshot could not be read", () => {
    const tab = compose(base())[1]!;
    expect(tab.rings[0]!.note).toMatch(/Not available/);
    expect(tab.summary[0]).toMatch(/could not be read/);
  });

  it("keeps every tab's visible rings to nine or fewer", () => {
    for (const t of compose(base())) expect(t.rings.length).toBeLessThanOrEqual(9);
  });
});
