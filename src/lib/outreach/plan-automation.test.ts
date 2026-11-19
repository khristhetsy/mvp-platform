import { describe, expect, it } from "vitest";
import { DEFAULT_AUTOMATION_CONFIG, type AutomationConfig } from "@/lib/settings/platform-settings";
import { planAutomationEnabled, planKey, planMinCrr, planMonthlyCap, planRunCap } from "@/lib/outreach/founder-overrides";

const cfg = (patch: Partial<AutomationConfig>): AutomationConfig => ({ ...DEFAULT_AUTOMATION_CONFIG, ...patch });

describe("per-plan automation settings", () => {
  it("maps each founder plan to its own column, with basic as the fallback", () => {
    expect(planKey("founder_premium")).toBe("premium");
    expect(planKey("founder_professional")).toBe("professional");
    expect(planKey("founder_basic")).toBe("basic");
    expect(planKey("founder_trial")).toBe("basic");
    expect(planKey(null)).toBe("basic");
  });

  it("gives Premium its own monthly cap instead of Professional's", () => {
    const c = cfg({ monthlyByPlan: { basic: 25, professional: 100, premium: 250 } });
    expect(planMonthlyCap("founder_premium", c)).toBe(250);
    expect(planMonthlyCap("founder_professional", c)).toBe(100);
    expect(planMonthlyCap("founder_basic", c)).toBe(25);
  });

  it("defaults leave every plan on, with no run cap and no readiness gate", () => {
    for (const plan of ["founder_basic", "founder_professional", "founder_premium"] as const) {
      expect(planAutomationEnabled(plan, DEFAULT_AUTOMATION_CONFIG)).toBe(true);
      expect(planRunCap(plan, DEFAULT_AUTOMATION_CONFIG)).toBe(0);
      expect(planMinCrr(plan, DEFAULT_AUTOMATION_CONFIG)).toBe(0);
    }
  });

  it("switches automation off for one plan without touching the others", () => {
    const c = cfg({ enabledByPlan: { basic: false, professional: true, premium: true } });
    expect(planAutomationEnabled("founder_basic", c)).toBe(false);
    expect(planAutomationEnabled("founder_professional", c)).toBe(true);
    expect(planAutomationEnabled("founder_premium", c)).toBe(true);
  });

  it("reads the per-plan run cap and minimum CRR", () => {
    const c = cfg({
      runCapByPlan: { basic: 5, professional: 15, premium: 40 },
      minCrrByPlan: { basic: 60, professional: 60, premium: 50 },
    });
    expect(planRunCap("founder_premium", c)).toBe(40);
    expect(planMinCrr("founder_premium", c)).toBe(50);
    expect(planRunCap("founder_basic", c)).toBe(5);
    expect(planMinCrr("founder_basic", c)).toBe(60);
  });
});
