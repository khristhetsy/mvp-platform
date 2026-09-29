import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildInviteEmail, buildMaterialsReminderEmail } from "./invite-emails";
import type { PresenterInvite } from "./invites";

const invite = {
  email: "sam@example.com",
  displayName: "Sam Park",
  role: Object.keys((await import("./invite-rules")).INVITE_ROLES)[0],
  eventTitle: "Capital Readiness Day",
  materialsDue: "2026-10-09",
  note: "We'd love <you> there",
} as unknown as PresenterInvite;

describe("event invite emails", () => {
  it("invites with the event, role and an escaped note", () => {
    const m = buildInviteEmail(invite, "https://icapos.com/r/1");
    expect(m.subject).toBe("You're invited to Capital Readiness Day");
    expect(m.html).toContain("Hi Sam,");
    expect(m.html).toContain("We&#39;d love &lt;you&gt; there");
    expect(m.text).toContain("Accept or decline: https://icapos.com/r/1");
  });

  it("reminds with only the outstanding items", () => {
    const m = buildMaterialsReminderEmail(invite, "https://icapos.com/r/1", ["Deck"]);
    expect(m.subject).toBe("Still needed for Capital Readiness Day: deck");
    expect(m.text).toContain("[ ] Deck");
    expect(m.html).toContain("1 item still needed");
  });
});
