import { describe, expect, it } from "vitest";
import { buildGuestPaymentAlert } from "./guest-payment-alert";

describe("buildGuestPaymentAlert", () => {
  it("names the payer, plan, company and that no login exists yet", () => {
    const a = buildGuestPaymentAlert({
      signupId: "s1",
      email: "ggoldstein@insynctive.com",
      name: "Gary Goldstein",
      company: "Insynctive, Inc.",
      planLabel: "Founder Professional",
      currentPeriodEnd: "2026-12-13T18:55:57Z",
    });
    expect(a.title).toBe("New payment: Gary Goldstein, Founder Professional");
    expect(a.message).toContain("Insynctive, Inc.");
    expect(a.message).toContain("Login not created yet");
    expect(a.detail).toContain("active through Dec 13, 2026");
  });

  it("falls back to the email when there is no name or company", () => {
    const a = buildGuestPaymentAlert({ signupId: "s2", email: "a@b.com", planLabel: "Founder Basic" });
    expect(a.title).toBe("New payment: a@b.com, Founder Basic");
    expect(a.detail).not.toContain("active through");
  });
});
