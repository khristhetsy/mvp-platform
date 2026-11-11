import { describe, expect, it } from "vitest";
import { toInsertRow } from "@/lib/notes-log";
import { canRemoveCampaign, linkedInLogInput } from "./store";

describe("linkedInLogInput", () => {
  it("makes a Notes log row for a sent LinkedIn message", () => {
    const row = toInsertRow(linkedInLogInput({ contactCrmId: "c1", direction: "outbound", text: "Thanks for connecting", targetId: "t1", externalId: "m1" }));
    expect(row.kind).toBe("message");
    expect(row.summary).toBe("LinkedIn message sent");
    expect(row.contact_crm_id).toBe("c1");
    expect(row.meta).toMatchObject({ direction: "outbound", preview: "Thanks for connecting", subject: "LinkedIn", external_id: "linkedin:m1", href: "/admin/linkedin?target=t1" });
  });
  it("makes a row for a reply and uses the original time", () => {
    const row = toInsertRow(linkedInLogInput({ contactCrmId: "c1", direction: "inbound", text: "Sounds good", targetId: "t1", externalId: "m2", occurredAt: new Date("2026-11-09T10:00:00Z") }));
    expect(row.summary).toBe("LinkedIn reply received");
    expect(row.created_at).toBe("2026-11-09T10:00:00.000Z");
  });
  it("uses a different idempotency key for each message", () => {
    const a = toInsertRow(linkedInLogInput({ contactCrmId: "c1", direction: "outbound", text: "x", targetId: "t1", externalId: "m1" }));
    const b = toInsertRow(linkedInLogInput({ contactCrmId: "c1", direction: "outbound", text: "x", targetId: "t1", externalId: "m2" }));
    expect(a.meta?.external_id).not.toBe(b.meta?.external_id);
  });
});

describe("canRemoveCampaign", () => {
  it("lets a draft, waiting for approval, stopped or finished campaign be archived or deleted", () => {
    for (const status of ["draft", "pending_approval", "stopped", "completed"] as const) expect(canRemoveCampaign(status)).toBe(true);
  });
  it("blocks a campaign that is queued, running or paused until it is stopped", () => {
    for (const status of ["ready", "running", "paused"] as const) expect(canRemoveCampaign(status)).toBe(false);
  });
});
