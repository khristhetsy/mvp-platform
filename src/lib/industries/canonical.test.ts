import { describe, it, expect } from "vitest";
import { canonicalizeIndustry, canonicalizeIndustries, sortSectors } from "./canonical";

describe("canonicalizeIndustry", () => {
  it("merges/moves per the taxonomy rules", () => {
    expect(canonicalizeIndustry("biote")).toBe("Biotechnology/Life Science");
    expect(canonicalizeIndustry("Internet")).toBe("Data/IoT");
    expect(canonicalizeIndustry("Technology/Web")).toBe("Data/IoT");
    expect(canonicalizeIndustry("Information Technology")).toBe("Data/IoT");
    expect(canonicalizeIndustry("SAAS")).toBe("SaaS");
    expect(canonicalizeIndustry("APPS")).toBe("SaaS");
    expect(canonicalizeIndustry("Space Tech")).toBe("Aerospace");
    expect(canonicalizeIndustry("Education")).toBe("EdTech");
  });
  it("removes Agnostic, blanks, and stray number ids", () => {
    expect(canonicalizeIndustry("Agnostic")).toBeNull();
    expect(canonicalizeIndustry("  ")).toBeNull();
    for (const n of ["20", "29", "3", "30", "33", "41", "42", "7", "9"]) expect(canonicalizeIndustry(n)).toBeNull();
  });
  it("merges Business Service into Business Services and canon-cases Hospitality", () => {
    expect(canonicalizeIndustry("Business Service")).toBe("Business Services");
    expect(canonicalizeIndustry("business services")).toBe("Business Services");
    expect(canonicalizeIndustry("hospitality")).toBe("Hospitality");
  });
  it("normalizes case variants to one spelling", () => {
    expect(canonicalizeIndustry("fintech")).toBe("Fintech");
    expect(canonicalizeIndustry("FinTech")).toBe("Fintech");
  });
});

describe("canonicalizeIndustries", () => {
  it("dedupes after canonicalizing", () => {
    expect(canonicalizeIndustries(["SAAS", "SaaS", "APPS"])).toEqual(["SaaS"]);
    expect(canonicalizeIndustries(["Internet", "Information Technology"])).toEqual(["Data/IoT"]);
    expect(canonicalizeIndustries(["Agnostic", "Fintech"])).toEqual(["Fintech"]);
  });
});

describe("sortSectors", () => {
  it("sorts alphabetically with Other last", () => {
    expect(sortSectors(["Other", "Aerospace", "SaaS"])).toEqual(["Aerospace", "SaaS", "Other"]);
  });
});
