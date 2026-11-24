import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENDING,
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
    expect(slugifyCompany("Café Société, Inc.")).toBe("cafe-societe");
  });
  it.each([
    ["First Choice Bio, Inc.", "first-choice-bio"],
    ["First Choice Bio Inc", "first-choice-bio"],
    ["Acme LLC", "acme"],
    ["Acme, L.L.C.", "acme"],
    ["Acme Holdings Ltd.", "acme-holdings"],
    ["ACME CORP", "acme"],
    ["Acme Corp, Inc.", "acme"],
  ])("removes the legal suffix from %s", (name, slug) => {
    expect(slugifyCompany(name)).toBe(slug);
  });
  it("only removes whole words", () => {
    expect(slugifyCompany("Incline Corporate")).toBe("incline-corporate");
  });
  it("removes the suffix before trimming to length", () => {
    expect(slugifyCompany("a".repeat(36) + " Inc Bio")).toBe("a".repeat(36) + "-bio");
  });
  it("never returns an empty slug for a name of legal words", () => {
    expect(slugifyCompany("Corp, Inc.")).toBe("corp-inc");
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
  it("adds a number when the name without its suffix is taken, reserved or too short", () => {
    expect(uniqueCompanySlug("Northwind Labs, Inc.", new Set(["northwind-labs"]))).toBe("northwind-labs-2");
    expect(uniqueCompanySlug("Johnny, Inc.", new Set())).toBe("johnny-2");
    expect(uniqueCompanySlug("AB Inc", new Set())).toBe("ab-2");
  });
  it("never returns a reserved slug", () => {
    expect(isReservedSlug(uniqueCompanySlug("Fit", new Set()))).toBe(false);
    expect(uniqueCompanySlug("Johnny", new Set())).toBe("johnny-2");
  });
});

describe("urls", () => {
  it("builds the default address", () => {
    const slug = uniqueCompanySlug("First Choice Bio, Inc.", new Set());
    expect(agentUrl(slug, DEFAULT_ENDING)).toBe("https://icapos.com/first-choice-bio/agent");
    expect(validateEnding(DEFAULT_ENDING).ok).toBe(true);
  });
  it("still accepts and builds addresses saved under the old rule", () => {
    expect(validateCompanySlug("first-choice-bio-inc").ok).toBe(true);
    expect(validateEnding("invest").ok).toBe(true);
    expect(agentUrl("first-choice-bio-inc", "invest")).toBe("https://icapos.com/first-choice-bio-inc/invest");
  });
  it("builds the page address", () => {
    expect(agentPath("northwind-labs", "invest")).toBe("/northwind-labs/invest");
    expect(agentUrl("northwind-labs", "invest")).toBe("https://icapos.com/northwind-labs/invest");
  });
  it("builds tracked links", () => {
    expect(trackedUrl("northwind-labs", "invest", "linkedin")).toBe("https://icapos.com/northwind-labs/invest?src=linkedin");
  });
});
