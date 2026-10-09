import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }));

import {
  cleanFundingStage,
  nextSteps,
  paymentBellMessage,
  paymentSubjectSuffix,
  renderPaymentAlertEmail,
  type PaymentAlertDetails,
} from "./payment-alert-details";

// The real Save Our Oceans payment (Oct 8, 2026, 6:06 PM PT).
const SOS: PaymentAlertDetails = {
  founderName: "Theodore J Staley",
  founderEmail: "tedstaley2@gmail.com",
  phone: "+1 (520) 849-8813",
  signedUpAt: "2026-10-07T17:16:44.457Z",
  paidAt: "2026-10-09T01:06:33.674Z",
  priceCents: 4900,
  currency: "USD",
  renewsAt: "2026-11-09T01:05:53Z",
  subscriptionId: "2592759",
  customerId: "10104299",
  industry: "Cleantech",
  location: "Arizona, United States",
  operatingStage: "Pre revenue",
  fundingStage: "Seed, Series A",
  capitalAmount: "$1m to $10m",
  goal: "close $6m",
  seekingCapital: "Equity",
  seekingInvestors: "Family office, Corporate / strategic, Venture fund",
  approvedAt: "2026-10-07T17:30:04.311Z",
  published: true,
  onboardingPercent: 50,
  steps: [
    { label: "Company profile", done: true },
    { label: "Investor readiness review", done: true },
    { label: "Documents uploaded", done: false },
    { label: "Funding information", done: false },
  ],
  crrScore: null,
  welcomeLetterAt: "2026-10-09T01:06:40Z",
};

describe("payment alert email", () => {
  const out = renderPaymentAlertEmail({ companyName: "Save Our Oceans Initiative Inc.", plan: "Basic", details: SOS, url: "https://icapos.com/admin/companies/c1" });

  it("states the payment in PT with price and renewal", () => {
    expect(out.text).toContain("Theodore J Staley paid for Basic on Oct 8, 2026 at 6:06 PM PT.");
    expect(out.text).toContain("$49.00 / month · First payment · Renews Nov 8, 5:05 PM PT");
    expect(out.text).toContain("Signed up: Oct 7, 10:16 AM PT (paid 1 day later)");
    expect(out.text).toContain("Welcome letter: Sent to founder 6:06 PM PT");
  });

  it("shows founder, company and onboarding", () => {
    expect(out.html).toContain("tedstaley2@gmail.com");
    expect(out.html).toContain("+1 (520) 849-8813");
    expect(out.text).toContain("Amount of capital: $1m to $10m · goal: close $6m");
    expect(out.text).toContain("Profile: Approved and published on marketplace Oct 7");
    expect(out.text).toContain("Onboarding 50%");
    expect(out.text).toContain("[ ] Capital Readiness Rating: not generated yet");
  });

  it("has one button, Open company, and no email or call founder buttons", () => {
    expect(out.html).toContain(">Open company</a>");
    expect(out.html).not.toContain("Email founder");
    expect(out.html).not.toContain("Call founder");
    expect(out.html).not.toContain("mailto:");
    expect(out.html).not.toContain("tel:");
  });

  it("uses no dashes as punctuation in copy", () => {
    expect(out.text).not.toMatch(/ [-–—] /);
  });

  it("leaves out empty rows", () => {
    const thin = renderPaymentAlertEmail({ companyName: "Acme", plan: "Basic", details: { ...SOS, location: null, phone: null }, url: "u" });
    expect(thin.text).not.toContain("Location:");
    expect(thin.text).not.toContain("Phone:");
  });
});

describe("payment alert pieces", () => {
  it("suggests next steps from what is open", () => {
    expect(nextSteps(SOS)).toEqual([
      "Welcome call within 24 hours.",
      "Help upload documents (the CRR needs them).",
      "Finish funding information, then run the CRR.",
    ]);
    const done = { ...SOS, steps: SOS.steps.map((s) => ({ ...s, done: true })), crrScore: 72 };
    expect(nextSteps(done)).toEqual(["Welcome call within 24 hours."]);
  });

  it("builds the bell line and subject", () => {
    expect(paymentBellMessage("Save Our Oceans Initiative Inc.", "Basic", SOS)).toBe(
      "Save Our Oceans Initiative Inc. paid $49/mo for Basic · Cleantech · Onboarding 50%",
    );
    expect(paymentSubjectSuffix("Basic", SOS)).toBe(" · Basic $49/mo");
  });

  it("cleans funding stage", () => {
    expect(cleanFundingStage("Other, Series A, Seed")).toBe("Seed, Series A");
    expect(cleanFundingStage("Other")).toBeNull();
  });
});
