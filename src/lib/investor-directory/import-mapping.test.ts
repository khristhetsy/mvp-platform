import { describe, expect, it } from "vitest";
import { applyMapping, autoMatch, parseLocation, suggest } from "@/lib/investor-directory/import-mapping";

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
    expect(a.industries).toEqual(["Healthtech / Digital Health", "Cybersecurity"]);
    expect(a.strategy).toBe("Lead");
    expect(a.source_url).toBe("https://src.example/a");
    expect(a.notes).toContain("Verification Status: Verified by hand");
    expect(a.notes).toContain("Investment Size: $1m–$10m");
    const b = r.rows[1];
    expect(b.website).toBe("https://beta.com"); // gap filled from the duplicate
    expect(b.industries).toEqual(["AI"]);
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
