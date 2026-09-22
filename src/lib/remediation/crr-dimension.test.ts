/**
 * A task and the points it earns, in the same place.
 */
import { describe, it, expect } from "vitest";
import { countByDimension, dimensionForCategory } from "@/lib/remediation/crr-dimension";

describe("tagging a task with its dimension", () => {
  it("sends profile and materials work to the narrative", () => {
    expect(dimensionForCategory("company_profile")?.label).toBe("Narrative");
    expect(dimensionForCategory("investor_materials")?.label).toBe("Narrative");
    expect(dimensionForCategory("documents")?.label).toBe("Narrative");
  });

  it("sends money to financial and customers to traction", () => {
    expect(dimensionForCategory("financials")?.label).toBe("Financial");
    expect(dimensionForCategory("market")?.label).toBe("Traction");
  });

  it("sends governance and compliance to the cap table, where the engine puts them", () => {
    expect(dimensionForCategory("governance")?.label).toBe("Cap table");
    expect(dimensionForCategory("compliance")?.label).toBe("Cap table");
  });

  it("leaves the catch-all bucket untagged rather than guessing", () => {
    expect(dimensionForCategory("readiness")).toBeNull();
  });
});

describe("counting the plan by dimension", () => {
  it("groups and ranks", () => {
    expect(countByDimension(["governance", "compliance", "financials", "market", "readiness"]))
      .toEqual([
        { label: "Cap table", count: 2 },
        { label: "Financial", count: 1 },
        { label: "Traction", count: 1 },
      ]);
  });

  it("drops the untagged ones from the counts", () => {
    expect(countByDimension(["readiness", "readiness"])).toEqual([]);
  });

  it("copes with an empty plan", () => {
    expect(countByDimension([])).toEqual([]);
  });
});
