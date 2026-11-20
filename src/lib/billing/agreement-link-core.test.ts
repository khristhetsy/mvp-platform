import { describe, expect, it } from "vitest";
import { agreementLinkPath, makeAgreementLinkToken, verifyAgreementLinkToken } from "./agreement-link-core";
import { makePaidSignupToken } from "./paid-signup-core";

const ID = "3f6b0c7e-8a41-4d2b-9c55-1e2f3a4b5c6d";

describe("agreement link token", () => {
  it("round trips an organization id", () => {
    expect(verifyAgreementLinkToken(makeAgreementLinkToken(ID))).toBe(ID);
  });
  it("rejects a changed id, junk and a paid signup token", () => {
    const token = makeAgreementLinkToken(ID);
    expect(verifyAgreementLinkToken(`11111111-2222-4333-8444-555555555555.${token.split(".")[1]}`)).toBeNull();
    expect(verifyAgreementLinkToken("junk")).toBeNull();
    expect(verifyAgreementLinkToken(null)).toBeNull();
    expect(verifyAgreementLinkToken(makePaidSignupToken(ID))).toBeNull();
  });
  it("builds the link path", () => {
    expect(agreementLinkPath("a.b")).toBe("/agreement/premium?t=a.b");
  });
});
