import { describe, expect, it } from "vitest";
import { PAYMENT_PAGE, isPayFirstPlan, requiresPaymentFirst } from "./payment-gate";

describe("payment first gate", () => {
  it("holds a paid plan that is awaiting payment", () => {
    for (const plan of ["founder_basic", "founder_professional", "founder_premium"]) {
      expect(requiresPaymentFirst({ plan_type: plan, subscription_status: "pending_payment" })).toBe(true);
    }
  });

  it("lets anyone through once the plan is active, trialing or free", () => {
    expect(requiresPaymentFirst({ plan_type: "founder_basic", subscription_status: "active" })).toBe(false);
    expect(requiresPaymentFirst({ plan_type: "founder_professional", subscription_status: "trialing" })).toBe(false);
    expect(requiresPaymentFirst({ plan_type: "founder_free", subscription_status: "free" })).toBe(false);
    expect(requiresPaymentFirst({ plan_type: "investor_free", subscription_status: "free" })).toBe(false);
    expect(requiresPaymentFirst({ plan_type: "admin_internal", subscription_status: "internal" })).toBe(false);
  });

  it("never holds the SPV Program, which is priced on request", () => {
    expect(isPayFirstPlan("founder_managed_ir")).toBe(false);
    expect(requiresPaymentFirst({ plan_type: "founder_managed_ir", subscription_status: "pending_payment" })).toBe(false);
  });

  it("does not hold an expired or canceled paid plan", () => {
    expect(requiresPaymentFirst({ plan_type: "founder_basic", subscription_status: "expired" })).toBe(false);
    expect(requiresPaymentFirst({ plan_type: "founder_basic", subscription_status: "canceled" })).toBe(false);
  });

  it("treats a missing subscription as not held", () => {
    expect(requiresPaymentFirst(null)).toBe(false);
    expect(requiresPaymentFirst(undefined)).toBe(false);
  });

  it("points at the payment page", () => {
    expect(PAYMENT_PAGE).toBe("/billing/start");
  });
});
