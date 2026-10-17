import { describe, expect, it } from "vitest";
import { attachContactLinks, contactReminderHref } from "@/lib/reminders/contact-links";

describe("contact reminder links", () => {
  it("points at the contact Tasks tab", () => {
    expect(contactReminderHref("abc-123")).toBe("/founder/contacts/abc-123?tab=tasks");
  });

  it("adds the contact name and link, and drops contact_id", () => {
    const rows = [{ id: "r1", title: "Call Liam", contact_id: "c1" }];
    const [row] = attachContactLinks(rows, new Map([["c1", "Liam Donohue"]]));
    expect(row).toEqual({ id: "r1", title: "Call Liam", context: "Liam Donohue", href: "/founder/contacts/c1?tab=tasks" });
  });

  it("still links when the contact name is not found", () => {
    const [row] = attachContactLinks([{ id: "r1", contact_id: "c9" }], new Map());
    expect(row).toEqual({ id: "r1", href: "/founder/contacts/c9?tab=tasks" });
  });

  it("leaves reminders with no contact untouched", () => {
    const [row] = attachContactLinks([{ id: "r2", title: "Personal", contact_id: null }], new Map());
    expect(row).toEqual({ id: "r2", title: "Personal" });
  });
});
