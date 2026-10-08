import { describe, it, expect } from "vitest";
import { reportCaptions } from "@/lib/ir/report-captions";

const base = {
  period: { start: "2026-09-23", end: "2026-10-21", kind: "month" as const, label: "Month 1 · Sep 23 to Oct 20, 2026" },
  pipeline: [
    { stage: "matched" as const, label: "Matched", count: 3 },
    { stage: "contacted" as const, label: "Contacted", count: 54 },
    { stage: "meeting_scheduled" as const, label: "Meeting scheduled", count: 3 },
  ],
  asOf: "As of Oct 20, 2026",
  trend: { kind: "month" as const, labels: ["Month 1"], intros: [0], held: [1] },
  prevMetrics: null,
};

describe("report captions", () => {
  it("names the period, the as-of date and the matched total from the report itself", () => {
    const c = reportCaptions(base as never);
    expect(c.activity).toContain("What your team did from Sep 23 to Oct 20, 2026 only.");
    expect(c.funnel).toContain("60 matched investors stood on Oct 20, 2026");
    expect(c.pipelineTable).toContain("all 60 matched investors");
    expect(c.trend).toContain("in each month of your project");
    expect(c.cards).toBe("Figures for Month 1 · Sep 23 to Oct 20, 2026 only.");
  });

  it("mentions Previous and Change only when there is a previous period", () => {
    expect(reportCaptions(base as never).activity).not.toContain("Previous and Change");
    expect(reportCaptions({ ...base, prevMetrics: { intros: 0 } } as never).activity).toContain("Previous and Change compare with the period before.");
  });

  it("says investor, not investors, for one", () => {
    const one = { ...base, pipeline: [{ stage: "matched", label: "Matched", count: 1 }] };
    expect(reportCaptions(one as never).funnel).toContain("your 1 matched investor stood");
  });
});
