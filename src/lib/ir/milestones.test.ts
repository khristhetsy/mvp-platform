import { describe, it, expect } from "vitest";
import { generateMilestones, milestoneOn, formatRange, addDays } from "./milestones";

describe("generateMilestones", () => {
  it("a 6-month term yields 6 months and 24 weeks with contiguous 28 / 7 day spans", () => {
    const all = generateMilestones("2026-04-22", 6);
    const months = all.filter((m) => m.kind === "month"), weeks = all.filter((m) => m.kind === "week");
    expect(months).toHaveLength(6);
    expect(weeks).toHaveLength(24);
    expect(months[0]).toMatchObject({ label: "Month 1", startsOn: "2026-04-22", endsOn: "2026-05-20", sortOrder: 1 });
    expect(months[5]).toMatchObject({ label: "Month 6", startsOn: "2026-09-09", endsOn: "2026-10-07", sortOrder: 6 });
    // months tile the term
    for (let i = 1; i < months.length; i++) expect(months[i].startsOn).toBe(months[i - 1].endsOn);
    // weeks tile each month and number across the term
    expect(weeks[0]).toMatchObject({ label: "Week 1", startsOn: "2026-04-22", endsOn: "2026-04-29", monthIndex: 1 });
    expect(weeks[4]).toMatchObject({ label: "Week 5", startsOn: "2026-05-20", monthIndex: 2 });
    expect(weeks[23]).toMatchObject({ label: "Week 24", startsOn: "2026-09-30", endsOn: "2026-10-07", monthIndex: 6 });
    for (let i = 1; i < weeks.length; i++) expect(weeks[i].startsOn).toBe(weeks[i - 1].endsOn);
  });
  it("4 and 5 month terms scale", () => {
    expect(generateMilestones("2026-01-01", 4).filter((m) => m.kind === "week")).toHaveLength(16);
    expect(generateMilestones("2026-01-01", 5).filter((m) => m.kind === "week")).toHaveLength(20);
  });
  it("rejects bad input", () => {
    expect(() => generateMilestones("22/04/2026", 6)).toThrow();
    expect(() => generateMilestones("2026-04-22", 0)).toThrow();
  });
});

describe("helpers", () => {
  it("milestoneOn finds the containing span, end-exclusive", () => {
    const all = generateMilestones("2026-04-22", 6);
    const weeks = all.filter((m) => m.kind === "week");
    expect(milestoneOn(weeks, "2026-04-28")?.label).toBe("Week 1");
    expect(milestoneOn(weeks, "2026-04-29")?.label).toBe("Week 2");
    expect(milestoneOn(weeks, "2026-10-07")).toBeNull();
  });
  it("formatRange shows the last day inclusive", () => {
    expect(formatRange("2026-04-22", "2026-05-20")).toBe("Apr 22 to May 19, 2026");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
