import { describe, expect, it } from "vitest";
import { claimSignUpUrl, looksLikeEmail } from "./claim-url";

describe("claimSignUpUrl", () => {
  it("builds the free founder sign up link with claim and partner", () => {
    expect(claimSignUpUrl({ email: "ceo@acme.com", claimToken: "abc.def", partnerCode: "AIX" })).toBe(
      "/auth/sign-up?role=founder&plan=founder_free&email=ceo%40acme.com&claim=abc.def&ref=AIX",
    );
  });
  it("omits claim and ref when absent", () => {
    expect(claimSignUpUrl({ email: " a@b.co " })).toBe("/auth/sign-up?role=founder&plan=founder_free&email=a%40b.co");
    expect(claimSignUpUrl({ email: "", claimToken: null, partnerCode: null })).toBe("/auth/sign-up?role=founder&plan=founder_free");
  });
});

describe("looksLikeEmail", () => {
  it("accepts plain addresses and rejects junk", () => {
    expect(looksLikeEmail("ceo@acme.com")).toBe(true);
    expect(looksLikeEmail("ceo@acme")).toBe(false);
    expect(looksLikeEmail("not an email")).toBe(false);
  });
});
