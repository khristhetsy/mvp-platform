import { describe, expect, it } from "vitest";
import { renderPaidSignupEmail } from "./paid-signup-email";

describe("paid signup email", () => {
  const mail = renderPaidSignupEmail({ firstName: "Ana", planLabel: "Basic", loginUrl: "https://icapos.com/start/paid?t=abc" });

  it("tells them the plan is paid and links to the private login page", () => {
    expect(mail.subject).toBe("Payment received. Create your iCapOS login");
    expect(mail.text).toContain("Hi Ana, thank you, your Basic plan is paid.");
    expect(mail.text).toContain("https://icapos.com/start/paid?t=abc");
    expect(mail.html).toContain("https://icapos.com/start/paid?t=abc");
  });

  it("greets without a name when there is none", () => {
    expect(renderPaidSignupEmail({ firstName: null, planLabel: "Professional", loginUrl: "https://x.test/p" }).text).toContain("Hello, thank you, your Professional plan is paid.");
  });

  it("uses no dashes as sentence punctuation", () => {
    expect(mail.text).not.toMatch(/ [-–—] /);
  });
});
