import { describe, expect, it } from "vitest";
import {
  companySummaryFromRow,
  parseGuessBasis,
  readPublishedPhone,
  splitList,
  suggestionsFromFoundRow,
  suggestionsFromResearchRow,
  toLabels,
  type Vocab,
} from "@/lib/contacts/profile-fill/fields";
import { findPersonOnPage, pageText } from "@/lib/contacts/profile-fill/person-search";

const vocab = (pairs: Array<[string, string]>): Vocab => {
  const m: Vocab = new Map();
  for (const [slug, label] of pairs) { m.set(slug, label); m.set(label.toLowerCase(), label); }
  return m;
};
const V = {
  investor_type: vocab([["private-equity", "Private Equity"], ["family-office", "Family Office"]]),
  industry: vocab([["healthcare", "Healthcare"], ["real-estate", "Real Estate"]]),
  funding_stage: vocab([["seed", "Seed"], ["series-a", "Series A"]]),
  money_band: vocab([["$1m - $10m", "$1m - $10m"]]),
  geography: vocab([["north-america", "North America"]]),
};

const row = (o: Record<string, string>) => ({
  "First Name": "Jon", "Last Name": "Lemelman", Company: "Paras Capital Partners", Position: "Managing Director",
  "LinkedIn URL": "https://www.linkedin.com/in/jon-lemelman-7401b", Confidence: "medium",
  Bio: "", "Bio basis": "", "Bio sources": "", "Company summary": "", Website: "", "HQ city": "",
  "Investor type (guess)": "", "Industries (guess)": "", "Funding stages (guess)": "", "Check size (guess)": "", "Geography (guess)": "",
  "Guess basis": "", "Published email": "", "Published phone": "", "Contact source": "", ...o,
});

describe("research rows become labelled proposals", () => {
  it("a published bio is Found with its source; a title-only bio is a Guess", () => {
    const a = suggestionsFromResearchRow(row({ Bio: "Spent two decades in PE.", "Bio basis": "published", "Bio sources": "https://example.com/ep16 | https://x.com" }), V);
    expect(a.find((s) => s.field === "bio")).toMatchObject({ label: "found", sourceUrl: "https://example.com/ep16" });
    const b = suggestionsFromResearchRow(row({ Bio: "Listed as Founder.", "Bio basis": "title_only" }), V);
    expect(b.find((s) => s.field === "bio")?.label).toBe("guess");
  });

  it("maps guesses onto the existing vocabularies and drops unknown values", () => {
    const s = suggestionsFromResearchRow(row({
      "Investor type (guess)": "private-equity", "Industries (guess)": "healthcare, made-up-sector",
      "Funding stages (guess)": "seed, series-a", "Check size (guess)": "$1m - $10m", "Geography (guess)": "north-america",
      "Guess basis": "investor_type: firm site says private equity | industries: portfolio is healthcare",
    }), V);
    expect(s.find((x) => x.field === "investor_type")).toMatchObject({ value: "Private Equity", label: "guess", basis: "firm site says private equity" });
    expect(s.find((x) => x.field === "industries")?.value).toEqual(["Healthcare"]);
    expect(s.find((x) => x.field === "funding_stages")?.value).toEqual(["Seed", "Series A"]);
    expect(s.find((x) => x.field === "check_size")?.value).toBe("$1m - $10m");
    expect(s.find((x) => x.field === "geography")?.value).toEqual(["North America"]);
  });

  it("published email and phone are Found; an office line is labelled as one", () => {
    const s = suggestionsFromResearchRow(row({ "Published email": "Jared@ConanicutCap.com", "Published phone": "+1.619.808.9258 (firm office)", "Contact source": "https://conanicutcap.com/" }), V);
    expect(s.find((x) => x.field === "email")).toMatchObject({ value: "jared@conanicutcap.com", label: "found", sourceUrl: "https://conanicutcap.com/" });
    expect(s.find((x) => x.field === "phone")).toMatchObject({ value: "+1.619.808.9258", basis: "Office line, published" });
  });

  it("never proposes a malformed email", () => {
    expect(suggestionsFromResearchRow(row({ "Published email": "jared at conanicut" }), V).some((x) => x.field === "email")).toBe(false);
  });

  it("leaves out summaries for firms the research could not confirm", () => {
    expect(companySummaryFromRow(row({ "Company summary": "No investment firm named Khora could be confirmed." }))).toBeNull();
    expect(companySummaryFromRow(row({ "Company summary": "Boston healthcare PE firm.", Website: "https://paras.com" }))).toMatchObject({ company: "Paras Capital Partners", website: "https://paras.com" });
  });
});

describe("found contacts from your exports", () => {
  it("labels them with the export they came from", () => {
    const s = suggestionsFromFoundRow({ Email: "peter@surglogs.com", Phone: "(619) 202-4140", Source: "Drive: 2023 LinkedIn investor export" });
    expect(s).toEqual([
      expect.objectContaining({ field: "email", label: "found", basis: "Drive: 2023 LinkedIn investor export" }),
      expect.objectContaining({ field: "phone", value: "(619) 202-4140" }),
    ]);
  });
});

describe("helpers", () => {
  it("splitList, toLabels, parseGuessBasis, readPublishedPhone", () => {
    expect(splitList("a, b | a; c")).toEqual(["a", "b", "c"]);
    expect(toLabels(["Seed", "nope"], V.funding_stage)).toEqual(["Seed"]);
    expect(parseGuessBasis("industries: x | check_size: y")).toEqual({ industries: "x", check_size: "y" });
    expect(readPublishedPhone("617-882-7532")).toEqual({ phone: "617-882-7532", office: false });
    expect(readPublishedPhone("call us")).toBeNull();
  });
});

describe("person search on a firm's page", () => {
  const html = `<html><body><nav>Home Team</nav>
    <div class="card"><h3>Jane Doe</h3><p>Partner</p><a href="mailto:jane@acmecap.com">Email</a><p>+1 (858) 555-0101</p></div>
    <div class="card"><h3>Bob Smith</h3><p>Associate</p><a href="mailto:bob@acmecap.com">Email</a></div>
    <footer>info@acmecap.com · (858) 555-0100</footer></body></html>`;

  it("takes the email carrying the person's name and the phone printed with their card", () => {
    expect(findPersonOnPage(html, "Jane", "Doe")).toMatchObject({ nameSeen: true, email: "jane@acmecap.com", phone: "+18585550101", phoneKind: "direct" });
  });

  it("does not hand the footer's main number to a person as a direct line", () => {
    expect(findPersonOnPage(html, "Bob", "Smith")).toMatchObject({ phone: null, phoneKind: null });
  });

  it("never gives a company inbox or someone else's address", () => {
    const hit = findPersonOnPage(html, "Bob", "Smith");
    expect(hit.email).toBe("bob@acmecap.com");
    const none = findPersonOnPage(html.replace(/bob@acmecap\.com/, "info@acmecap.com"), "Bob", "Smith");
    expect(none.email).toBeNull();
  });

  it("finds nothing when the full name is not on the page", () => {
    expect(findPersonOnPage(html, "Ann", "Lee").nameSeen).toBe(false);
  });

  it("keeps mailto targets in the page text", () => {
    expect(pageText(`<a href="mailto:x@y.com">Mail</a>`)).toContain("x@y.com");
  });
});
