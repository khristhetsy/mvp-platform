import { describe, it, expect } from "vitest";
import { matchingSummary } from "@/lib/matching/matching-summary";

describe("matching pass summary", () => {
  it("says why nothing matched", () => {
    expect(matchingSummary({ companiesEligible: 0, investorsConsidered: 0, suggestedWritten: 0 })).toBe("0 matches: no company at CRR 60 or above");
    expect(matchingSummary({ companiesEligible: 2, investorsConsidered: 0, suggestedWritten: 0 })).toBe("0 matches: no approved investors");
    expect(matchingSummary({ companiesEligible: 2, investorsConsidered: 4, suggestedWritten: 0 })).toBe("0 new matches from 2 companies and 4 investors");
  });
  it("names the threshold in use", () => {
    expect(matchingSummary({ companiesEligible: 0, investorsConsidered: 0, suggestedWritten: 0 }, 50)).toBe("0 matches: no company at CRR 50 or above");
  });
  it("counts new matches", () => {
    expect(matchingSummary({ companiesEligible: 2, investorsConsidered: 4, suggestedWritten: 1 })).toBe("1 new match");
    expect(matchingSummary({ companiesEligible: 2, investorsConsidered: 4, suggestedWritten: 3 })).toBe("3 new matches");
  });
});
