import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "./fake-db.test-helper";

let db: FakeDb;
vi.mock("@/lib/supabase/admin", () => ({ serviceRoleClientUntyped: () => db }));

const site = { emails: [] as string[], phones: [] as string[] };
vi.mock("@/lib/append/site", async (orig) => ({
  ...(await orig<typeof import("@/lib/append/site")>()),
  scrapeSiteContacts: vi.fn(async () => ({ ...site })),
}));

const web = { configured: false, email: null as string | null, emails: [] as string[], phone: null as string | null, domain: null as string | null };
vi.mock("@/lib/append/websearch", () => ({
  searchConfigured: () => web.configured,
  searchCompanyContacts: vi.fn(async () => ({ email: web.email, emails: web.emails, phone: web.phone, domain: web.domain, source: "site" })),
}));

const mxDomains = new Set<string>();
vi.mock("node:dns/promises", () => ({
  resolveMx: vi.fn(async (d: string) => { if (mxDomains.has(d)) return [{ exchange: "mx", priority: 1 }]; throw new Error("ENOTFOUND"); }),
}));

import { suggestForContact, acceptSuggestion, rejectSuggestion, logManualReveal, personalEmailFor } from "./suggest";
import { _clearMxCache } from "./email";
import { _clearRankCache } from "@/lib/append/domain-patterns";
import { scrapeSiteContacts } from "@/lib/append/site";

const LB = "legitimate_interest" as const;
const contact = () => db.rows("crm_contacts")[0];

beforeEach(() => {
  db = new FakeDb();
  db.rows("crm_contacts").push({ id: "c1", name: "Jane Doe", email: null, phone: null, company: "Acme Fund", company_domain: "acmefund.com", email_status: null, suppressed: false, found_at: null });
  db.rows("marketing_settings").push({ id: "default", finder_retention_months: 12 });
  site.emails = []; site.phones = [];
  Object.assign(web, { configured: false, email: null, emails: [], phone: null, domain: null });
  mxDomains.clear(); mxDomains.add("acmefund.com");
  _clearMxCache(); _clearRankCache();
  vi.mocked(scrapeSiteContacts).mockClear();
});

