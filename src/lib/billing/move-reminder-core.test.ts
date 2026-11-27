import { describe, expect, it } from "vitest";
import {
  clampWindowDays,
  evaluateMoveReminder,
  formatMonthlyPrice,
  moveReminderKey,
  type MoveReminderProfile,
  type MoveReminderSubscription,
} from "./move-reminder-core";
import { renderMoveReminderEmail } from "./move-reminder-email";

const NOW = new Date("2026-11-25T17:00:00.000Z");
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

const sub = (over: Partial<MoveReminderSubscription> = {}): MoveReminderSubscription => ({
  id: "sub-1",
  profile_id: "profile-1",
  plan_type: "founder_basic",
  subscription_status: "active",
  ls_subscription_id: "ls_1",
  ls_variant_id: "111",
  stripe_subscription_id: null,
  stripe_customer_id: null,
  cancel_at_period_end: false,
  grace_period_ends_at: null,
  current_period_end: inDays(3),
  monthly_price_cents: 4900,
  ...over,
});
const founder: MoveReminderProfile = { email: "jane@example.com", full_name: "Jane Doe", role: "founder" };
const check = (s: MoveReminderSubscription, p: MoveReminderProfile | null = founder, windowDays = 7) =>
  evaluateMoveReminder(s, p, { now: NOW, windowDays });

describe("evaluateMoveReminder", () => {
  it("includes a Lemon Squeezy Basic customer renewing inside the window", () => {
    expect(check(sub())).toEqual({
      recipient: {
        subscriptionId: "sub-1",
        profileId: "profile-1",
        email: "jane@example.com",
        firstName: "Jane",
        plan: "founder_basic",
        priceCents: 4900,
        renewsAt: inDays(3),
      },
    });
  });

  it("includes a Professional customer at $199", () => {
    const result = check(sub({ plan_type: "founder_professional", monthly_price_cents: 19900 }));
    expect(result).toMatchObject({ recipient: { plan: "founder_professional", priceCents: 19900 } });
  });

  it("includes a renewal on the last day of the window and excludes one past it", () => {
    expect(check(sub({ current_period_end: inDays(7) }))).toHaveProperty("recipient");
    expect(check(sub({ current_period_end: inDays(7.01) }))).toEqual({ skip: "outside_window" });
    expect(check(sub({ current_period_end: inDays(3) }), founder, 2)).toEqual({ skip: "outside_window" });
  });

  it("excludes a renewal already past, missing, or under an hour away", () => {
    expect(check(sub({ current_period_end: inDays(-1) }))).toEqual({ skip: "outside_window" });
    expect(check(sub({ current_period_end: null }))).toEqual({ skip: "outside_window" });
    expect(check(sub({ current_period_end: new Date(NOW.getTime() + 30 * 60_000).toISOString() }))).toEqual({ skip: "outside_window" });
  });

  it("never includes a customer who already has a Stripe subscription", () => {
    expect(check(sub({ stripe_subscription_id: "sub_stripe" }))).toEqual({ skip: "already_on_stripe" });
  });

  it("never includes Premium, with or without a Lemon Squeezy card subscription", () => {
    expect(check(sub({ plan_type: "founder_premium", monthly_price_cents: 100000 }))).toEqual({ skip: "plan_not_included" });
  });

  it("never includes free or internal plans", () => {
    for (const plan_type of ["founder_free", "founder_trial", "investor_free", "admin_internal"]) {
      expect(check(sub({ plan_type, monthly_price_cents: 0 }))).toEqual({ skip: "plan_not_included" });
    }
  });

  it("never includes an unpaid or cancelled subscription", () => {
    expect(check(sub({ subscription_status: "pending_payment" }))).toEqual({ skip: "not_active" });
    expect(check(sub({ subscription_status: "canceled" }))).toEqual({ skip: "not_active" });
  });

  it("never includes a subscription with no Lemon Squeezy id", () => {
    expect(check(sub({ ls_subscription_id: null }))).toEqual({ skip: "not_lemon" });
  });

  it("never includes internal accounts", () => {
    expect(check(sub(), { ...founder, email: "staff@myicfos.com" })).toEqual({ skip: "internal_account" });
    expect(check(sub(), { ...founder, role: "admin" })).toEqual({ skip: "internal_account" });
  });

  it("skips a customer with no email on file", () => {
    expect(check(sub(), { ...founder, email: null })).toEqual({ skip: "no_email" });
    expect(check(sub(), null)).toEqual({ skip: "no_email" });
  });

  it("skips a subscription set to cancel: it has no renewal", () => {
    expect(check(sub({ cancel_at_period_end: true }))).toEqual({ skip: "cancelling" });
  });

  it("skips a customer whose stored price is not what the move link would charge", () => {
    expect(check(sub({ monthly_price_cents: 9900 }))).toEqual({ skip: "price_mismatch" });
    expect(check(sub({ monthly_price_cents: 0 }))).toEqual({ skip: "price_mismatch" });
    expect(check(sub({ plan_type: "founder_professional", monthly_price_cents: 4900 }))).toEqual({ skip: "price_mismatch" });
  });
});

