import { describe, it, expect } from "vitest";
import { graceDaysLeft, isNewPastDue, keepGraceWindow, pastDueState } from "./past-due";
import { renderFounderPastDueEmail } from "./past-due-email";
import { mapStatus, PAST_DUE_GRACE_DAYS } from "./webhook-mapping";

const NOW = new Date("2026-10-28T12:00:00.000Z");
const base = { subscription_status: "active" as const, cancel_at_period_end: false };

describe("pastDueState", () => {
  it("is null for a healthy subscription", () => {
    expect(pastDueState({ ...base, grace_period_ends_at: null }, NOW)).toBeNull();
  });
  it("is grace while the date is in the future", () => {
    expect(pastDueState({ ...base, grace_period_ends_at: "2026-11-02T12:00:00.000Z" }, NOW)).toBe("grace");
  });
  it("is lapsed once the date has passed", () => {
    expect(pastDueState({ ...base, grace_period_ends_at: "2026-10-27T12:00:00.000Z" }, NOW)).toBe("lapsed");
  });
  it("ignores a cancellation that runs to the end of the paid period", () => {
    expect(pastDueState({ ...base, cancel_at_period_end: true, grace_period_ends_at: "2026-12-01T00:00:00.000Z" }, NOW)).toBeNull();
  });
  it("ignores non active statuses", () => {
    expect(pastDueState({ subscription_status: "canceled", cancel_at_period_end: false, grace_period_ends_at: "2026-11-02T12:00:00.000Z" }, NOW)).toBeNull();
  });
});

describe("keepGraceWindow", () => {
  const first = "2026-11-02T12:00:00.000Z";
  const retry = "2026-11-04T12:00:00.000Z";
  it("keeps the first failure date when another past_due event arrives", () => {
    expect(keepGraceWindow({ existingEndsAt: first, existingCancelAtPeriodEnd: false, mappedEndsAt: retry, mappedCancelAtPeriodEnd: false })).toBe(first);
  });
  it("starts a window when the subscription was healthy", () => {
    expect(keepGraceWindow({ existingEndsAt: null, existingCancelAtPeriodEnd: false, mappedEndsAt: retry, mappedCancelAtPeriodEnd: false })).toBe(retry);
  });
  it("clears the window when the payment recovers", () => {
    expect(keepGraceWindow({ existingEndsAt: first, existingCancelAtPeriodEnd: false, mappedEndsAt: null, mappedCancelAtPeriodEnd: false })).toBeNull();
  });
  it("does not carry a cancellation date into a failed payment window", () => {
    expect(keepGraceWindow({ existingEndsAt: "2027-01-01T00:00:00.000Z", existingCancelAtPeriodEnd: true, mappedEndsAt: retry, mappedCancelAtPeriodEnd: false })).toBe(retry);
  });
});

describe("isNewPastDue", () => {
  it("is true only on the first past_due event", () => {
    const mapped = { mappedEndsAt: "2026-11-02T12:00:00.000Z", mappedCancelAtPeriodEnd: false };
    expect(isNewPastDue({ existingEndsAt: null, existingCancelAtPeriodEnd: false, ...mapped })).toBe(true);
    expect(isNewPastDue({ existingEndsAt: "2026-11-01T00:00:00.000Z", existingCancelAtPeriodEnd: false, ...mapped })).toBe(false);
  });
  it("is false for a cancel at period end event", () => {
    expect(isNewPastDue({ existingEndsAt: null, existingCancelAtPeriodEnd: false, mappedEndsAt: "2027-01-01T00:00:00.000Z", mappedCancelAtPeriodEnd: true })).toBe(false);
  });
});

describe("grace length", () => {
  it("is 5 days from the first failed payment", () => {
    expect(PAST_DUE_GRACE_DAYS).toBe(5);
    const mapped = mapStatus("past_due", NOW);
    expect(mapped.gracePeriodEndsAt).toBe("2026-11-02T12:00:00.000Z");
    expect(graceDaysLeft(mapped.gracePeriodEndsAt!, NOW)).toBe(5);
  });
});

describe("renderFounderPastDueEmail", () => {
  it("names the plan and the date and links to billing", () => {
    const email = renderFounderPastDueEmail({
      firstName: "Ana",
      planLabel: "Premium",
      endsAt: "2026-11-02T12:00:00.000Z",
      billingUrl: "https://icapos.com/founder/settings/billing",
      now: NOW,
    });
    expect(email.subject).toBe("Your iCapOS payment did not go through");
    expect(email.html).toContain("Premium");
    expect(email.html).toContain("Nov 2, 2026");
    expect(email.html).toContain("https://icapos.com/founder/settings/billing");
    expect(email.text).toContain("Nov 2, 2026");
  });
});
