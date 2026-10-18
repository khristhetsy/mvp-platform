import { describe, expect, it } from "vitest";
import { applyEdits, applyMapping, autoMatch, cellText, guessCapital, guessEdits, parseEdit, parseLocation, suggest } from "@/lib/investor-directory/import-mapping";
import type { CleanRow } from "@/lib/investor-directory/clean";
import { industrySlugs, suggestIndustries, toIndustrySlugs } from "@/lib/investor-directory/industries";

const headers = [
  "Investor Name", "Contact Name", "Job Title", "Public Email", "Phone", "Investor Type", "Industry Sector",
  "Investment Size", "Location", "Website", "Funding Stage", "Lead / Follow", "Source URL", "Verification Status",
  "Contact Attribution Note", "Mystery Column",
];
const rows = [
  ["Acme Ventures", "jane doe", "Partner", "jane@acme.com", "617-555-0100", "Venture Capital", "Healthtech / Digital Health, Cybersecurity",
    "$1m–$10m", "California, USA", "https://acme.com", "Seed, Series A", "Lead", "https://src.example/a", "Verified by hand", "Found on site", "x"],
  ["Beta Capital", "", "", "info@beta.com", "", "Family Office", "", "", "TX, USA", "", "Early Stage", "", "", "", "", ""],
  ["Beta Capital", "", "", "info@beta.com", "", "", "AI", "", "", "https://beta.com", "", "", "", "", "", ""],
];

describe("suggest and autoMatch", () => {
  it("matches common headers and asks about the rest", () => {
    const m = autoMatch(headers, rows);
    expect(m.mapping["0"]).toEqual(["firm"]);
    expect(m.mapping["3"]).toEqual(["email"]);
    expect(m.mapping["13"]).toEqual(["notes"]);
    expect(m.needsAnswer).toEqual([15]);
  });
  it("skips extra email columns", () => {
    expect(suggest("Email 2", ["a@b.com"])).toMatchObject({ matched: true, fields: [] });
  });
  it("offers best fits with reasons for an unknown column of emails", () => {
    const s = suggest("Reach", ["a@b.com", "c@d.org"]);
    expect(s.matched).toBe(false);
    expect(s.options[0].field).toBe("email");
    expect(s.options.at(-1)?.field).toBe("skip");
  });
});

describe("parseLocation", () => {
  it("splits places", () => {
    expect(parseLocation("California, USA")).toEqual({ city: null, state: "CA", country: "US" });
    expect(parseLocation("TX, USA")).toEqual({ city: null, state: "TX", country: "US" });
    expect(parseLocation("Massachusetts")).toEqual({ city: null, state: "MA", country: "US" });
    expect(parseLocation("Boston, MA")).toEqual({ city: "Boston", state: "MA", country: "US" });
  });
});

describe("applyMapping", () => {
  const { mapping } = autoMatch(headers, rows);
  const full = { ...mapping, "15": [] as never[] };
  it("builds clean rows, dedupes by email and keeps unmatched labels in notes", () => {
    const r = applyMapping(headers, rows, full);
    expect(r.rows).toHaveLength(2);
    expect(r.merged).toBe(1);
    const a = r.rows[0];
    expect(a.contact_name).toBe("Jane Doe");
    expect(a.state).toBe("CA");
    expect(a.funding_stages).toEqual(["seed", "series-a"]);
    expect(a.investor_types).toEqual(["venture-capital"]);
    expect(a.industries).toEqual(["healthtech", "digital-health", "cyber-security"]);
    expect(a.strategy).toBe("Lead");
    expect(a.source_url).toBe("https://src.example/a");
    expect(a.notes).toContain("Verification Status: Verified by hand");
    expect(a.notes).toContain("Investment Size: $1m–$10m");
    const b = r.rows[1];
    expect(b.website).toBe("https://beta.com"); // gap filled from the duplicate
    expect(b.industries).toEqual(["ai-ml"]);
  });
  it("lets one column feed several fields", () => {
    const r = applyMapping(["Firm", "Note"], [["Acme", "Hello"]], { "0": ["firm"], "1": ["notes", "strategy"] });
    expect(r.rows[0].notes).toBe("Note: Hello");
    expect(r.rows[0].strategy).toBe("Hello");
  });
  it("stores the United States as US", () => {
    const r = applyMapping(["Firm", "Country"], [["Acme", "United States"], ["Beta", "Canada"]], { "0": ["firm"], "1": ["country"] });
    expect(r.rows.map((x) => x.country)).toEqual(["US", "Canada"]);
  });
  it("needs a firm column", () => {
    expect(applyMapping(["A"], [["x"]], { "0": ["notes"] }).missingFirm).toBe(true);
  });
  it("applies chosen values over the built-in mapping", () => {
    const r = applyMapping(["Firm", "Type"], [["Acme", "Syndicate"]], { "0": ["firm"], "1": ["investor_types"] }, { "1": { Syndicate: ["other"] } });
    expect(r.rows[0].investor_types).toEqual(["other"]);
  });
});

