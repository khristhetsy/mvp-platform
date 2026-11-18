import { describe, expect, it } from "vitest";
import { afterGoogleStepPath, shouldOfferGoogleStep } from "./google-step";

describe("google step", () => {
  it("is offered to new founders and investors only", () => {
    expect(shouldOfferGoogleStep({ isNewProfile: true, role: "founder" })).toBe(true);
    expect(shouldOfferGoogleStep({ isNewProfile: true, role: "investor" })).toBe(true);
    expect(shouldOfferGoogleStep({ isNewProfile: true, role: "admin" })).toBe(false);
    expect(shouldOfferGoogleStep({ isNewProfile: false, role: "founder" })).toBe(false);
  });

  it("does not interrupt a person who was already headed somewhere", () => {
    expect(shouldOfferGoogleStep({ isNewProfile: true, role: "founder", next: "/e/x" })).toBe(false);
  });

  it("sends people on to their own onboarding", () => {
    expect(afterGoogleStepPath("investor")).toBe("/investor/onboarding");
    expect(afterGoogleStepPath("founder")).toBe("/founder/onboarding");
  });
});
