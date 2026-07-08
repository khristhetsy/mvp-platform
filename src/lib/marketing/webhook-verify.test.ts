import { describe, it, expect } from "vitest";
import { verifySvixSignature, signSvix } from "./webhook-verify";

const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw"; // sample base64 secret shape
const ID = "msg_2abc";
const BODY = JSON.stringify({ type: "email.opened", data: { email_id: "re_123", to: ["a@b.com"] } });

describe("verifySvixSignature", () => {
  const now = 1_700_000_000_000;
  const ts = String(Math.floor(now / 1000));

  it("verifies a correctly signed payload", () => {
    const sig = signSvix(SECRET, ID, ts, BODY);
    expect(verifySvixSignature(SECRET, ID, ts, sig, BODY, { nowMs: now })).toBe(true);
  });

  it("accepts the multi-signature header format (space-separated v1 entries)", () => {
    const sig = signSvix(SECRET, ID, ts, BODY);
    const header = `v1,wrongsig ${sig}`;
    expect(verifySvixSignature(SECRET, ID, ts, header, BODY, { nowMs: now })).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sig = signSvix(SECRET, ID, ts, BODY);
    expect(verifySvixSignature(SECRET, ID, ts, sig, BODY + "x", { nowMs: now })).toBe(false);
  });

  it("rejects a wrong secret (the common misconfiguration)", () => {
    const sig = signSvix(SECRET, ID, ts, BODY);
    expect(verifySvixSignature("whsec_differentSecretValueAAAAAAAAAAAAAAAA=", ID, ts, sig, BODY, { nowMs: now })).toBe(false);
  });

  it("rejects a stale timestamp beyond the skew window", () => {
    const oldTs = String(Math.floor(now / 1000) - 60 * 10);
    const sig = signSvix(SECRET, ID, oldTs, BODY);
    expect(verifySvixSignature(SECRET, ID, oldTs, sig, BODY, { nowMs: now })).toBe(false);
  });

  it("returns false when required inputs are missing", () => {
    expect(verifySvixSignature(SECRET, "", ts, "v1,x", BODY, { nowMs: now })).toBe(false);
    expect(verifySvixSignature("", ID, ts, "v1,x", BODY, { nowMs: now })).toBe(false);
  });
});
