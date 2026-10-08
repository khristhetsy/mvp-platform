import { describe, expect, it } from "vitest";
import { pickPendingTasks, platformToday } from "./pipeline-pending-task";

const row = (opportunity_id: string, due_date: string | null, title: string, created_at = "2026-10-01T00:00:00Z") => ({ opportunity_id, task_type: "Call", title, due_date, created_at });

describe("pickPendingTasks", () => {
  it("picks the soonest due open task per deal and counts the rest", () => {
    const out = pickPendingTasks([row("a", "2026-10-12", "later"), row("a", "2026-10-05", "first"), row("a", null, "undated")], "2026-10-08");
    expect(out.a).toEqual({ type: "Call", title: "first", due: "2026-10-05", state: "overdue", more: 2 });
  });
  it("classifies today and planned, and puts undated tasks after dated ones", () => {
    const out = pickPendingTasks([row("b", "2026-10-08", "today"), row("c", null, "undated"), row("c", "2026-10-20", "dated")], "2026-10-08");
    expect(out.b.state).toBe("today");
    expect(out.c).toMatchObject({ title: "dated", state: "planned", more: 1 });
  });
  it("returns nothing for deals without open tasks", () => {
    expect(pickPendingTasks([], "2026-10-08")).toEqual({});
  });
});

describe("platformToday", () => {
  it("uses Pacific time", () => {
    // 05:00 UTC on Oct 8 is still Oct 7 in Los Angeles.
    expect(platformToday(new Date("2026-10-08T05:00:00Z"))).toBe("2026-10-07");
  });
});
