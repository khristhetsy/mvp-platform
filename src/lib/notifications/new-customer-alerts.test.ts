import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/lib/email/send-email", () => ({ sendEmail: vi.fn() }));

import { buildNewCustomerAlert, isFreshSignup, newCustomerLink, NEW_CUSTOMER_TYPES } from "./new-customer-alerts";
import { mapNotificationTypeToEvent } from "./preferences";

describe("buildNewCustomerAlert", () => {
  it("describes a signup with plan and pending payment", () => {
    const a = buildNewCustomerAlert({ event: "signup", founderId: "u1", companyName: "Acme", plan: "founder_basic", paymentPending: true });
    expect(a.title).toBe("New customer signup");
    expect(a.message).toBe("Acme signed up on Basic. Payment pending.");
  });

  it("falls back to founder name, then email", () => {
    expect(buildNewCustomerAlert({ event: "signup", founderId: "u1", founderName: "Ted" }).message).toBe("Ted signed up.");
    expect(buildNewCustomerAlert({ event: "signup", founderId: "u1", founderEmail: "t@x.com" }).message).toBe("t@x.com signed up.");
  });

  it("describes a payment and onboarding", () => {
    expect(buildNewCustomerAlert({ event: "payment", founderId: "u1", companyName: "Acme", plan: "founder_professional" }).message).toBe("Acme paid for Professional.");
    expect(buildNewCustomerAlert({ event: "onboarding", founderId: "u1", companyName: "Acme" }).message).toBe("Acme finished onboarding.");
  });

  it("links to the company workspace", () => {
    expect(newCustomerLink("c1")).toBe("/admin/companies/c1");
    expect(newCustomerLink(null)).toBe("/admin/companies");
  });

  it("is controlled by the New founder signup setting", () => {
    for (const type of Object.values(NEW_CUSTOMER_TYPES)) {
      expect(mapNotificationTypeToEvent(type)).toBe("new_founder_signup");
    }
  });
});

describe("isFreshSignup", () => {
  const now = new Date("2026-11-06T11:40:00Z");

  it("is true for a profile created moments ago (the database trigger already made it)", () => {
    expect(isFreshSignup("2026-11-06T11:34:31.074Z", now)).toBe(true);
  });

  it("is false for an older profile, so a later login does not alert again", () => {
    expect(isFreshSignup("2026-11-05T20:45:57Z", now)).toBe(false);
  });

  it("is false for missing, invalid or future timestamps", () => {
    expect(isFreshSignup(null, now)).toBe(false);
    expect(isFreshSignup(undefined, now)).toBe(false);
    expect(isFreshSignup("not a date", now)).toBe(false);
    expect(isFreshSignup("2026-11-06T12:00:00Z", now)).toBe(false);
  });
});
