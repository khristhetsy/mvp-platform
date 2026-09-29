import { describe, expect, it } from "vitest";
import { describeMatch, newRefs, renderMatchDigestEmail, type MatchDigestInput } from "@/lib/matching/match-digest-email";

const matches = [
  { investorType: "family_office", checkBand: "$250K to $1M", matchScore: 86, reasons: ["Sector match: robotics", "Stage match: seed", "Extra"] },
  { investorType: "angel", checkBand: null, matchScore: 71.4, reasons: [] },
];

const unlocked: MatchDigestInput = {
  firstName: "Jane",
  companyName: "Northstar Robotics",
  totalMatches: 14,
  newMatches: matches,
  firstEmail: false,
  gate: { unlocked: true, weekLeft: 5, monthLeft: 16 },
  matchesUrl: "https://icapos.com/founder/matches",
  ratingUrl: "https://icapos.com/founder/readiness/wizard",
};

describe("newRefs", () => {
  it("keeps only refs not already emailed, in order", () => {
    expect(newRefs(["a", "b", "c"], ["b"])).toEqual(["a", "c"]);
  });
});

describe("describeMatch", () => {
  it("names type and check, two reasons at most", () => {
    expect(describeMatch(matches[0]!)).toEqual({
      title: "Family Office · Check $250K to $1M",
      reasons: "Sector match: robotics · Stage match: seed",
    });
    expect(describeMatch(matches[1]!).title).toBe("Angel");
  });
});

describe("renderMatchDigestEmail", () => {
  it("through the gate: new count, fit, allowance", () => {
    const e = renderMatchDigestEmail(unlocked);
    expect(e.subject).toBe("Jane, 2 new investors matched Northstar Robotics this week");
    expect(e.text).toContain("Family Office · Check $250K to $1M (86% fit)");
    expect(e.text).toContain("Angel (71% fit)");
    expect(e.text).toContain("Introductions left: 5 this week, 16 this month");
    expect(e.html).toContain("See all 14 matches");
  });

  it("first email introduces matches rather than calling them new", () => {
    const e = renderMatchDigestEmail({ ...unlocked, firstEmail: true });
    expect(e.subject).toBe("Jane, 14 investors match Northstar Robotics");
    expect(e.text).toContain("Here are your strongest.");
  });

  it("below the gate: rating, threshold, open item, no investor list", () => {
    const e = renderMatchDigestEmail({
      ...unlocked,
      totalMatches: 12,
      gate: { unlocked: false, score: 62, threshold: 70, pointsToGate: 8, openItem: "Financials · No revenue figures" },
    });
    expect(e.subject).toBe("Jane, 12 investors match Northstar Robotics");
    expect(e.text).toContain("2 are new this week. Introductions open at a Capital Readiness Rating of 70. Yours is 62.");
    expect(e.text).toContain("Biggest open item: Financials · No revenue figures");
    expect(e.text).not.toContain("Family Office");
    expect(e.html).toContain("See the 8 points");
  });

  it("never includes a name or email for an investor", () => {
    const e = renderMatchDigestEmail(unlocked);
    expect(e.html).not.toMatch(/@/);
  });

  it("capitalises the subject when the founder has no name", () => {
    const e = renderMatchDigestEmail({ ...unlocked, firstName: null });
    expect(e.subject).toBe("2 new investors matched Northstar Robotics this week");
  });
});
