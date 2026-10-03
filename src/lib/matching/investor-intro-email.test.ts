import { describe, expect, it } from "vitest";
import { describeCompany, formatRaise, renderInvestorIntroEmail } from "@/lib/matching/investor-intro-email";

const base = {
  firstName: "Tarra",
  companyName: "Acme Robotics",
  industry: "Robotics",
  fundingStage: "Series A",
  raising: "$3M",
  alignedOn: ["industry", "stage"],
  note: "Strong ARR growth this year.",
  dashboardUrl: "https://icapos.com/investor/dashboard",
};

describe("investor intro email", () => {
  it("formats the raise from the band first, then the amount", () => {
    expect(formatRaise(3_000_000, null)).toBe("$3M");
    expect(formatRaise(2_500_000, null)).toBe("$2.5M");
    expect(formatRaise(750_000, null)).toBe("$750K");
    expect(formatRaise(3_000_000, "$1M to $5M")).toBe("$1M to $5M");
    expect(formatRaise(null, null)).toBeNull();
  });

  it("describes only what is known", () => {
    expect(describeCompany(base)).toBe("Acme Robotics, a Series A Robotics company raising $3M");
    expect(describeCompany({ ...base, industry: null, fundingStage: null, raising: null })).toBe("Acme Robotics, a company");
  });

  it("states the fit in words and carries the iCFO note", () => {
    const out = renderInvestorIntroEmail(base);
    expect(out.subject).toBe("Introduction from iCFO · Acme Robotics");
    expect(out.text).toContain("They match your focus on industry and stage.");
    expect(out.text).toContain("Note from iCFO: Strong ARR growth this year.");
    expect(out.text).not.toMatch(/%/);
  });

  it("leaves the fit sentence out when nothing is known to align", () => {
    const out = renderInvestorIntroEmail({ ...base, alignedOn: [], note: null });
    expect(out.text).not.toContain("match your focus");
    expect(out.text).not.toContain("Note from iCFO");
  });
});
