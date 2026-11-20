import { describe, expect, it } from "vitest";
import { buildPlanLimitRows, formatPolicyDate, SUPPORT_POLICY_HOURS, SUPPORT_POLICY_REPLY_PHRASE } from "./policy";
import { DEFAULT_FOUNDER_CONNECTION_CONFIG } from "@/lib/settings/platform-settings";

describe("support policy", () => {
  it("states the published reply promise and hours", () => {
    expect(SUPPORT_POLICY_REPLY_PHRASE).toBe("within 2 business days");
    expect(SUPPORT_POLICY_HOURS).toBe("9:00 to 18:00 Pacific");
  });

  it("formats the version date without timezone drift", () => {
    expect(formatPolicyDate("2026-11-20")).toBe("November 20, 2026");
  });

  it("builds plan limit rows from the live caps", () => {
    const rows = buildPlanLimitRows({
      monthlyByPlan: { basic: 5, professional: 20 },
      weeklyByPlan: { basic: 1, professional: 5 },
    });
    expect(rows.map((r) => r.plan)).toEqual(["Free", "Basic", "Professional", "Premium"]);
    expect(rows[0]).toMatchObject({ matchedInvestors: "Not included", introRequests: "Not included" });
    expect(rows[1]).toMatchObject({ matchedInvestors: "Up to 5", introRequests: "Up to 5 per 30 days, and 1 per week" });
    expect(rows[2]).toMatchObject({ matchedInvestors: "Up to 50", introRequests: "Up to 20 per 30 days, and 5 per week" });
    // Premium holds Professional's limits.
    expect(rows[3]).toMatchObject({ matchedInvestors: rows[2].matchedInvestors, introRequests: rows[2].introRequests });
  });

  it("leaves out the weekly cap when a plan has none", () => {
    const rows = buildPlanLimitRows({
      monthlyByPlan: { basic: 5, professional: 20 },
      weeklyByPlan: { basic: null, professional: null },
    });
    expect(rows[1].introRequests).toBe("Up to 5 per 30 days");
  });

  it("works with the default connection config", () => {
    const rows = buildPlanLimitRows(DEFAULT_FOUNDER_CONNECTION_CONFIG);
    expect(rows[2].introRequests).toBe("Up to 20 per 30 days, and 5 per week");
  });
});
