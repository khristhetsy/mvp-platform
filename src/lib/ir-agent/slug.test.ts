import { describe, expect, it } from "vitest";
import {
  agentPath,
  agentUrl,
  isReservedSlug,
  normalizeEnding,
  slugifyCompany,
  trackedUrl,
  uniqueCompanySlug,
  validateCompanySlug,
  validateEnding,
} from "./slug";

describe("slugifyCompany", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyCompany("Northwind Labs")).toBe("northwind-labs");
  });
  it("strips accents and punctuation", () => {
    expect(slugifyCompany("Café Société, Inc.")).toBe("cafe-societe-inc");
  });
  it("turns ampersands into and", () => {
    expect(slugifyCompany("Smith & Sons")).toBe("smith-and-sons");
  });
  it("trims to 40 characters without a trailing hyphen", () => {
    const s = slugifyCompany("a".repeat(38) + " bbbb");
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("validateCompanySlug", () => {
  it("accepts a normal slug", () => {
    expect(validateCompanySlug("northwind-labs").ok).toBe(true);
  });
  it("rejects reserved names", () => {
    expect(validateCompanySlug("fit").ok).toBe(false);
    expect(validateCompanySlug("investors").ok).toBe(false);
    expect(validateCompanySlug("johnny").ok).toBe(false);
    expect(validateCompanySlug("founder").ok).toBe(false);
  });
  it("rejects bad characters and double hyphens", () => {
    expect(validateCompanySlug("north_wind").ok).toBe(false);
    expect(validateCompanySlug("north--wind").ok).toBe(false);
  });
  it("rejects too short", () => {
    expect(validateCompanySlug("ab").ok).toBe(false);
  });
});

describe("validateEnding and normalizeEnding", () => {
  it("accepts invest and raise", () => {
    expect(validateEnding("invest").ok).toBe(true);
    expect(validateEnding("raise-2026").ok).toBe(true);
  });
  it("rejects slashes, spaces and uppercase", () => {
    expect(validateEnding("a/b").ok).toBe(false);
    expect(validateEnding("my agent").ok).toBe(false);
    expect(validateEnding("Invest").ok).toBe(false);
  });
  it("normalizes what a founder types", () => {
    expect(normalizeEnding("Seed Round!")).toBe("seed-round");
    expect(normalizeEnding("--invest--")).toBe("invest");
  });
});

describe("uniqueCompanySlug", () => {
  it("returns the base when free", () => {
    expect(uniqueCompanySlug("Northwind Labs", new Set())).toBe("northwind-labs");
  });
  it("adds a number when taken", () => {
    expect(uniqueCompanySlug("Northwind Labs", new Set(["northwind-labs"]))).toBe("northwind-labs-2");
  });
  it("never returns a reserved slug", () => {
    expect(isReservedSlug(uniqueCompanySlug("Fit", new Set()))).toBe(false);
    expect(uniqueCompanySlug("Johnny", new Set())).toBe("johnny-2");
  });
});

describe("urls", () => {
  it("builds the page address", () => {
    expect(agentPath("northwind-labs", "invest")).toBe("/northwind-labs/invest");
    expect(agentUrl("northwind-labs", "invest")).toBe("https://icapos.com/northwind-labs/invest");
  });
  it("builds tracked links", () => {
    expect(trackedUrl("northwind-labs", "invest", "linkedin")).toBe("https://icapos.com/northwind-labs/invest?src=linkedin");
  });
});
