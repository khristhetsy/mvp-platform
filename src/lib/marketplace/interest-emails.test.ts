import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/email/send-email", () => ({ sendEmail: vi.fn() }));

import { offeringLiveEmail } from "./interest-emails";

describe("offering live email", () => {
  it("keeps the fixed copy whole, in the body", () => {
    const { subject, html, text } = offeringLiveEmail("Northstar Robotics", "Wefunder");
    expect(subject).toBe("Northstar Robotics — offering now live on Wefunder");
    const body =
      "The offering you expressed interest in, Northstar Robotics, is now live on Wefunder, a registered funding portal. " +
      "Visit Wefunder to review the offering and participate. " +
      "iCapOS is a software platform. It is not a registered broker-dealer, funding portal, or investment adviser, " +
      "is not involved in this offering, and does not offer, sell, or recommend securities. Investing involves risk, " +
      "including possible loss of capital.";
    expect(html).toContain(body);
    expect(text).toContain(body);
  });

  it("adds no footer reason, headline or button", () => {
    const { html } = offeringLiveEmail("Northstar Robotics", "Wefunder");
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("border-top:1px solid #EEF1F6;padding:16px 28px");
    expect(html).not.toContain("<a ");
  });

  it("escapes names", () => {
    expect(offeringLiveEmail("A & B <Co>", "Portal").html).toContain("A &amp; B &lt;Co&gt;");
  });
});
