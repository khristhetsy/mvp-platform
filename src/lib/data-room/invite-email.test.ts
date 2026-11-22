import { describe, expect, it } from "vitest";
import { buildDataRoomInviteEmail } from "./invite-email";

const base = {
  founderName: "Jane Founder",
  companyName: "Acme Inc",
  message: null,
  onePagerUrl: "https://icapos.com/f/acme?src=founder",
  appUrl: "https://icapos.com/investor/dashboard",
  expiresInDays: 30,
};

describe("buildDataRoomInviteEmail", () => {
  it("names the founder and company and links the one pager", () => {
    const e = buildDataRoomInviteEmail(base);
    expect(e.subject).toContain("Jane Founder");
    expect(e.subject).toContain("Acme Inc");
    expect(e.html).toContain("https://icapos.com/f/acme?src=founder");
  });

  it("includes the personal message when given", () => {
    const e = buildDataRoomInviteEmail({ ...base, message: "We would value your view." });
    expect(e.text).toContain("We would value your view.");
  });

  it("states the expiry, or that the founder can end access", () => {
    expect(buildDataRoomInviteEmail(base).text).toContain("30 days");
    expect(buildDataRoomInviteEmail({ ...base, expiresInDays: null }).text).toContain("any time");
  });

  it("falls back to the app link when there is no one pager", () => {
    const e = buildDataRoomInviteEmail({ ...base, onePagerUrl: null });
    expect(e.html).toContain("https://icapos.com/investor/dashboard");
  });
});