describe("review edits", () => {
  const base = applyMapping(["Firm", "Email", "Type", "Stage"], [["Acme", "a@acme.com", "Venture Capital", "Seed"], ["Beta", "b@beta.com", "Angel", ""]],
    { "0": ["firm"], "1": ["email"], "2": ["investor_types"], "3": ["funding_stages"] }).rows;
  it("shows lists as labels", () => {
    expect(cellText(base[0], "investor_types")).toBe("Venture capital");
    expect(cellText(base[0], "funding_stages")).toBe("Seed");
  });
  it("turns edited labels back into option slugs", () => {
    expect(parseEdit("investor_types", "Venture capital, Family office")).toEqual({ investor_types: ["venture-capital", "family-office"] });
    expect(parseEdit("funding_stages", "Series A, nonsense")).toEqual({ funding_stages: ["series-a"] });
    expect(parseEdit("state", "Texas")).toEqual({ state: "TX" });
    expect(parseEdit("country", "United States")).toEqual({ country: "US" });
  });
  it("applies edits by row index and drops excluded rows", () => {
    const r = applyEdits(base, { "0": { firm: "Acme Capital", email: "new@acme.com" } }, [1]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].firm).toBe("Acme Capital");
    expect(r.rows[0].email).toBe("new@acme.com");
  });
  it("drops a bad edited email and counts it", () => {
    const r = applyEdits(base, { "0": { email: "not an email" } }, []);
    expect(r.rows[0].email).toBeNull();
    expect(r.invalidEmails).toBe(1);
  });
  it("ignores fields that are not editable", () => {
    const r = applyEdits(base, { "0": { fund_size: "99" } }, []);
    expect(r.rows[0].fund_size).toBeNull();
  });
});

describe("guessing missing fields", () => {
  const base = (o: Partial<CleanRow>): CleanRow => ({
    firm: "A", contact_name: null, title: null, email: null, phone: null, website: null, city: null, state: null,
    investor_types: [], funding_stages: [], capital_types: [], industries: [], fund_name: null, fund_size: null, avg_investment: null,
    strategy: null, investing_now: null, notes: null, ...o,
  } as CleanRow);
  it("matches industry names to the directory list", () => {
    expect(industrySlugs("Cybersecurity")).toEqual(["cyber-security"]);
    expect(industrySlugs("Crypto / Web3")).toEqual(["cryptocurrency", "blockchain"]);
    expect(industrySlugs("Real Estate")).toEqual(["real-estate"]);
    expect(industrySlugs("Oil and Gas")).toEqual(["oil-gas"]);
    expect(industrySlugs("Remote Work Tech")).toEqual([]);
    expect(industrySlugs("Real Estate / Remote Work Tech")).toEqual(["real-estate"]);
  });
  it("guesses capital from investor type", () => {
    expect(guessCapital(["angel-investor"])).toEqual(["equity-capital"]);
    expect(guessCapital(["lender"])).toEqual(["debt-capital"]);
    expect(guessCapital(["other"])).toEqual([]);
  });
  it("fills empty capital, fixes industries, moves unmatched names to notes, skips edited cells", () => {
    const rows = [base({ investor_types: ["angel-investor"], industries: ["Cybersecurity", "Remote Work Tech", "Real Estate"], notes: "Past Investments: X" }), base({ investor_types: ["venture-capital"], industries: ["gaming"] })];
    const g = guessEdits(rows, { 1: { capital_types: "Debt capital" } });
    expect(g.edits[0]).toEqual({ capital_types: "Equity capital", industries: "Cyber Security, Real Estate", notes: "Past Investments: X | Industries: Remote Work Tech" });
    expect(g.edits[1]).toBeUndefined();
    expect(g.capital).toBe(1);
    const r = applyEdits(rows, { 0: g.edits[0] }, []);
    expect(r.rows[0].capital_types).toEqual(["equity-capital"]);
    expect(r.rows[0].industries).toEqual(["cyber-security", "real-estate"]);
  });
});

