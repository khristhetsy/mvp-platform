import { describe, expect, it } from "vitest";
import { introOutcomeCopy, renderIntroOutcomeEmail } from "@/lib/matching/intro-outcome-email";

const base = {
  firstName: "Jane",
  companyName: "Northstar Robotics",
  investorLabel: "Family Office",
  note: null,
  matchesUrl: "https://icapos.com/founder/matches",
};

describe("intro outcome copy", () => {
  it("facilitated names the company and investor type", () => {
    const c = introOutcomeCopy({ ...base, outcome: "facilitated" });
    expect(c.title).toBe("Your introduction is set up");
    expect(c.message).toContain("introduced Northstar Robotics to the family office");
  });
  it("declined points to another match without promising a refund of the request", () => {
    const c = introOutcomeCopy({ ...base, outcome: "declined" });
    expect(c.message).toContain("did not make this introduction");
    expect(c.message).not.toMatch(/count/i);
  });
  it("email carries the staff note, escaped", () => {
    const e = renderIntroOutcomeEmail({ ...base, outcome: "contacted", note: "<b>Warm lead</b>" });
    expect(e.subject).toBe("iCFO reached out for you · Northstar Robotics");
    expect(e.text).toContain("Note from iCFO: <b>Warm lead</b>");
    expect(e.html).toContain("&lt;b&gt;Warm lead&lt;/b&gt;");
  });
});