describe("company inbox is never a person's email (D4)", () => {
  it("info@ on the site gives no site email; the format guess is offered instead", async () => {
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

  it("personalEmailFor does not take a colleague's address on a shared name", () => {
    expect(personalEmailFor(["marie.martin@acme.com"], "Martin Dupont")).toBeNull();
    expect(personalEmailFor(["marie.martin@acme.com", "mdupont@acme.com"], "Martin Dupont")).toBe("mdupont@acme.com");
  });

  it("accept refuses a company inbox", async () => {
    await expect(acceptSuggestion({ contactId: "c1", field: "email", value: "info@acmefund.com", source: "site", lawfulBasis: LB })).rejects.toThrow(/company inbox/);
    expect(contact().email).toBeNull();
  });
});

describe("learned company format (5.2)", () => {
  it("uses the domain's learned format and says so", async () => {
    db.rows("email_domain_patterns").push({ domain: "acmefund.com", pattern: "flast", format_counts: { flast: 3 }, verified_samples: 3, conflicting_samples: 0, catch_all: null, last_checked_at: "2026-10-01" });
    const r = await suggestForContact("c1");
    const g = r.suggestions.find((s) => s.source === "profile")!;
    expect(g.value).toBe("jdoe@acmefund.com");
    expect(g.note).toMatch(/learned from 3 known emails/);
    expect(db.rows("contact_lookups").some((l) => l.source === "domain_pattern" && l.outcome === "found")).toBe(true);
  });

  it("an unlearned domain (one sample) falls back to the default ranking", async () => {
    db.rows("email_domain_patterns").push({ domain: "acmefund.com", pattern: "flast", format_counts: { flast: 1 }, verified_samples: 1, conflicting_samples: 0, catch_all: null, last_checked_at: "2026-10-01" });
    const r = await suggestForContact("c1");
    expect(r.suggestions.find((s) => s.source === "profile")!.value).toBe("jane.doe@acmefund.com");
  });

  it("accepting a name-matched site email teaches the domain; a guess does not", async () => {
    await acceptSuggestion({ contactId: "c1", field: "email", value: "jdoe@acmefund.com", source: "site", lawfulBasis: LB });
    expect(db.rows("email_domain_patterns")[0]).toMatchObject({ domain: "acmefund.com", pattern: "flast", verified_samples: 1 });
    db.rows("crm_contacts").push({ id: "c2", name: "Bob Ray", email: null, suppressed: false, found_at: null });
    await acceptSuggestion({ contactId: "c2", field: "email", value: "bob.ray@acmefund.com", source: "profile", lawfulBasis: LB });
    expect(db.rows("email_domain_patterns")[0].verified_samples).toBe(1);
  });
});

describe("lookup log and saved suggestions (5.1, 5.3)", () => {
  it("logs one row per source attempt", async () => {
    site.phones = ["+18585550100"];
    await suggestForContact("c1", "u1");
    const log = db.rows("contact_lookups").map((l) => `${l.source}:${l.field}:${l.outcome}`);
    expect(log).toEqual(["site:email:not_found", "site:phone:found", "pattern:email:found"]);
    expect(db.rows("contact_lookups").every((l) => l.run_by === "u1")).toBe(true);
  });

  it("persists suggestions with ids, and a rejected value is not offered again", async () => {
    site.emails = ["jdoe@acmefund.com"];
    const first = await suggestForContact("c1");
    const g = first.suggestions.find((s) => s.field === "email")!;
    expect(g).toMatchObject({ value: "jdoe@acmefund.com", source: "site" });
    expect(g.id).toBeTruthy();
    await rejectSuggestion({ contactId: "c1", field: "email", suggestionId: g.id });
    const again = await suggestForContact("c1");
    expect(again.suggestions.find((s) => s.value === g.value)).toBeUndefined();
  });

  it("accepting closes the other pending suggestions for that field", async () => {
    const r = await suggestForContact("c1");
    const g = r.suggestions.find((s) => s.field === "email")!;
    db.rows("contact_finder_suggestions").push({ id: "other", contact_id: "c1", field: "email", value: "x@acmefund.com", source: "site", status: "pending" });
    await acceptSuggestion({ contactId: "c1", field: "email", value: g.value, source: "profile", lawfulBasis: LB, suggestionId: g.id });
    const rows = db.rows("contact_finder_suggestions");
    expect(rows.find((s) => s.id === g.id)!.status).toBe("accepted");
    expect(rows.find((s) => s.id === "other")!.status).toBe("rejected");
  });

  it("choosing an alternative logs the saved value as accepted and the guess as rejected", async () => {
    const r = await suggestForContact("c1");
    const g = r.suggestions.find((s) => s.field === "email")!;
    const alt = g.alternatives![0];
    await acceptSuggestion({ contactId: "c1", field: "email", value: alt, source: "profile", lawfulBasis: LB, suggestionId: g.id });
    const rows = db.rows("contact_finder_suggestions");
    expect(rows.find((s) => s.id === g.id)!.status).toBe("rejected");
    expect(rows.find((s) => s.value === alt)!.status).toBe("accepted");
    expect(contact().email).toBe(alt);
  });

  it("after the top guess is rejected, the next format is offered", async () => {
    const first = await suggestForContact("c1");
    const g = first.suggestions.find((s) => s.field === "email")!;
    await rejectSuggestion({ contactId: "c1", field: "email", suggestionId: g.id });
    const again = await suggestForContact("c1");
    expect(again.suggestions.find((s) => s.field === "email")!.value).toBe(g.alternatives![0]);
  });

  it("still returns what it found when the v2 tables are missing", async () => {
    db.failTables.add("contact_finder_suggestions");
    db.failTables.add("contact_lookups");
    const r = await suggestForContact("c1");
    expect(r.suggestions[0]).toMatchObject({ value: "jane.doe@acmefund.com" });
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

describe("lawful basis and retention (5.5)", () => {
  it("accept requires a lawful basis", async () => {
    // @ts-expect-error — testing the runtime guard
    await expect(acceptSuggestion({ contactId: "c1", field: "phone", value: "+18585550100", source: "site" })).rejects.toThrow(/lawful basis/);
  });

  it("starts the clock once and never restarts it", async () => {
    await acceptSuggestion({ contactId: "c1", field: "phone", value: "+18585550100", source: "site", lawfulBasis: LB });
    const first = contact().found_at as string;
    expect(contact()).toMatchObject({ lawful_basis: LB, phone: "+18585550100" });
    const months = new Date(contact().retention_expires_at as string).getUTCMonth() - new Date(first).getUTCMonth();
    expect((months + 12) % 12).toBe(0); // 12 months later, same month
    const expires = contact().retention_expires_at;
    db.rows("marketing_settings")[0].finder_retention_months = 6;
    await acceptSuggestion({ contactId: "c1", field: "email", value: "jane.doe@acmefund.com", source: "profile", lawfulBasis: "consent" });
    expect(contact().found_at).toBe(first);
    expect(contact().retention_expires_at).toBe(expires);
    // An existing basis is kept; the page default never overwrites it.
    expect(contact().lawful_basis).toBe(LB);
  });

  it("accept still works before the v2 migration (no provenance columns)", async () => {
    for (const c of ["found_at", "retention_expires_at", "lawful_basis"]) db.failColumns.add(c);
    db.failTables.add("contact_finder_suggestions");
    await acceptSuggestion({ contactId: "c1", field: "email", value: "jane.doe@acmefund.com", source: "profile", lawfulBasis: LB });
    expect(contact()).toMatchObject({ email: "jane.doe@acmefund.com", email_status: "risky" });
    await logManualReveal({ contactId: "c1", phone: "+33 1 23 45 67 89", source: "manual_kaspr", lawfulBasis: LB });
    expect(contact().phone).toBe("+33123456789");
  });

  it("an accepted guess is saved as risky", async () => {
    await acceptSuggestion({ contactId: "c1", field: "email", value: "jane.doe@acmefund.com", source: "profile", lawfulBasis: LB });
    expect(contact()).toMatchObject({ email: "jane.doe@acmefund.com", email_source: "profile", email_status: "risky" });
  });
});

describe("suppression (D6)", () => {
  it("an opted-out contact is not looked up", async () => {
    Object.assign(contact(), { email: "jane@old.com", email_status: "invalid" });
    db.rows("marketing_unsubscribes").push({ email: "jane@old.com" });
    const r = await suggestForContact("c1");
    expect(r.suggestions).toEqual([]);
    expect(r.reason).toMatch(/opted out/);
    expect(scrapeSiteContacts).not.toHaveBeenCalled();
    expect(db.rows("contact_lookups")[0]).toMatchObject({ outcome: "skipped_suppressed" });
  });

  it("accept refuses an opted-out contact and an opted-out address", async () => {
    contact().suppressed = true;
    await expect(acceptSuggestion({ contactId: "c1", field: "phone", value: "+18585550100", source: "site", lawfulBasis: LB })).rejects.toThrow(/opted out/);
    contact().suppressed = false;
    db.rows("marketing_unsubscribes").push({ email: "jane.doe@acmefund.com" });
    await expect(acceptSuggestion({ contactId: "c1", field: "email", value: "jane.doe@acmefund.com", source: "profile", lawfulBasis: LB })).rejects.toThrow(/opted out/);
    expect(contact().email).toBeNull();
  });
});

describe("manual reveal (5.7)", () => {
  it("saves a Kaspr reveal as provider-sourced, logs it and starts retention", async () => {
    const r = await logManualReveal({ contactId: "c1", email: "Jane.Doe@AcmeFund.com", phone: "+33 1 23 45 67 89", source: "manual_kaspr", lawfulBasis: LB });
    expect(r).toEqual({ email: "jane.doe@acmefund.com", phone: "+33123456789" });
    expect(contact()).toMatchObject({ email_source: "provider", phone_source: "manual_kaspr", lawful_basis: LB });
    expect(contact().found_at).toBeTruthy();
    expect(db.rows("contact_lookups").map((l) => `${l.source}:${l.field}`)).toEqual(["manual_kaspr:email", "manual_kaspr:phone"]);
  });

  it("refuses a company inbox, a bad phone and an empty reveal", async () => {
    await expect(logManualReveal({ contactId: "c1", email: "info@acmefund.com", source: "manual_apollo", lawfulBasis: LB })).rejects.toThrow(/company inbox/);
    await expect(logManualReveal({ contactId: "c1", phone: "20260512 1234", source: "manual_apollo", lawfulBasis: LB })).rejects.toThrow(/phone/);
    await expect(logManualReveal({ contactId: "c1", source: "manual_apollo", lawfulBasis: LB })).rejects.toThrow(/Enter an email/);
  });
});
