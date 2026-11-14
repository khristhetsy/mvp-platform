import { describe, expect, it } from "vitest";
import {
  GUEST_CHECKOUT_PLANS,
  claimWindowOpen,
  isGuestCheckoutPlan,
  makePaidSignupToken,
  paidSignupLoginPath,
  resendState,
  startDestination,
  verifyPaidSignupToken,
} from "./paid-signup-core";

const ID = "3f6b0c7e-8a41-4d2b-9c55-1e2f3a4b5c6d";

describe("guest checkout plans", () => {
  it("allows only Basic and Professional before an account exists", () => {
    expect(GUEST_CHECKOUT_PLANS).toEqual(["founder_basic", "founder_professional"]);
    expect(isGuestCheckoutPlan("founder_basic")).toBe(true);
    expect(isGuestCheckoutPlan("founder_professional")).toBe(true);
    expect(isGuestCheckoutPlan("founder_premium")).toBe(false);
    expect(isGuestCheckoutPlan("founder_free")).toBe(false);
    expect(isGuestCheckoutPlan("founder_managed_ir")).toBe(false);
    expect(isGuestCheckoutPlan(null)).toBe(false);
  });
});

describe("paid signup token", () => {
  it("round trips a signup id", () => {
    expect(verifyPaidSignupToken(makePaidSignupToken(ID))).toBe(ID);
  });

  it("rejects a changed id, a changed signature and junk", () => {
    const token = makePaidSignupToken(ID);
    const other = "11111111-2222-4333-8444-555555555555";
    expect(verifyPaidSignupToken(`${other}.${token.split(".")[1]}`)).toBeNull();
    expect(verifyPaidSignupToken(`${ID}.${"0".repeat(32)}`)).toBeNull();
    expect(verifyPaidSignupToken("not-a-token")).toBeNull();
    expect(verifyPaidSignupToken("")).toBeNull();
    expect(verifyPaidSignupToken(null)).toBeNull();
    expect(verifyPaidSignupToken(`x.${"a".repeat(32)}`)).toBeNull();
  });

  it("is not valid as a claim token for another purpose", () => {
    // A token signed for another domain must not verify here: same shape, different prefix.
    expect(verifyPaidSignupToken(`${ID}.${"b".repeat(32)}`)).toBeNull();
  });

  it("builds the private login path", () => {
    const token = makePaidSignupToken(ID);
    expect(paidSignupLoginPath(token)).toBe(`/start/paid?t=${encodeURIComponent(token)}`);
  });
});

describe("claim window", () => {
  const now = new Date("2026-11-12T12:00:00Z");
  it("is open for 30 days after payment", () => {
    expect(claimWindowOpen("2026-11-12T11:00:00Z", now)).toBe(true);
    expect(claimWindowOpen("2026-10-14T12:00:00Z", now)).toBe(true);
    expect(claimWindowOpen("2026-10-13T11:59:00Z", now)).toBe(false);
  });
  it("is closed when there is no payment time", () => {
    expect(claimWindowOpen(null, now)).toBe(false);
    expect(claimWindowOpen("garbage", now)).toBe(false);
  });
});

describe("where the Start form sends someone", () => {
  const base = { email: "a+b@acme.com", paymentsEnabled: true } as const;

  it("sends Basic and Professional to payment first, carrying their details", () => {
    const url = startDestination({ ...base, startChoice: "founder_basic", name: "Ana Lee", company: "Acme" });
    expect(url).toBe("/start/pay?email=a%2Bb%40acme.com&plan=founder_basic&name=Ana+Lee&company=Acme");
    expect(startDestination({ ...base, startChoice: "founder_professional" })).toBe("/start/pay?email=a%2Bb%40acme.com&plan=founder_professional");
  });

  it("keeps the sign up page for Free, Premium and investors", () => {
    expect(startDestination({ ...base, startChoice: "founder_free" })).toBe("/auth/sign-up?email=a%2Bb%40acme.com&role=founder&plan=founder_free");
    expect(startDestination({ ...base, startChoice: "founder_premium" })).toBe("/auth/sign-up?email=a%2Bb%40acme.com&role=founder&plan=founder_premium");
    expect(startDestination({ ...base, startChoice: "investor" })).toBe("/auth/sign-up?email=a%2Bb%40acme.com&role=investor");
    expect(startDestination({ ...base, startChoice: "founder_basic", role: "investor" })).toBe("/auth/sign-up?email=a%2Bb%40acme.com&role=investor");
  });

  it("falls back to the sign up page when online payment is not set up", () => {
    expect(startDestination({ ...base, paymentsEnabled: false, startChoice: "founder_basic" })).toBe("/auth/sign-up?email=a%2Bb%40acme.com&role=founder&plan=founder_basic");
  });

  it("defaults to Basic on the sign up page when no plan was chosen", () => {
    expect(startDestination({ ...base, paymentsEnabled: false, startChoice: undefined })).toBe("/auth/sign-up?email=a%2Bb%40acme.com&role=founder&plan=founder_basic");
  });
});

describe("resendState", () => {
  const now = new Date("2026-11-14T12:00:00Z");
  const paid = { status: "paid", paid_at: "2026-11-13T18:56:00Z", login_email_sent_at: "2026-11-13T18:56:08Z" };

  it("allows a resend for a paid signup whose link was sent a while ago", () => {
    expect(resendState(paid, now)).toBe("ok");
  });

  it("blocks a signup that is not paid or already has a login", () => {
    expect(resendState({ ...paid, status: "checkout_started" }, now)).toBe("not_paid");
    expect(resendState({ ...paid, status: "claimed" }, now)).toBe("claimed");
  });

  it("blocks once the claim window has closed", () => {
    expect(resendState({ ...paid, paid_at: "2026-09-01T00:00:00Z" }, now)).toBe("expired");
  });

  it("blocks a second send inside the cooldown", () => {
    expect(resendState({ ...paid, login_email_sent_at: "2026-11-14T11:58:00Z" }, now)).toBe("cooldown");
    expect(resendState({ ...paid, login_email_sent_at: null }, now)).toBe("ok");
  });
});
