import { describe, it, expect } from "vitest";
import type { MarketplaceListing } from "@/lib/data/marketplace";
import { tickerSymbol, toLiveBoardRow } from "./live-board";

function listing(over: Partial<MarketplaceListing> = {}): MarketplaceListing {
  return {
    id: "c1",
    slug: "foxeyes-vision-ai",
    companyName: "FoxEyes Vision AI",
    founderId: "f1",
    industry: "AI",
    stage: "Seed",
    location: "San Diego, CA",
    country: null,
    incorporationJurisdiction: null,
    shortSummary: "Vision models for retail.",
    fundingTarget: "$2.5M",
    minimumInvestment: "$5K",
    useOfFunds: null,
    overview: "Longer overview.",
    problem: null,
    solution: null,
    marketOpportunity: null,
    traction: null,
    team: null,
    riskDisclosures: null,
    diligenceSummary: null,
    publishedAt: "2026-11-01T00:00:00Z",
    capitalReadyAt: null,
    ...over,
  };
}

describe("tickerSymbol", () => {
  it("keeps letters and digits, upper case, six at most", () => {
    expect(tickerSymbol("FoxEyes Vision AI")).toBe("FOXEYE");
    expect(tickerSymbol("A.B")).toBe("AB");
  });
  it("falls back when nothing usable is left", () => {
    expect(tickerSymbol("!!!")).toBe("DEAL");
  });
});

describe("toLiveBoardRow", () => {
  it("maps public fields only", () => {
    const row = toLiveBoardRow(listing());
    expect(row).toEqual({
      slug: "foxeyes-vision-ai",
      symbol: "FOXEYE",
      name: "FoxEyes Vision AI",
      industry: "AI",
      stage: "Seed",
      location: "San Diego, CA",
      summary: "Vision models for retail.",
      target: "$2.5M",
      minimum: "$5K",
      capitalReady: false,
    });
  });
  it("treats placeholder dashes and blanks as missing", () => {
    const row = toLiveBoardRow(listing({ stage: "—", location: "  ", fundingTarget: "-" }));
    expect(row.stage).toBeNull();
    expect(row.location).toBeNull();
    expect(row.target).toBeNull();
  });
  it("falls back to the overview when there is no short summary", () => {
    expect(toLiveBoardRow(listing({ shortSummary: null })).summary).toBe("Longer overview.");
  });
  it("marks Capital Ready from the completion date", () => {
    expect(toLiveBoardRow(listing({ capitalReadyAt: "2026-10-01T00:00:00Z" })).capitalReady).toBe(true);
  });
});
