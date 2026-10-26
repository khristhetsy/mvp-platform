import { describe, it, expect } from "vitest";
import { proposalActivity, safeInternalHref } from "./proposal-activity";
import { rowToItem, type NativeRow } from "./chatter-merge";

describe("proposalActivity", () => {
  it("links a delivered send to its first document", () => {
    const a = proposalActivity({ subject: "Proposal and term sheet for Archon Labs", delivered: true, via: "icapos", packetId: "p1", documentIds: ["d1", "d2"] });
    expect(a.summary).toBe("Proposal sent: Proposal and term sheet for Archon Labs");
    expect(a.meta).toMatchObject({ via: "icapos", packetId: "p1", delivered: true, href: "/admin/sales/contracts/d1", documentIds: ["d1", "d2"] });
  });
  it("says so when the email did not go out", () => {
    expect(proposalActivity({ subject: "Terms", delivered: false, packetId: "p1", documentIds: ["d1"] }).summary).toBe("Proposal not delivered: Terms");
  });
  it("omits the link when there are no documents and trims a long subject", () => {
    const a = proposalActivity({ subject: "x".repeat(300), delivered: true, packetId: "p1", documentIds: [] });
    expect(a.meta.href).toBeUndefined();
    expect(a.summary.length).toBeLessThanOrEqual("Proposal sent: ".length + 160);
  });
});

describe("safeInternalHref", () => {
  it("accepts admin paths only", () => {
    expect(safeInternalHref("/admin/sales/contracts/9f21c97b-d6ab-4300-b286-18026ba22793")).toBe("/admin/sales/contracts/9f21c97b-d6ab-4300-b286-18026ba22793");
    for (const bad of ["https://evil.example", "//evil.example", "/admin/../x?y=1", "javascript:alert(1)", "/founder/dashboard", null, 5]) {
      expect(safeInternalHref(bad)).toBeNull();
    }
  });
});

describe("timeline item", () => {
  const row = (p: Partial<NativeRow>): NativeRow => ({ id: "r1", kind: "email", summary: "Proposal sent: Terms", created_at: "2026-10-26T17:33:19Z", actor_name: "Khris Thetsy", edited_at: null, deleted_at: null, odoo_message_id: null, ...p });
  it("carries the link onto the item and groups the entry under Messages", () => {
    const item = rowToItem(row({ href: "/admin/sales/contracts/d1" }));
    expect(item.href).toBe("/admin/sales/contracts/d1");
    expect(item.group).toBe("message");
  });
  it("has no link when the row has none", () => {
    expect(rowToItem(row({})).href).toBeNull();
  });
});
