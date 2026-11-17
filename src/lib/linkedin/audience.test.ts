import { describe, expect, it } from "vitest";
import { classifyContact, isConnected, slugFromUrl, summarize, type AudienceContact, type AudienceContext } from "./audience";

const ctx: AudienceContext = { unsubscribedEmails: new Set(["gone@x.com"]), inOtherOutreach: new Set(["busy"]), emailFirst: true, highValueTag: "VIP" };
const c = (o: Partial<AudienceContact>): AudienceContact => ({ id: "1", name: "Ana", email: null, linkedin_slug: "ana-ruiz", source: "odoo", tags: [], raw: null, ...o });

describe("slugFromUrl", () => {
  it("reads the slug from profile links", () => {
    expect(slugFromUrl("https://www.linkedin.com/in/Ana-Ruiz/")).toBe("ana-ruiz");
    expect(slugFromUrl("linkedin.com/in/ana%C3%A9")).toBe("anaé");
  });
  it("ignores other links", () => {
    expect(slugFromUrl("https://linkedin.com/company/acme")).toBeNull();
    expect(slugFromUrl(null)).toBeNull();
  });
});

describe("isConnected", () => {
  it("is true for the LinkedIn source or a matched import", () => {
    expect(isConnected({ source: "linkedin", raw: null })).toBe(true);
    expect(isConnected({ source: "odoo", raw: { linkedin: { slug: "x" } } })).toBe(true);
    expect(isConnected({ source: "odoo", raw: { other: 1 } })).toBe(false);
  });
});

describe("classifyContact", () => {
  it("invites a plain contact", () => {
    expect(classifyContact(c({}), ctx)).toMatchObject({ route: "invite", slug: "ana-ruiz" });
  });
  it("messages people already connected", () => {
    expect(classifyContact(c({ source: "linkedin" }), ctx).route).toBe("message");
  });
  it("sends contacts with an email to the email sequence first", () => {
    expect(classifyContact(c({ email: "ana@x.com" }), ctx).route).toBe("email_first");
    expect(classifyContact(c({ email: "ana@x.com" }), { ...ctx, emailFirst: false }).route).toBe("invite");
  });
  it("makes a hand task for tagged high value contacts", () => {
    expect(classifyContact(c({ tags: ["vip"] }), ctx).route).toBe("manual");
  });
  it("skips do not contact, unsubscribed, no link and other outreach", () => {
    expect(classifyContact(c({ tags: ["Do not contact"] }), ctx).skip).toBe("do_not_contact");
    expect(classifyContact(c({ email: "GONE@x.com" }), ctx).skip).toBe("do_not_contact");
    expect(classifyContact(c({ linkedin_slug: null }), ctx).skip).toBe("no_linkedin_link");
    expect(classifyContact(c({ id: "busy" }), ctx).skip).toBe("in_other_outreach");
  });
  it("puts do not contact ahead of every other rule", () => {
    expect(classifyContact(c({ source: "linkedin", linkedin_slug: null, tags: ["DNC"] }), ctx).skip).toBe("do_not_contact");
  });
});

describe("summarize", () => {
  it("counts routes and skip reasons", () => {
    const rows = [c({ id: "a" }), c({ id: "b", source: "linkedin" }), c({ id: "c", linkedin_slug: null }), c({ id: "d", tags: ["dnc"] })].map((x) => classifyContact(x, ctx));
    expect(summarize(rows)).toEqual({
      total: 4, invite: 1, message: 1, email_first: 0, manual: 0, skipped: 2,
      skippedBy: { no_linkedin_link: 1, do_not_contact: 1, in_other_outreach: 0 },
    });
  });
});
