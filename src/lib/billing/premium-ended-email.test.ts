import { describe, expect, it } from "vitest";
import { renderPremiumEndedEmail } from "./wire-emails";

describe("renderPremiumEndedEmail", () => {
  const base = { firstName: "Jane", planLabel: "Professional", endedOn: "Nov 15, 2026", billingUrl: "https://icapos.com/billing" };

  it("names the plan and links to billing", () => {
    const r = renderPremiumEndedEmail(base);
    expect(r.subject).toBe("Your Premium period has ended: start your Professional plan");
    expect(r.html).toContain("https://icapos.com/billing");
    expect(r.text).toContain("Start Professional: https://icapos.com/billing");
    expect(r.text).toContain("Nov 15, 2026");
  });

  it("greets a missing name as there", () => {
    expect(renderPremiumEndedEmail({ ...base, firstName: null }).text.startsWith("Hi there,")).toBe(true);
  });

  it("escapes HTML in the name", () => {
    const r = renderPremiumEndedEmail({ ...base, firstName: "<b>x</b>" });
    expect(r.html).not.toContain("<b>x</b>");
  });
});
