import { describe, it, expect } from "vitest";
import { businessPlanCoreProgress, isSectionDone } from "./completion";
import { BUSINESS_PLAN_SECTIONS } from "./sections";
import type { BusinessPlan } from "./types";

type P = Pick<BusinessPlan, "sections" | "assumptions" | "projections">;
const core = BUSINESS_PLAN_SECTIONS.filter((s) => s.core);
const written = (ids: string[]): BusinessPlan["sections"] =>
  Object.fromEntries(ids.map((id) => [id, { content: "text", aiGenerated: false }]));

describe("business plan completion", () => {
  const allButProjections = core.map((s) => s.id).filter((id) => id !== "projections");

  it("counts projections done once assumptions are saved (no section text needed)", () => {
    const plan: P = { sections: written(allButProjections), assumptions: { startingCustomers: 1 } as P["assumptions"], projections: null };
    expect(isSectionDone(plan, "projections")).toBe(true);
    expect(businessPlanCoreProgress(plan, BUSINESS_PLAN_SECTIONS).percent).toBe(100);
  });

  it("is 10 of 11 when projections have no assumptions and are not N/A", () => {
    const plan: P = { sections: written(allButProjections), assumptions: {}, projections: null };
    const p = businessPlanCoreProgress(plan, BUSINESS_PLAN_SECTIONS);
    expect(p.done).toBe(core.length - 1);
  });

  it("counts an N/A section as done and names it", () => {
    const sections = written(allButProjections.filter((id) => id !== "traction"));
    sections.traction = { content: "", aiGenerated: false, notApplicable: { note: "pre launch", at: "2026-10-08T00:00:00Z" } };
    const plan: P = { sections, assumptions: { startingCustomers: 1 } as P["assumptions"], projections: null };
    const p = businessPlanCoreProgress(plan, BUSINESS_PLAN_SECTIONS);
    expect(p.percent).toBe(100);
    expect(p.naTitles).toEqual(["Traction & milestones"]);
  });

  it("is 0 with no plan", () => {
    expect(businessPlanCoreProgress(null, BUSINESS_PLAN_SECTIONS).percent).toBe(0);
  });
});
