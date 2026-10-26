import { describe, expect, it } from "vitest";
import { awaitingCardCheckout, canDowngrade, canSwitchFromPremium, cardPlanFor, isCardPlan, isDowngradeDue, pendingPlanFor } from "./plan-change";

describe("plan change rules", () => {
  it("allows only real downgrades", () => {
    expect(canDowngrade("founder_professional", "basic")).toBe(true);
    expect(canDowngrade("founder_professional", "free")).toBe(true);
    expect(canDowngrade("founder_basic", "free")).toBe(true);
    expect(canDowngrade("founder_basic", "basic")).toBe(false);
    expect(canDowngrade("founder_premium", "basic")).toBe(false);
    expect(canDowngrade("founder_free", "free")).toBe(false);
  });

  it("treats only Basic and Professional as card plans", () => {
    expect(isCardPlan("founder_basic")).toBe(true);
    expect(isCardPlan("founder_professional")).toBe(true);
    expect(isCardPlan("founder_premium")).toBe(false);
    expect(isCardPlan(null)).toBe(false);
  });

  it("maps a target to the pending plan type", () => {
    expect(pendingPlanFor("basic")).toBe("founder_basic");
    expect(pendingPlanFor("free")).toBe("founder_free");
  });

  it("lets only Premium switch to a card plan", () => {
    expect(canSwitchFromPremium("founder_premium", "professional")).toBe(true);
    expect(canSwitchFromPremium("founder_premium", "basic")).toBe(true);
    expect(canSwitchFromPremium("founder_professional", "basic")).toBe(false);
    expect(cardPlanFor("professional")).toBe("founder_professional");
    expect(cardPlanFor("basic")).toBe("founder_basic");
  });

  it("prompts checkout only for a free account that chose a card plan and has no subscription", () => {
    expect(awaitingCardCheckout({ plan_type: "founder_free", pending_plan_type: "founder_professional", ls_subscription_id: null })).toBe(true);
    expect(awaitingCardCheckout({ plan_type: "founder_free", pending_plan_type: "founder_free" })).toBe(false);
    expect(awaitingCardCheckout({ plan_type: "founder_free", pending_plan_type: "founder_basic", ls_subscription_id: "123" })).toBe(false);
    expect(awaitingCardCheckout({ plan_type: "founder_premium", pending_plan_type: "founder_basic" })).toBe(false);
  });

  it("applies a scheduled change one day before the period ends", () => {
    const end = "2027-10-15T00:00:00.000Z";
    expect(isDowngradeDue(end, new Date("2027-10-13T23:59:00.000Z"))).toBe(false);
    expect(isDowngradeDue(end, new Date("2027-10-14T00:00:00.000Z"))).toBe(true);
    expect(isDowngradeDue(null)).toBe(false);
  });
});
