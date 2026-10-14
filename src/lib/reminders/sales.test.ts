import { describe, expect, it } from "vitest";
import { salesTaskToReminder } from "@/lib/reminders/sales";
import { reminderGroup } from "@/lib/reminders/pt";

const base = { id: "abc", title: "Need to send the proposal", task_type: "Proposal", due_date: "2026-10-14", status: "open", done_at: null, contact_name: "Lonnie Hayward" };

describe("salesTaskToReminder", () => {
  it("prefixes the id and keeps the contact name", () => {
    const r = salesTaskToReminder(base);
    expect(r?.id).toBe("sales:abc");
    expect(r?.context).toBe("Lonnie Hayward");
    expect(r?.source).toBe("sales");
  });
  it("maps task types to reminder kinds", () => {
    expect(salesTaskToReminder({ ...base, task_type: "Call" })?.kind).toBe("call");
    expect(salesTaskToReminder({ ...base, task_type: "Email" })?.kind).toBe("follow_up");
    expect(salesTaskToReminder(base)?.kind).toBe("task");
  });
  it("skips tasks without a due date", () => {
    expect(salesTaskToReminder({ ...base, due_date: null })).toBeNull();
  });
  it("lands on the due day in PT so a task due today is grouped as today", () => {
    const r = salesTaskToReminder(base)!;
    expect(reminderGroup(r.due_at, new Date("2026-10-14T20:00:00Z"))).toBe("today");
    expect(reminderGroup(r.due_at, new Date("2026-10-15T20:00:00Z"))).toBe("late");
  });
  it("marks done tasks as done", () => {
    expect(salesTaskToReminder({ ...base, status: "done", done_at: "2026-10-14T18:00:00Z" })?.done_at).toBe("2026-10-14T18:00:00Z");
  });
});