describe("moveReminderKey", () => {
  it("is the same for the same renewal however the date is written, and changes with the renewal", () => {
    expect(moveReminderKey("sub-1", "2026-12-01T00:00:00+00:00")).toBe(moveReminderKey("sub-1", "2026-12-01T00:00:00.000Z"));
    expect(moveReminderKey("sub-1", "2026-12-01T00:00:00Z")).not.toBe(moveReminderKey("sub-1", "2027-01-01T00:00:00Z"));
    expect(moveReminderKey("sub-1", "2026-12-01T00:00:00Z")).not.toBe(moveReminderKey("sub-2", "2026-12-01T00:00:00Z"));
  });
});

describe("settings and formatting", () => {
  it("defaults the window to 7 days and keeps it between 1 and 31", () => {
    expect(clampWindowDays(undefined)).toBe(7);
    expect(clampWindowDays("abc")).toBe(7);
    expect(clampWindowDays(0)).toBe(1);
    expect(clampWindowDays(14)).toBe(14);
    expect(clampWindowDays(90)).toBe(31);
  });

  it("formats whole and fractional dollar prices", () => {
    expect(formatMonthlyPrice(4900)).toBe("$49");
    expect(formatMonthlyPrice(19900)).toBe("$199");
    expect(formatMonthlyPrice(4950)).toBe("$49.50");
  });
});

describe("renderMoveReminderEmail", () => {
  const render = (priceCents: number, planLabel: string, firstName: string | null = "Jane") =>
    renderMoveReminderEmail({ firstName, planLabel, priceCents, renewsAt: "2026-12-01T18:00:00.000Z", moveUrl: "https://icapos.com/billing/move?t=abc.def" });

  it("names the renewal date in the subject", () => {
    expect(render(4900, "Basic").subject).toBe("Your iCapOS payment moves to Stripe on Dec 1, 2026");
  });

  it("shows $49 for a Basic customer and never $199", () => {
    const mail = render(4900, "Basic");
    for (const body of [mail.html, mail.text]) {
      expect(body).toContain("$49 per month, the same as today");
      expect(body).not.toContain("$199");
      expect(body).not.toContain("$99");
    }
  });

  it("shows $199 for a Professional customer and never $49", () => {
    const mail = render(19900, "Professional");
    for (const body of [mail.html, mail.text]) {
      expect(body).toContain("$199 per month, the same as today");
      expect(body).not.toContain("$49");
    }
  });

  it("carries the first name, plan, first charge date, $0 today, the button and the sign off", () => {
    const mail = render(4900, "Basic");
    expect(mail.text).toContain("Hi Jane,");
    expect(mail.text).toContain("Plan: Basic");
    expect(mail.text).toContain("First Stripe charge: Dec 1, 2026");
    expect(mail.text).toContain("Charged today: $0");
    expect(mail.text).toContain("Add my card on Stripe: https://icapos.com/billing/move?t=abc.def");
    expect(mail.text).toContain("Your Lemon Squeezy payment is cancelled once you finish, so you are never charged twice.");
    expect(mail.text).toContain("The iCapOS team");
    expect(mail.html).toContain("https://icapos.com/billing/move?t=abc.def");
  });

  it("greets without a name when there is none", () => {
    expect(render(4900, "Basic", null).text).toContain("Hello, our card payments");
  });

  it("has no dashes in its sentences", () => {
    const mail = render(4900, "Basic");
    const copy = mail.text.split("\n\n--\n\n")[0].replace(/https?:\/\/\S+/g, "");
    expect(mail.subject).not.toMatch(/[-–—]/);
    expect(copy).not.toMatch(/[-–—]/);
  });
});
