import { describe, it, expect } from "vitest";
import { findProhibitedTerms, findProhibitedTermsInFields } from "./prohibited-terms";
import { validateListing, type ListingInput } from "./validation";

describe("findProhibitedTerms", () => {
  it("catches plain performance and risk claims", () => {
    expect(findProhibitedTerms("Guaranteed returns of 20%")).not.toHaveLength(0);
    expect(findProhibitedTerms("A safe investment with no risk")).not.toHaveLength(0);
  });

  it("catches spacing used to break up a phrase", () => {
    // "20 % return" previously passed — the space defeated the substring match.
    expect(findProhibitedTerms("Target 20 % return")).toContain("% return");
  });

  it("catches hyphen and punctuation evasion", () => {
    expect(findProhibitedTerms("This is risk-free")).not.toHaveLength(0);
    expect(findProhibitedTerms("A s.a.f.e investment")).not.toHaveLength(0);
  });

  it("catches common misspellings of guaranteed", () => {
    for (const variant of ["guarunteed", "gauranteed", "guarenteed", "guarantee"]) {
      expect(findProhibitedTerms(`This is ${variant}`)).not.toHaveLength(0);
    }
  });

  it("is case insensitive", () => {
    expect(findProhibitedTerms("GUARANTEED")).not.toHaveLength(0);
  });

  it("leaves ordinary factual copy alone", () => {
    expect(findProhibitedTerms("Series A round for a logistics company in Texas")).toHaveLength(0);
    expect(findProhibitedTerms("Common stock offering under Regulation CF")).toHaveLength(0);
    // Must not fire on innocuous words that merely contain a term as a substring.
    expect(findProhibitedTerms("We assure quality control")).toHaveLength(0);
  });
});

describe("findProhibitedTermsInFields", () => {
  it("reports which field carried the claim", () => {
    const hits = findProhibitedTermsInFields({
      companyName: "Acme Logistics",
      securityType: "Guaranteed 20% Return Notes",
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].field).toBe("securityType");
  });

  it("skips empty and missing values", () => {
    expect(findProhibitedTermsInFields({ a: "", b: null, c: undefined })).toHaveLength(0);
  });
});

describe("validateListing — field coverage", () => {
  const base: ListingInput = {
    companyName: "Acme Logistics",
    briefDescription: "Regional freight brokerage raising under Regulation CF.",
    industry: "",
    location: "",
    securityType: "",
    offeringAmountMin: null,
    offeringAmountMax: null,
    portalName: "Example Portal",
    portalUrl: "https://example.com/acme",
  };

  it("accepts a clean tombstone", () => {
    expect(validateListing(base).ok).toBe(true);
  });

  it("rejects a prohibited claim in securityType, which was previously unchecked", () => {
    const result = validateListing({ ...base, securityType: "Guaranteed 20% Return Notes" });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("Security type");
  });

  it("rejects a prohibited claim in companyName", () => {
    const result = validateListing({ ...base, companyName: "No Risk Capital Partners" });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("Company name");
  });

  it("still rejects a prohibited claim in the description", () => {
    const result = validateListing({ ...base, briefDescription: "A safe investment that can't lose value." });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("Description");
  });

  it("reports every offending field, not just the first", () => {
    const result = validateListing({
      ...base,
      companyName: "Guaranteed Capital",
      securityType: "No Risk Notes",
    });
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
