import { describe, it, expect } from "vitest";
import { pickNextActivity, classify } from "./contact-next-activity";

const T = "2026-09-13";
const row = (o: Partial<{ contact_crm_id: string; task_type: string | null; title: string | null; due_date: string | null; status: string; done_at: string | null; created_at: string }>) => ({
  contact_crm_id: "c1", task_type: "Call", title: "t", due_date: null, status: "open", done_at: null, created_at: "2026-09-01", ...o,
});

describe("classify", () => {
  it("buckets by due date against today", () => {
    expect(classify("2026-09-10", T)).toBe("overdue");
    expect(classify(T, T)).toBe("today");
    expect(classify("2026-09-20", T)).toBe("planned");
    expect(classify(null, T)).toBe("planned");
  });
});

describe("pickNextActivity", () => {
  it("shows the soonest open task, dated before undated", () => {
    const m = pickNextActivity([row({ due_date: null, title: "undated" }), row({ due_date: "2026-09-20", title: "later" }), row({ due_date: "2026-09-10", title: "soon" })], T);
    expect(m.get("c1")).toMatchObject({ title: "soon", state: "overdue" });
  });
  it("falls back to the latest completed task when nothing is open", () => {
    const m = pickNextActivity([row({ status: "done", done_at: "2026-09-01", title: "old" }), row({ status: "done", done_at: "2026-09-05", title: "new" })], T);
    expect(m.get("c1")).toMatchObject({ title: "new", state: "done" });
  });
  it("prefers an open task over a done one and keeps contacts separate", () => {
    const m = pickNextActivity([row({ status: "done", done_at: "2026-09-12" }), row({ due_date: "2026-09-13", title: "open" }), row({ contact_crm_id: "c2", status: "done", done_at: "2026-09-02" })], T);
    expect(m.get("c1")).toMatchObject({ title: "open", state: "today" });
    expect(m.get("c2")?.state).toBe("done");
  });
});
