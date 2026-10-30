import { describe, it, expect } from "vitest";
import { graceDaysLeft, isNewPastDue, keepGraceWindow, pastDueState, reminderDue } from "./past-due";
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

describe("reminderDue", () => {
  const ends = "2026-11-02T12:00:00.000Z";
  it("sends nothing while more than 48 hours remain (day 0 to 3)", () => {
    expect(reminderDue(ends, new Date("2026-10-30T11:00:00.000Z"))).toBeNull();
  });
  it("sends the day 3 reminder with 24 to 48 hours left", () => {
    expect(reminderDue(ends, new Date("2026-10-31T13:00:00.000Z"))).toBe("midpoint");
    expect(reminderDue(ends, new Date("2026-11-01T11:00:00.000Z"))).toBe("midpoint");
  });
  it("sends the last day reminder with under 24 hours left", () => {
    expect(reminderDue(ends, new Date("2026-11-01T13:00:00.000Z"))).toBe("final");
    expect(reminderDue(ends, new Date("2026-11-02T11:59:00.000Z"))).toBe("final");
  });
  it("sends nothing once the window has closed", () => {
    expect(reminderDue(ends, new Date("2026-11-02T12:00:00.000Z"))).toBeNull();
    expect(reminderDue(ends, new Date("2026-11-03T12:00:00.000Z"))).toBeNull();
  });
  it("a daily run lands in each window exactly once", () => {
    const start = Date.parse("2026-10-28T16:30:00.000Z");
    const stages: Array<string | null> = [];
    for (let d = 0; d <= 5; d += 1) stages.push(reminderDue(ends, new Date(start + d * 86_400_000)));
    expect(stages.filter((x) => x === "midpoint")).toHaveLength(1);
    expect(stages.filter((x) => x === "final")).toHaveLength(1);
  });
});

describe("renderFounderPastDueEmail", () => {
  const base = {
    firstName: "Ana",
    planLabel: "Premium",
    endsAt: "2026-11-02T12:00:00.000Z",
    billingUrl: "https://icapos.com/founder/settings/billing",
  };
  it("day 0 names the plan and the date and links to billing", () => {
    const email = renderFounderPastDueEmail(base);
    expect(email.subject).toBe("Your iCapOS payment did not go through");
    expect(email.html).toContain("Premium");
    expect(email.html).toContain("Nov 2, 2026");
    expect(email.html).toContain("https://icapos.com/founder/settings/billing");
    expect(email.text).toContain("Nov 2, 2026");
  });
  it("says the tools stay on and only investor outreach pauses", () => {
    expect(renderFounderPastDueEmail(base).text).toContain("Your tools stay on");
  });
  it("day 3 and day 5 have their own subjects", () => {
    expect(renderFounderPastDueEmail({ ...base, stage: "midpoint" }).subject).toContain("Reminder");
    expect(renderFounderPastDueEmail({ ...base, stage: "final" }).subject).toBe("Last day to update your card");
  });
});
