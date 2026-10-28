import { describe, expect, it } from "vitest";
import { stageMenuDocSignals } from "@/lib/admin/stage-menu-signals";

const doc = (document_type: string, status = "uploaded") => ({ document_type, status });

describe("stageMenuDocSignals", () => {
  it("reads current uploads", () => {
    const s = stageMenuDocSignals([doc("PITCH_DECK"), doc("CAP_TABLE"), doc("FINANCIAL_STATEMENTS"), doc("BUSINESS_PLAN")], false);
    expect(s).toEqual({ hasBusinessPlan: true, hasPitchDeck: true, hasCapTable: true, hasFinancialModel: true });
  });

  it("ignores archived files", () => {
    const s = stageMenuDocSignals([doc("PITCH_DECK", "archived"), doc("CAP_TABLE", "archived")], false);
    expect(s.hasPitchDeck).toBe(false);
    expect(s.hasCapTable).toBe(false);
  });

  it("counts a finalized in-platform plan as the business plan", () => {
    expect(stageMenuDocSignals([], true).hasBusinessPlan).toBe(true);
    expect(stageMenuDocSignals([], false).hasBusinessPlan).toBe(false);
  });

  it("accepts the legacy financials type for the Financial model row", () => {
    expect(stageMenuDocSignals([doc("FINANCIALS")], false).hasFinancialModel).toBe(true);
  });
});
