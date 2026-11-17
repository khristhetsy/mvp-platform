import { describe, expect, it } from "vitest";
import { classifyContact, type AudienceContact } from "./audience";
import { notesFor, profileUrl, summariseCloud } from "./cloud-crm";

const ctx = { unsubscribedEmails: new Set(["gone@x.com"]), inOtherOutreach: new Set(["busy"]), highValueTag: null, emailFirst: false };
const c = (o: Partial<AudienceContact>): AudienceContact => ({ id: "1", name: "Ana", email: null, linkedin_slug: "ana-ruiz", source: "odoo", tags: [], raw: null, ...o });
const UUID = "3f2b8c1e-1d2a-4b3c-8d4e-5f6a7b8c9d0e";

describe("summariseCloud", () => {
  it("counts each reason separately and sends only invites", () => {
    const rows = [
      classifyContact(c({ id: "a" }), ctx),
      classifyContact(c({ id: "b", email: "ana@x.com" }), ctx), // has an email: still an invite, not email first
      classifyContact(c({ id: "c", linkedin_slug: null }), ctx),
      classifyContact(c({ id: "d", email: "gone@x.com" }), ctx),
      classifyContact(c({ id: "e", source: "linkedin" }), ctx),
      classifyContact(c({ id: "busy" }), ctx),
      classifyContact(c({ id: "f", tags: ["VIP"] }), ctx), // no high value tag set, so a plain invite
    ];
    expect(summariseCloud(rows)).toEqual({ total: 7, ready: 3, noLink: 1, doNotContact: 1, alreadyConnected: 1, alreadyInCampaign: 1 });
  });
});

describe("profileUrl", () => {
  it("encodes a slug the sender accepts", () => {
    expect(profileUrl("ana-ruiz")).toBe("https://www.linkedin.com/in/ana-ruiz/");
    expect(profileUrl("anaé")).toBe("https://www.linkedin.com/in/ana%C3%A9/");
    expect(/^https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+\/?$/.test(profileUrl("anaé"))).toBe(true);
  });
});

describe("notesFor", () => {
  const base = { id: "L1", external_ref: UUID, accepted_at: null as string | null, replied_at: null as string | null };
  it("writes nothing for a lead that has not moved", () => {
    expect(notesFor(base)).toEqual([]);
  });
  it("writes accepted, then replied, with stable ids so a repeat is a no-op", () => {
    const n = notesFor({ ...base, accepted_at: "2026-11-18T15:40:00Z", replied_at: "2026-11-19T08:00:00Z" });
    expect(n.map((x) => x.summary)).toEqual(["LinkedIn: invite accepted", "LinkedIn: replied"]);
    expect(n.map((x) => x.externalId)).toEqual(["cloud-sender:L1:accepted", "cloud-sender:L1:replied"]);
    expect(n[1]!.inbound).toBe(true);
  });
  it("skips leads with no CRM contact or a bad id", () => {
    expect(notesFor({ ...base, external_ref: null, accepted_at: "2026-11-18T15:40:00Z" })).toEqual([]);
    expect(notesFor({ ...base, external_ref: "prospect-42", accepted_at: "2026-11-18T15:40:00Z" })).toEqual([]);
  });
});
