import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/notifications/notifications", () => ({ notifyStaffIfNotRecent: vi.fn() }));

import { buildSmsReplyEmail, replyInbox, replyPath } from "./inbound-replies";

describe("inbound SMS replies", () => {
  it("links to the matched contact, else the voice console", () => {
    expect(replyPath("odoo:42")).toBe("/admin/crm/record/odoo%3A42");
    expect(replyPath(null)).toBe("/admin/voice");
  });

  it("emails staff the reply, escaped, and says replying by email won't reach them", () => {
    const m = buildSmsReplyEmail({ channel: "sms", from: "+16195550142", body: "Thanks, <b>booked</b> Tuesday", contactId: "42", contactName: "Maya Chen", campaignName: "Q4 founders" });
    expect(m.subject).toBe("Text reply from Maya Chen");
    expect(m.html).toContain("Thanks, &lt;b&gt;booked&lt;/b&gt; Tuesday");
    expect(m.html).toContain("/admin/crm/record/42");
    expect(m.text).toContain("Replying to this email does not reach them");
    expect(m.text).toContain("Campaign: Q4 founders");
  });

  it("names an unmatched sender by number", () => {
    const m = buildSmsReplyEmail({ channel: "whatsapp", from: "+33600000000", body: "Hi", contactId: null, contactName: null, campaignName: null });
    expect(m.subject).toBe("WhatsApp reply from +33600000000");
    expect(m.text).toContain("Not matched to a CRM contact");
  });

  it("reads the reply inbox from the environment", () => {
    const prev = { a: process.env.SMS_REPLY_NOTIFY_EMAIL, b: process.env.ADMIN_SUPPORT_EMAIL };
    process.env.SMS_REPLY_NOTIFY_EMAIL = "ops@icapos.com, khris@icapos.com";
    expect(replyInbox()).toEqual(["ops@icapos.com", "khris@icapos.com"]);
    delete process.env.SMS_REPLY_NOTIFY_EMAIL;
    delete process.env.ADMIN_SUPPORT_EMAIL;
    expect(replyInbox()).toEqual([]);
    if (prev.a !== undefined) process.env.SMS_REPLY_NOTIFY_EMAIL = prev.a;
    if (prev.b !== undefined) process.env.ADMIN_SUPPORT_EMAIL = prev.b;
  });
});
