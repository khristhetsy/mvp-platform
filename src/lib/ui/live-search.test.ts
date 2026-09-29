import { describe, expect, it } from "vitest";
import { matchRows, searchHit, searchSummary, type SearchField } from "@/lib/ui/live-search";

type Row = { name: string; founder: string; industry: string; stage: string; score: number | null };

const rows: Row[] = [
  { name: "Impervitex Corp", founder: "Cynthia Mcbreen", industry: "Deep Tech", stage: "Marketing", score: 27 },
  { name: "Credtent, Inc.", founder: "Eric R Burgess", industry: "AI / ML", stage: "Preparation", score: 36 },
  { name: "Tinski Tech", founder: "Martin Goldberg", industry: "Deep Tech", stage: "Preparation", score: null },
  { name: "Brainiest AI Technology", founder: "Alan Steinberg", industry: "SaaS", stage: "Onboarding", score: 28 },
];

const fields: SearchField<Row>[] = [
  { label: "company name", get: (r) => r.name },
  { label: "founder", get: (r) => r.founder },
  { label: "industry", get: (r) => r.industry },
  { label: "stage", get: (r) => r.stage },
  { label: "score", get: (r) => r.score },
];

describe("matchRows", () => {
  it("returns everything, inactive, for an empty query", () => {
    const r = matchRows(rows, fields, "   ");
    expect(r.rows).toHaveLength(4);
    expect(r.active).toBe(false);
  });

  it("keeps the unfiltered total so the count line can say 'N of M'", () => {
    // The actual bug: the old count used the unfiltered length and never moved.
    const r = matchRows(rows, fields, "imp");
    expect(r.rows).toHaveLength(1);
    expect(r.total).toBe(4);
  });

  it("names which field matched", () => {
    expect(matchRows(rows, fields, "imp").matchedFields).toContain("company name");
    expect(matchRows(rows, fields, "cynthia").matchedFields).toContain("founder");
  });

  it("searches the columns the table actually shows, not just four of them", () => {
    expect(matchRows(rows, fields, "preparation").rows).toHaveLength(2);
    expect(matchRows(rows, fields, "27").rows).toHaveLength(1);
  });

  it("narrows on a second term instead of widening", () => {
    // "deep" alone hits two; adding "tinski" must cut it to one.
    expect(matchRows(rows, fields, "deep").rows).toHaveLength(2);
    expect(matchRows(rows, fields, "deep tinski").rows).toHaveLength(1);
  });

  it("matches terms across different fields", () => {
    expect(matchRows(rows, fields, "alan saas").rows).toHaveLength(1);
  });

  it("is case-insensitive and ignores a null value", () => {
    expect(matchRows(rows, fields, "TINSKI").rows).toHaveLength(1);
    expect(matchRows(rows, fields, "null").rows).toHaveLength(0);
  });

  it("returns an empty list rather than everything when nothing matches", () => {
    const r = matchRows(rows, fields, "zzz");
    expect(r.rows).toHaveLength(0);
    expect(r.total).toBe(4);
  });
});

describe("searchHit", () => {
  it("splits around the match", () => {
    expect(searchHit("Impervitex Corp", "imp")).toEqual([
      { text: "Imp", hit: true },
      { text: "ervitex Corp", hit: false },
    ]);
  });

  it("marks every separated occurrence", () => {
    const out = searchHit("Deep Tech and Deep Space", "deep").filter((s) => s.hit);
    expect(out).toHaveLength(2);
  });

  it("merges touching occurrences into one highlight", () => {
    // "b[anan]a" — two adjacent hits render identically as one <mark>, so they
    // are merged rather than emitted as separate segments.
    expect(searchHit("banana", "an").filter((s) => s.hit).map((s) => s.text)).toEqual(["anan"]);
  });

  it("merges overlapping terms so nothing is wrapped twice", () => {
    const out = searchHit("technology", "tech technol");
    expect(out.filter((s) => s.hit).map((s) => s.text)).toEqual(["technol"]);
  });

  it("returns the text untouched when there is no query or no match", () => {
    expect(searchHit("Tinski", "")).toEqual([{ text: "Tinski", hit: false }]);
    expect(searchHit("Tinski", "zzz")).toEqual([{ text: "Tinski", hit: false }]);
  });

  it("does not lose characters", () => {
    const text = "Brainiest AI Technology";
    expect(searchHit(text, "ai").map((s) => s.text).join("")).toBe(text);
  });
});

describe("searchSummary", () => {
  it("shows a plain total when no query is active", () => {
    expect(searchSummary(matchRows(rows, fields, ""), "companies")).toBe("4 companies");
  });

  it("shows N of M and the matched field once searching", () => {
    expect(searchSummary(matchRows(rows, fields, "imp"), "companies")).toContain("1 of 4 companies");
    expect(searchSummary(matchRows(rows, fields, "imp"), "companies")).toContain("company name");
  });

  it("drops the matched-field clause when nothing matched", () => {
    expect(searchSummary(matchRows(rows, fields, "zzz"), "companies")).toBe("0 of 4 companies");
  });
});
