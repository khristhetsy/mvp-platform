import { describe, expect, it } from "vitest";
import {
  SIGNUP_FOUNDER_PLANS,
  isAutoGrantSignupPlan,
  parseRequestedPlan,
  planLabelFor,
} from "@/lib/subscriptions/plans";

/**
 * The free founder tier was removed once (commit d368fdb) and silently restored
 * hours later (b7ae05b), and nobody noticed for three weeks. These tests exist
 * so a second reinstatement fails the build instead of shipping.
 */
describe("the free founder tier is discontinued for new signups", () => {
  it("is not offered on the signup form", () => {
    expect(SIGNUP_FOUNDER_PLANS.map((p) => p.planType)).not.toContain("founder_free");
  });

  it("still offers the paid rungs", () => {
    const types = SIGNUP_FOUNDER_PLANS.map((p) => p.planType);
    expect(types).toContain("founder_basic");
    expect(types).toContain("founder_professional");
  });

  it("cannot be requested through the URL", () => {
    // ?plan=founder_free must not re-open the tier for someone who knows the slug.
    expect(parseRequestedPlan("founder_free")).toBeNull();
    expect(parseRequestedPlan("founder_basic")).toBe("founder_basic");
  });

  it("is never auto-granted to a founder", () => {
    // This returning true is what let signup skip checkout entirely.
    expect(isAutoGrantSignupPlan("founder", "founder_free")).toBe(false);
    expect(isAutoGrantSignupPlan("founder", "founder_basic")).toBe(false);
  });

  it("leaves the investor free tier alone", () => {
    expect(isAutoGrantSignupPlan("investor", "investor_free")).toBe(true);
  });
});

describe("planLabelFor", () => {
  it("only says grandfathered when the account actually is", () => {
    // Every free row used to render "Free (grandfathered)" regardless of when it
    // was created, which is what made the label meaningless.
    expect(planLabelFor("founder_free", true)).toBe("Free (grandfathered)");
    expect(planLabelFor("founder_free", false)).toBe("Free — discontinued tier");
  });

  it("defaults to not-grandfathered when the flag is missing", () => {
    expect(planLabelFor("founder_free")).toBe("Free — discontinued tier");
  });

  it("leaves other plans untouched", () => {
    expect(planLabelFor("founder_basic")).toBe("Basic");
    expect(planLabelFor("investor_free")).toBe("Investor Free");
  });
});
