import { beforeEach, describe, expect, it, vi } from "vitest";

// ── fakes ────────────────────────────────────────────────────────────────────
type Contact = { id: string; name: string | null; email: string | null; phone: string | null; company: string | null; company_domain: string | null; email_status: string | null; suppressed: boolean | null };
let contact: Contact;
let unsubs: string[] = [];
const updates: Array<Record<string, unknown>> = [];

function builder(table: string) {
  const q = {
    _in: [] as string[],
    select: () => q,
    eq: () => q,
    in: (_k: string, v: string[]) => { q._in = v; return q; },
    limit: () => q,
    maybeSingle: async () => ({ data: table === "crm_contacts" ? contact : null }),
    update: (patch: Record<string, unknown>) => { updates.push(patch); return { eq: async () => ({ error: null }) }; },
    then: (r: (v: unknown) => void) => r({ data: unsubs.filter((e) => q._in.includes(e)).map((email) => ({ email })), error: null }),
  };
  return q;
}
vi.mock("@/lib/supabase/admin", () => ({ serviceRoleClientUntyped: () => ({ from: (t: string) => builder(t) }) }));

const site = { emails: [] as string[], phones: [] as string[] };
vi.mock("@/lib/append/site", () => ({ scrapeSiteContacts: vi.fn(async () => ({ ...site })) }));

const web = { configured: false, email: null as string | null, emails: [] as string[], phone: null as string | null, domain: null as string | null };
vi.mock("@/lib/append/websearch", () => ({
  searchConfigured: () => web.configured,
  searchCompanyContacts: vi.fn(async () => ({ email: web.email, emails: web.emails, phone: web.phone, domain: web.domain, source: "site" })),
}));

const mxDomains = new Set<string>();
vi.mock("node:dns/promises", () => ({
  resolveMx: vi.fn(async (d: string) => { if (mxDomains.has(d)) return [{ exchange: "mx", priority: 1 }]; throw new Error("ENOTFOUND"); }),
}));

import { suggestForContact, acceptSuggestion, personalEmailFor } from "./suggest";
import { _clearMxCache } from "./email";
import { scrapeSiteContacts } from "@/lib/append/site";

beforeEach(() => {
  contact = { id: "c1", name: "Jane Doe", email: null, phone: null, company: "Acme Fund", company_domain: "acmefund.com", email_status: null, suppressed: false };
  unsubs = [];
  updates.length = 0;
  site.emails = []; site.phones = [];
  Object.assign(web, { configured: false, email: null, emails: [], phone: null, domain: null });
  mxDomains.clear(); mxDomains.add("acmefund.com");
  _clearMxCache();
  vi.mocked(scrapeSiteContacts).mockClear();
});

describe("company inbox is never a person's email (D4)", () => {
  it("info@ on the site gives no site email; the pattern guess is offered instead", async () => {
    site.emails = ["info@acmefund.com"];
    const r = await suggestForContact("c1");
    const emails = r.suggestions.filter((s) => s.field === "email");
    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({ value: "jane.doe@acmefund.com", source: "profile", confident: false });
    expect(r.reason).toMatch(/company inbox/);
  });

  it("an address carrying the person's name is suggested from the site", async () => {
    site.emails = ["info@acmefund.com", "jdoe@acmefund.com"];
    const r = await suggestForContact("c1");
    expect(r.suggestions[0]).toMatchObject({ field: "email", value: "jdoe@acmefund.com", source: "site", confident: true });
  });

  it("web search results are filtered the same way", async () => {
    contact.company_domain = null;
    Object.assign(web, { configured: true, email: "contact@acmefund.com", emails: ["contact@acmefund.com"], domain: "acmefund.com" });
    const r = await suggestForContact("c1");
    expect(r.suggestions.find((s) => s.value === "contact@acmefund.com")).toBeUndefined();
    expect(r.suggestions[0]).toMatchObject({ source: "profile", value: "jane.doe@acmefund.com" });
  });

  it("personalEmailFor matches by name, never a role inbox", () => {
    expect(personalEmailFor(["info@x.com", "jane.doe@x.com"], "Jane Doe")).toBe("jane.doe@x.com");
    expect(personalEmailFor(["info@x.com"], "Jane Doe")).toBeNull();
  });

  it("personalEmailFor does not take a colleague's address on a shared name", () => {
    expect(personalEmailFor(["marie.martin@acme.com"], "Martin Dupont")).toBeNull();
    expect(personalEmailFor(["marie.martin@acme.com", "mdupont@acme.com"], "Martin Dupont")).toBe("mdupont@acme.com");
  });

  it("accept refuses a company inbox", async () => {
    await expect(acceptSuggestion({ contactId: "c1", field: "email", value: "info@acmefund.com", source: "site" })).rejects.toThrow(/company inbox/);
    expect(updates).toHaveLength(0);
  });
});

describe("pattern guess (D2)", () => {
  it("one MX check, top format first, others as alternatives", async () => {
    const r = await suggestForContact("c1");
    const g = r.suggestions.find((s) => s.source === "profile")!;
    expect(g.value).toBe("jane.doe@acmefund.com");
    expect(g.note).toMatch(/first\.last/);
    expect(g.alternatives).toEqual(["jdoe@acmefund.com", "jane@acmefund.com", "janedoe@acmefund.com", "j.doe@acmefund.com"]);
  });

  it("no MX, no guess", async () => {
    mxDomains.clear();
    const r = await suggestForContact("c1");
    expect(r.suggestions.filter((s) => s.field === "email")).toHaveLength(0);
  });
});

describe("company phones (D5)", () => {
  it("a site phone is labelled a company line and never confident", async () => {
    site.phones = ["+18585550100"];
    const r = await suggestForContact("c1");
    const p = r.suggestions.find((s) => s.field === "phone")!;
    expect(p.confident).toBe(false);
    expect(p.note).toMatch(/Company line/);
  });
});

describe("suppression (D6)", () => {
  it("an opted-out contact is not looked up", async () => {
    contact.email = "jane@old.com"; contact.email_status = "invalid";
    unsubs = ["jane@old.com"];
    const r = await suggestForContact("c1");
    expect(r.suggestions).toEqual([]);
    expect(r.reason).toMatch(/opted out/);
    expect(scrapeSiteContacts).not.toHaveBeenCalled();
  });

  it("accept refuses an opted-out contact and an opted-out address", async () => {
    contact.suppressed = true;
    await expect(acceptSuggestion({ contactId: "c1", field: "phone", value: "+18585550100", source: "site" })).rejects.toThrow(/opted out/);
    contact.suppressed = false;
    unsubs = ["jane.doe@acmefund.com"];
    await expect(acceptSuggestion({ contactId: "c1", field: "email", value: "jane.doe@acmefund.com", source: "profile" })).rejects.toThrow(/opted out/);
    expect(updates).toHaveLength(0);
  });

  it("an accepted guess is saved as risky", async () => {
    await acceptSuggestion({ contactId: "c1", field: "email", value: "jane.doe@acmefund.com", source: "profile" });
    expect(updates[0]).toMatchObject({ email: "jane.doe@acmefund.com", email_source: "profile", email_status: "risky" });
  });
});