describe("duplicate emails created by edits", () => {
  const mk = (o: Partial<CleanRow>): CleanRow => ({
    firm: "A", contact_name: null, title: null, email: null, phone: null, website: null, city: null, state: null,
    investor_types: [], funding_stages: [], capital_types: [], industries: [], fund_name: null, fund_size: null, avg_investment: null,
    strategy: null, investing_now: null, notes: null, ...o,
  } as CleanRow);
  it("merges records that end up sharing an email and fills gaps", () => {
    const rows = [mk({ firm: "One", email: "a@x.com", industries: ["SaaS"] }), mk({ firm: "Two", email: "b@x.com", phone: "(555) 111-2222", industries: ["Fintech"] }), mk({ firm: "Three", email: "c@x.com" })];
    const r = applyEdits(rows, { 1: { email: "A@X.com" } }, []);
    expect(r.mergedByEdit).toBe(1);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].firm).toBe("One");
    expect(r.rows[0].phone).toBe("(555) 111-2222");
    expect(r.rows[0].industries).toEqual(["SaaS", "Fintech"]);
  });
  it("does not merge records with no email", () => {
    const r = applyEdits([mk({ firm: "One" }), mk({ firm: "Two" })], {}, []);
    expect(r.rows).toHaveLength(2);
    expect(r.mergedByEdit).toBe(0);
  });
});

describe("industries stored as directory codes", () => {
  it("maps a file's industry names to codes on import and keeps unmatched names", () => {
    const out = applyMapping(["Investor", "Industries"], [["Fund A", "Cybersecurity; Remote Work Tech, Real Estate"]], { "0": ["firm"], "1": ["industries"] }, {});
    expect(out.rows[0].industries).toEqual(["cyber-security", "Remote Work Tech", "real-estate"]);
  });
  it("shows codes as labels on the review screen and reads labels back as codes", () => {
    const row = { industries: ["cyber-security", "Remote Work Tech"] } as never;
    expect(cellText(row, "industries")).toBe("Cyber Security, Remote Work Tech");
    expect(parseEdit("industries", "Cyber Security, SaaS").industries).toEqual(["cyber-security", "saas"]);
  });
  it("splits a list into codes and leftovers", () => {
    expect(toIndustrySlugs(["fintech", "Healthtech / Digital Health", "Women Founded"])).toEqual({ slugs: ["fintech", "healthtech", "digital-health"], leftover: ["Women Founded"] });
  });
});

describe("industry suggestions for the verification queue", () => {
  it("is strong when two sources agree", () => {
    const s = suggestIndustries({ firm: "Acme Cyber Fund", website: "https://acmecyber.com", siteText: "We back security startups" });
    expect(s.level).toBe("strong");
    expect(s.slugs).toContain("cyber-security");
  });
  it("is possible with one source and none with nothing", () => {
    expect(suggestIndustries({ firm: "Pear VC", siteText: "invests in software companies" }).level).toBe("possible");
    expect(suggestIndustries({ firm: "SeedFolio", website: "seedfolio.com" })).toMatchObject({ level: "none", slugs: [] });
  });
});
