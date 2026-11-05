import { describe, expect, it } from "vitest";
import { summarize, weekStartOf, type ReportTask } from "./metrics";

function t(p: Partial<ReportTask>): ReportTask {
  return {
    id: Math.random().toString(36).slice(2), source: "sales", title: "x", type: "Call", due: null, status: "open",
    assigneeId: "a", assigneeName: "Ann", createdById: "a", createdByName: "Ann", createdAt: "2026-11-02T10:00:00Z", doneAt: null,
    contactId: null, contactName: null, opportunityId: null, ...p,
  };
}

describe("task report metrics", () => {
  const today = "2026-11-05";
  const tasks = [
    t({ due: "2026-09-01" }), // overdue 30+
    t({ due: "2026-11-01" }), // overdue under 30
    t({ due: today }), // today
    t({ status: "done", doneAt: "2026-11-03T10:00:00Z" }),
    t({ assigneeId: null, assigneeName: null }),
    t({ source: "ir", due: "2026-12-01" }),
  ];
  const s = summarize(tasks, today, { total: 12, unlinked: 6 });

  it("counts totals", () => {
    expect(s.total).toBe(6);
    expect(s.done).toBe(1);
    expect(s.open).toBe(5);
    expect(s.overdue).toBe(2);
    expect(s.unassigned).toBe(1);
  });
  it("buckets aging", () => {
    expect(s.aging.over30).toBe(1);
    expect(s.aging.under30).toBe(1);
    expect(s.aging.today).toBe(1);
    expect(s.aging.later).toBe(2); // no date + Dec 1
  });
  it("computes the efficiency ratio as done over total", () => {
    expect(s.efficiency.ratio).toBeCloseTo((1 / 6) * 100, 5);
  });
  it("counts the last 8 weeks created and completed", () => {
    expect(s.weeks).toHaveLength(8);
    expect(s.weeks[7].weekStart).toBe("2026-11-02");
    expect(s.weeks[7].created).toBe(5);
    expect(s.weeks[7].completed).toBe(1);
  });
  it("flags plan items without a task", () => {
    expect(s.improvements.some((i) => i.title.startsWith("Marketing plan"))).toBe(true);
  });
  it("finds the Monday of a week", () => {
    expect(weekStartOf("2026-11-05")).toBe("2026-11-02");
    expect(weekStartOf("2026-11-08")).toBe("2026-11-02");
    expect(weekStartOf("2026-11-09")).toBe("2026-11-09");
  });
});
