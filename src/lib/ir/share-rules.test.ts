import { describe, expect, it } from "vitest";
import { canOpenShare, normShareEmail } from "./share-rules";

const link = { recipients: ["luke@lukekeith.com", "a+b@x.com"], expires_at: "2026-10-30T00:00:00Z", revoked_at: null };
const now = Date.parse("2026-10-01T00:00:00Z");

describe("share link rules", () => {
  it("lets a recipient in, ignoring case and spaces", () => {
    expect(canOpenShare(link, " Luke@LukeKeith.com ", now)).toEqual({ ok: true });
  });
  it("restores a plus sign read back as a space", () => {
    expect(normShareEmail("a b@x.com")).toBe("a+b@x.com");
    expect(canOpenShare(link, "a b@x.com", now)).toEqual({ ok: true });
  });
  it("refuses anyone not on the send", () => {
    expect(canOpenShare(link, "someone@else.com", now)).toEqual({ ok: false, reason: "not_recipient" });
    expect(canOpenShare(link, "", now)).toEqual({ ok: false, reason: "not_recipient" });
  });
  it("refuses after expiry and after revoke", () => {
    expect(canOpenShare(link, "luke@lukekeith.com", Date.parse("2026-11-01T00:00:00Z"))).toEqual({ ok: false, reason: "expired" });
    expect(canOpenShare({ ...link, revoked_at: "2026-09-30T00:00:00Z" }, "luke@lukekeith.com", now)).toEqual({ ok: false, reason: "revoked" });
  });
  it("never expires without an expiry date", () => {
    expect(canOpenShare({ ...link, expires_at: null }, "luke@lukekeith.com", Date.parse("2030-01-01T00:00:00Z"))).toEqual({ ok: true });
  });
});
