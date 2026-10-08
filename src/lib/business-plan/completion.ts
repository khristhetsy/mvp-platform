// How complete is a business plan? Pure; used by the stage guide.
// A core section is done when it has text, when it is marked N/A (N/A counts as
// done), or, for Financial projections, when the driver assumptions are saved.
// Projections never store section text: the editor builds them from assumptions.

import type { BusinessPlan } from "./types";

export const PROJECTIONS_SECTION_ID = "projections";

type SectionDef = { id: string; title: string; core: boolean };

export function isSectionNa(plan: Pick<BusinessPlan, "sections"> | null, id: string): boolean {
  return Boolean(plan?.sections?.[id]?.notApplicable);
}

export function isSectionDone(
  plan: Pick<BusinessPlan, "sections" | "assumptions" | "projections"> | null,
  id: string,
): boolean {
  if (!plan) return false;
  if (isSectionNa(plan, id)) return true;
  if (id === PROJECTIONS_SECTION_ID) {
    return plan.projections != null || Object.keys(plan.assumptions ?? {}).length > 0;
  }
  return String(plan.sections?.[id]?.content ?? "").trim().length > 0;
}

export function businessPlanCoreProgress(
  plan: Pick<BusinessPlan, "sections" | "assumptions" | "projections"> | null,
  defs: readonly SectionDef[],
): { percent: number; done: number; total: number; naTitles: string[] } {
  const core = defs.filter((s) => s.core);
  const done = core.filter((s) => isSectionDone(plan, s.id)).length;
  const naTitles = core.filter((s) => isSectionNa(plan, s.id)).map((s) => s.title);
  return {
    percent: core.length ? (done / core.length) * 100 : 0,
    done,
    total: core.length,
    naTitles,
  };
}
