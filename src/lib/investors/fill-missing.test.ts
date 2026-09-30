import { describe, it, expect } from "vitest";
import { industriesFromNotes, computeTypeDefaults, itemsFor, typeBucket, PITCHBOOK_MAP, STATED_TAG, GUESS_TAG, type FillRow } from "./fill-missing";

const row = (o: Partial<FillRow> = {}): FillRow => ({
  id: o.id ?? "c1", company: o.company ?? "Acme", overrides: o.overrides ?? {},
  types: o.types ?? [], industries: o.industries ?? [], fundingStages: o.fundingStages ?? [],
  capital: o.capital ?? [], businessEntity: o.businessEntity ?? [], extra: o.extra ?? {},
});

describe("industriesFromNotes", () => {
  it("maps PitchBook sector names and de-dupes", () => {
    expect(industriesFromNotes("Commercial Services, Services (Non-Financial), Software")).toEqual(["Business Services", "Software"]);
  });
  it("ignores free text rather than guessing from it", () => {
    expect(industriesFromNotes("Undeliverable email-x@y.com")).toEqual([]);
    expect(industriesFromNotes("upon request")).toEqual([]);
    expect(industriesFromNotes(null)).toEqual([]);
  });
  it("accepts a truncated name only when it is unambiguous", () => {
    expect(industriesFromNotes("Software, Financial Serv...")).toEqual(["Software", "Financial Services"]);
    expect(industriesFromNotes("C...")).toEqual([]);   // matches many names
  });
  it("maps only onto the platform industry vocabulary", () => {
    const vocab = new Set(["Software", "Enterprise Software", "Business Services", "Professional Services", "Media", "Financial Services", "Insurance", "HealthTech", "Medical Devices", "Healthcare", "Biotechnology/Life Science", "Consumer", "Consumer Products", "Apparel", "Industrial", "Data/IoT", "Communications", "Transportation", "Agriculture", "Energy", "Food/Hospitality", "Hardware", "Semiconductor", "Artificial Intelligence", "Construction", "Real Estate", "Aerospace"]);
    for (const v of Object.values(PITCHBOOK_MAP)) expect(vocab.has(v)).toBe(true);
  });
});

describe("typeBucket", () => {
  it("prefers overrides and canonicalises", () => {
    expect(typeBucket(row({ types: ["Venture Capital", "Fund Manager"] }))).toBe("VC");
    expect(typeBucket(row({ types: ["Venture Capital"], overrides: { "Investor type": ["Angel Investor"] } }))).toBe("Angel");
    expect(typeBucket(row({ types: ["Fund Manager"] }))).toBeNull();
  });
});

describe("computeTypeDefaults", () => {
  const many = (n: number, o: Partial<FillRow>) => Array.from({ length: n }, (_, i) => row({ id: `x${i}`, ...o }));
  it("uses a value only when half the same-type answers chose it", () => {
    const rows = [
      ...many(20, { types: ["Angel"], capital: ["Equity Capital"] }),
      ...many(10, { types: ["Angel"], capital: ["Debt Capital"] }),
    ];
    const d = computeTypeDefaults(rows);
    expect(d.Angel?.capital_type?.sample).toBe(30);
    expect(d.Angel?.capital_type?.values.map((v) => v.value)).toEqual(["Equity Capital"]);
  });
  it("leaves the field blank below the minimum sample", () => {
    expect(computeTypeDefaults(many(29, { types: ["Angel"], capital: ["Equity Capital"] })).Angel).toBeUndefined();
  });
  it("counts only Odoo-stated values, never earlier guesses", () => {
    const rows = many(40, { types: ["Angel"], overrides: { "Capital type": ["Equity Capital"] } });
    expect(computeTypeDefaults(rows).Angel).toBeUndefined();
  });
  it("keeps every value that reaches the share, for multi-select fields", () => {
    const rows = many(30, { types: ["VC"], fundingStages: ["Seed Round", "Series A"] });
    expect(computeTypeDefaults(rows).VC?.funding_stage?.values.map((v) => v.value)).toEqual(["Seed Round", "Series A"]);
  });
});

describe("itemsFor", () => {
  it("stated: fills industry from notes and tags it", () => {
    const got = itemsFor(row({ extra: { "Investor quick notes": "Software" } }), "stated");
    expect(got).toEqual([expect.objectContaining({ key: "Industries", values: ["Software"], sourceKey: "_industry_source", tag: STATED_TAG })]);
  });
  it("stated: never touches a contact that already has an industry", () => {
    expect(itemsFor(row({ industries: ["Fintech"], extra: { "Investor quick notes": "Software" } }), "stated")).toEqual([]);
    expect(itemsFor(row({ overrides: { Industries: ["Fintech"] }, extra: { "Investor quick notes": "Software" } }), "stated")).toEqual([]);
  });
  it("guess: fills only missing fields for the contact's type", () => {
    const defaults = { Angel: { capital_type: { sample: 40, values: [{ value: "Equity Capital", share: 0.9 }] }, business_entity: { sample: 40, values: [{ value: "Privately Held", share: 0.8 }] } } };
    const got = itemsFor(row({ types: ["Angel"], businessEntity: ["Going Public"] }), "guess", defaults);
    expect(got).toEqual([expect.objectContaining({ field: "capital_type", key: "Capital type", values: ["Equity Capital"], tag: GUESS_TAG })]);
  });
  it("guess: nothing for a contact with no recognised type", () => {
    expect(itemsFor(row({ types: [] }), "guess", { Angel: { capital_type: { sample: 40, values: [{ value: "Equity Capital", share: 1 }] } } })).toEqual([]);
  });
});
