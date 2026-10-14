import { describe, it, expect } from "vitest";
import { glanceVars, glanceFields, fillGlance, type GlanceSource } from "./company-glance";

const src: GlanceSource = {
  readiness: { latestScore: 84, onboardingPercent: 50, milestoneLabel: "Investor Ready Level 2", remediation: { active: 3, completed: 18, total: 21, highPriorityOpen: 2 } },
  investable: { totalScore: 89, effectiveScore: null },
  investorActivity: { interests: 0, introRequests: 0 },
  compliance: { openCount: 0, totalCount: 0, criticalCount: 0 },
};

describe("company glance", () => {
  it("matches the numbers on the company page", () => {
    const v = glanceVars(src);
    expect(v.prep_score).toBe("84");
    expect(v.prep_onboarding).toBe("50%");
    expect(v.crr_score).toBe("89/100");
    expect(v.crr_status).toBe("Outreach gate cleared");
    expect(v.remediation_open).toBe("3");
    expect(v.remediation_detail).toBe("18 closed of 21");
    expect(v.remediation_priority).toBe("2 high priority items still open");
    expect(v.investor_status).toBe("No investor has seen this company yet");
    expect(v.compliance_detail).toBe("0 resolved of 0");
    expect(v.compliance_status).toBe("Nothing outstanding");
  });

  it("uses the admin override and shows the distance to the gate", () => {
    const v = glanceVars({ ...src, investable: { totalScore: 80, effectiveScore: 60 } });
    expect(v.crr_score).toBe("60/100");
    expect(v.crr_status).toBe("5 points to the 65 outreach gate");
  });

  it("says so when the engine has not scored the company", () => {
    const v = glanceVars({ ...src, investable: null, readiness: { ...src.readiness, latestScore: null } });
    expect(v.crr_score).toBe("Not yet scored");
    expect(v.prep_score).toBe("Not yet run");
  });

  it("panel rows insert merge tags and show this founder's text", () => {
    const rows = glanceFields(src);
    expect(rows.map((r) => r.label)).toEqual(["Preparation complete", "Capital Readiness Rating", "Open remediation", "Investor interests", "Open compliance"]);
    expect(rows[1].value).toContain("{{crr_score}}");
    expect(rows[1].shown).toContain("89/100");
  });

  it("leaves unknown tags as written", () => {
    expect(fillGlance("{{crr_score}} {{first_name}}", glanceVars(src))).toBe("89/100 {{first_name}}");
  });
});
