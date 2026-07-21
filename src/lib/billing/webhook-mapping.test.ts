import { describe, it, expect, afterEach } from "vitest";
import { mapStatus, variantToPlan, PAST_DUE_GRACE_DAYS } from "./webhook-mapping";

const ORIG_BASIC = process.env.LEMONSQUEEZY_VARIANT_ID_BASIC;
const ORIG_PRO = process.env.LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL;

afterEach(() => {
  if (ORIG_BASIC === undefined) delete process.env.LEMONSQUEEZY_VARIANT_ID_BASIC;
  else process.env.LEMONSQUEEZY_VARIANT_ID_BASIC = ORIG_BASIC;
  if (ORIG_PRO === undefined) delete process.env.LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL;
  else process.env.LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL = ORIG_PRO;
});

describe("mapStatus", () => {
  it("maps active and on_trial straight through", () => {
    expect(mapStatus("active").status).toBe("active");
    expect(mapStatus("on_trial").status).toBe("trialing");
  });

  it("maps cancelled, paused, unpaid, and expired to canceled", () => {
    for (const s of ["cancelled", "paused", "unpaid", "expired"] as const) {
      expect(mapStatus(s).status).toBe("canceled");
      expect(mapStatus(s).unknown).toBe(false);
    }
  });

  it("keeps a past_due subscriber active but stamps a bounded grace period", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const result = mapStatus("past_due", now);
    expect(result.status).toBe("active");
    expect(result.gracePeriodEndsAt).toBe(
      new Date(now.getTime() + PAST_DUE_GRACE_DAYS * 86_400_000).toISOString(),
    );
  });

  it("flags an unrecognised status instead of silently cancelling", () => {
    // A payment provider adding an enum value must not deactivate customers.
    const result = mapStatus("some_new_status");
    expect(result.unknown).toBe(true);
    expect(result.status).not.toBe("canceled");
  });
});

describe("variantToPlan", () => {
  it("prefers numeric variant ids when configured", () => {
    process.env.LEMONSQUEEZY_VARIANT_ID_BASIC = "111";
    process.env.LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL = "222";
    expect(variantToPlan(111)).toEqual({ plan: "founder_basic", source: "variant_id" });
    expect(variantToPlan(222)).toEqual({ plan: "founder_professional", source: "variant_id" });
  });

  it("falls back to the product name and reports it as a fallback", () => {
    delete process.env.LEMONSQUEEZY_VARIANT_ID_BASIC;
    delete process.env.LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL;
    expect(variantToPlan(999, null, "Founder Professional")).toEqual({
      plan: "founder_professional",
      source: "name",
    });
  });

  it("returns no plan when nothing matches, so the caller can refuse", () => {
    delete process.env.LEMONSQUEEZY_VARIANT_ID_BASIC;
    delete process.env.LEMONSQUEEZY_VARIANT_ID_PROFESSIONAL;
    expect(variantToPlan(999, "Mystery", "Unknown Product")).toEqual({ plan: null, source: "none" });
  });
});
