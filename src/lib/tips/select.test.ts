import { describe, it, expect } from "vitest";
import { selectTip, tipDateKey } from "./select";
import { TIPS } from "./library";

describe("selectTip", () => {
  it("returns a founder tip matching the current stage or a general one", () => {
    const tip = selectTip({ audience: "founder", founderStage: "qualify", dateKey: "2026-06-20" });
    expect(tip).not.toBeNull();
    expect(tip?.audience).toBe("founder");
    // either the qualify-specific tip or a general (no-stage) founder tip
    expect(tip?.founderStage === "qualify" || tip?.founderStage === undefined).toBe(true);
  });

  it("returns an investor tip matching the state or a general one", () => {
    const tip = selectTip({ audience: "investor", investorState: "low_responsiveness", dateKey: "2026-06-20" });
    expect(tip?.audience).toBe("investor");
    expect(tip?.investorState === "low_responsiveness" || tip?.investorState === undefined).toBe(true);
  });

  it("is deterministic for the same day and context", () => {
    const a = selectTip({ audience: "founder", founderStage: "deploy", dateKey: "2026-06-20" });
    const b = selectTip({ audience: "founder", founderStage: "deploy", dateKey: "2026-06-20" });
    expect(a?.id).toBe(b?.id);
  });

  it("never selects a tip from the other audience", () => {
    for (let d = 1; d <= 28; d += 1) {
      const tip = selectTip({
        audience: "investor",
        investorState: "new",
        dateKey: `2026-06-${String(d).padStart(2, "0")}`,
      });
      expect(tip?.audience).toBe("investor");
    }
  });

  it("rotates across the eligible pool over time", () => {
    const ids = new Set<string>();
    for (let d = 1; d <= 28; d += 1) {
      const tip = selectTip({
        audience: "founder",
        founderStage: "qualify",
        dateKey: `2026-06-${String(d).padStart(2, "0")}`,
      });
      if (tip) ids.add(tip.id);
    }
    // qualify pool = qualify-specific tip + general tip => both should appear
    expect(ids.size).toBeGreaterThan(1);
  });

  it("tipDateKey formats as YYYY-MM-DD", () => {
    expect(tipDateKey(new Date("2026-06-20T12:00:00Z"))).toBe("2026-06-20");
  });

  it("library has both founder and investor tips", () => {
    expect(TIPS.some((t) => t.audience === "founder")).toBe(true);
    expect(TIPS.some((t) => t.audience === "investor")).toBe(true);
  });
});
