import { describe, it, expect } from "vitest";
import { makeToken, verifyToken } from "@/lib/signed-links/tokens";

const ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("a token only opens what it was cut for", () => {
  it("round-trips its subject id", () => {
    const t = makeToken({ kind: "event_invite", id: ID, action: "respond" });
    expect(verifyToken({ token: t, kind: "event_invite", action: "respond" })).toBe(ID);
  });

  it("refuses a different action", () => {
    const t = makeToken({ kind: "event_invite", id: ID, action: "respond" });
    expect(verifyToken({ token: t, kind: "event_invite", action: "withdraw" })).toBeNull();
  });

  it("refuses a different kind — a booking link can't open an invitation", () => {
    const t = makeToken({ kind: "booking", id: ID, action: "cancel" });
    expect(verifyToken({ token: t, kind: "event_invite", action: "cancel" })).toBeNull();
  });

  it("refuses a tampered payload", () => {
    const t = makeToken({ kind: "event_invite", id: ID, action: "respond" });
    const [body, sig] = t.split(".");
    const forged = Buffer.from(
      JSON.stringify({ k: "event_invite", id: "someone-else", a: "respond", n: null, exp: Date.now() + 1000 }),
    ).toString("base64url");
    expect(verifyToken({ token: `${forged}.${sig}`, kind: "event_invite", action: "respond" })).toBeNull();
    expect(body).not.toBe(forged);
  });

  it("refuses garbage without throwing", () => {
    for (const junk of ["", "no-dot", "a.b", "....", "%%%.%%%"]) {
      expect(verifyToken({ token: junk, kind: "event_invite", action: "respond" })).toBeNull();
    }
  });
});

describe("expiry", () => {
  it("refuses a token past its expiry", () => {
    const t = makeToken({ kind: "event_invite", id: ID, action: "respond", expiresAt: Date.now() - 1 });
    expect(verifyToken({ token: t, kind: "event_invite", action: "respond" })).toBeNull();
  });

  it("accepts one that has not expired yet", () => {
    const exp = Date.now() + 60_000;
    const t = makeToken({ kind: "event_invite", id: ID, action: "respond", expiresAt: exp });
    expect(verifyToken({ token: t, kind: "event_invite", action: "respond", now: exp - 1 })).toBe(ID);
  });
});

describe("the nonce is what makes a link revocable", () => {
  it("accepts the nonce it was signed with", () => {
    const t = makeToken({ kind: "event_invite", id: ID, action: "respond", nonce: "n1" });
    expect(verifyToken({ token: t, kind: "event_invite", action: "respond", nonce: "n1" })).toBe(ID);
  });

  it("refuses once the row's nonce is rotated", () => {
    const t = makeToken({ kind: "event_invite", id: ID, action: "respond", nonce: "n1" });
    expect(verifyToken({ token: t, kind: "event_invite", action: "respond", nonce: "n2" })).toBeNull();
  });

  it("does not let a nonce-less token pass a nonce check", () => {
    const t = makeToken({ kind: "event_invite", id: ID, action: "respond" });
    expect(verifyToken({ token: t, kind: "event_invite", action: "respond", nonce: "n1" })).toBeNull();
  });
});
