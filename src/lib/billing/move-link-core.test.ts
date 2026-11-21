import { describe, expect, it } from "vitest";
import { makeMoveLinkToken, moveLinkPath, verifyMoveLinkToken } from "./move-link-core";
import { makeAgreementLinkToken } from "./agreement-link-core";

const ID = "c1a16953-f410-4729-b66b-8ebb2ebf82cd";

describe("move link token", () => {
  it("round trips the profile id", () => {
    expect(verifyMoveLinkToken(makeMoveLinkToken(ID))).toBe(ID);
  });
  it("rejects a tampered, malformed or empty token", () => {
    const t = makeMoveLinkToken(ID);
    expect(verifyMoveLinkToken(t.slice(0, -1) + (t.endsWith("0") ? "1" : "0"))).toBeNull();
    expect(verifyMoveLinkToken("nope")).toBeNull();
    expect(verifyMoveLinkToken(`${ID}.`)).toBeNull();
    expect(verifyMoveLinkToken(null)).toBeNull();
    expect(verifyMoveLinkToken("x".repeat(200))).toBeNull();
  });
  it("does not accept an agreement link token", () => {
    expect(verifyMoveLinkToken(makeAgreementLinkToken(ID))).toBeNull();
  });
  it("builds the page path", () => {
    expect(moveLinkPath("a.b")).toBe("/billing/move?t=a.b");
  });
});
