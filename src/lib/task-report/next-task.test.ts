import { describe, expect, it } from "vitest";
import { buildQueue, dueText, nextInQueue, parseQueue } from "./next-task";

const row = (id: string, contact: string, status: "open" | "done" = "open", href = `/admin/sales/contacts/${contact}?tab=tasks`) =>
  ({ id, href, status, type: "Call", contactName: contact, due: "2026-11-06" });

describe("buildQueue", () => {
  it("keeps open contact tasks in order, one per contact", () => {
    const q = buildQueue([row("1", "a"), row("2", "a"), row("3", "b", "done"), row("4", "c"), row("5", "x", "open", "/admin/tasks")]);
    expect(q.map((i) => i.id)).toEqual(["1", "4"]);
  });
});

describe("nextInQueue", () => {
  const q = buildQueue([row("1", "a"), row("2", "b"), row("3", "c")]);
  it("returns the contact after the current one", () => {
    expect(nextInQueue(q, "/admin/sales/contacts/a")?.id).toBe("2");
    expect(nextInQueue(q, "/admin/sales/contacts/b?tab=tasks")?.id).toBe("3");
  });
  it("returns null on the last contact or when the contact is not queued", () => {
    expect(nextInQueue(q, "/admin/sales/contacts/c")).toBeNull();
    expect(nextInQueue(q, "/admin/sales/contacts/zzz")).toBeNull();
    expect(nextInQueue([], "/admin/sales/contacts/a")).toBeNull();
  });
});

describe("dueText", () => {
  it("labels overdue, today, future and missing dates", () => {
    expect(dueText("2026-11-06", "2026-11-11")).toEqual({ text: "5d overdue", overdue: true });
    expect(dueText("2026-11-11", "2026-11-11")).toEqual({ text: "Today", overdue: false });
    expect(dueText("2026-11-20", "2026-11-11")).toEqual({ text: "2026-11-20", overdue: false });
    expect(dueText(null, "2026-11-11")).toEqual({ text: "No date", overdue: false });
  });
});

describe("parseQueue", () => {
  it("reads a saved queue and ignores empty or broken values", () => {
    expect(parseQueue(JSON.stringify([{ id: "1", href: "/admin/sales/contacts/a", type: null, contactName: null, due: null }]))).toHaveLength(1);
    expect(parseQueue(null)).toEqual([]);
    expect(parseQueue("not json")).toEqual([]);
    expect(parseQueue('{"a":1}')).toEqual([]);
  });
});
