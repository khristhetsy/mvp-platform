import { describe, expect, it } from "vitest";
import { dueFor } from "./summaries";
import { generateMilestones } from "./milestones";
import type { IrMilestone, IrProject } from "./types";

const project = (o: Partial<IrProject>): IrProject => ({ id: "p", company_id: null, founder_contact_id: null, title: "Doyle Organics", founder_name: "Michael Doyle", owner_id: "u", owner_name: null, source_opportunity_id: null, start_date: "2026-04-22", term_months: 6, end_date: "2026-10-07", status: "active", founder_report_visible: true, is_spv: false, starred: false, weekly_summary: true, monthly_summary: true, description: null, created_at: "", ...o });
const milestones: IrMilestone[] = generateMilestones("2026-04-22", 6).map((d, i) => ({ id: `m${i}`, project_id: "p", parent_id: null, kind: d.kind, label: d.label, starts_on: d.startsOn, ends_on: d.endsOn, sort_order: d.sortOrder, completed_at: null }));

describe("scheduled summaries", () => {
  it("weekly on Monday covers the most recently completed project week", () => {
    const due = dueFor(project({}), milestones, "2026-09-21");   // a Monday
    const w = due.find((d) => d.kind === "week");
    expect((w?.milestone.ends_on ?? "9") <= "2026-09-21").toBe(true);
    expect(w?.milestone.label).toBe("Week 21");                  // Apr 22 + 21×7 = Sep 16 ends Week 21
    expect(dueFor(project({}), milestones, "2026-09-22").find((d) => d.kind === "week")).toBeUndefined();   // Tuesday
  });
  it("monthly the day a month milestone ends, and never when the toggles are off", () => {
    expect(dueFor(project({}), milestones, "2026-09-09").find((d) => d.kind === "month")?.milestone.label).toBe("Month 5");   // Month 5 = Aug 12–Sep 8, ends_on Sep 9
    expect(dueFor(project({}), milestones, "2026-09-10").find((d) => d.kind === "month")).toBeUndefined();
    expect(dueFor(project({ weekly_summary: false, monthly_summary: false }), milestones, "2026-09-21")).toEqual([]);
  });
});
