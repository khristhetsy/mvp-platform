import { describe, it, expect } from "vitest";
import {
  formatSpvCurrency,
  getSpvParticipationTotals,
  computeChecklistReadinessPct,
  areRequiredChecklistItemsComplete,
  summarizeChecklistByCategory,
  investorPreparationLabel,
} from "./display";
import type {
  SpvChecklistItemRecord,
  SpvChecklistItemStatus,
  SpvParticipationRecord,
  SpvParticipationStatus,
} from "./types";

function participation(
  status: SpvParticipationStatus,
  indicative_amount: number | null,
): SpvParticipationRecord {
  return {
    id: `p-${Math.random()}`,
    spv_opportunity_id: "spv1",
    investor_id: "inv1",
    company_id: "co1",
    indicative_amount,
    status,
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function item(status: SpvChecklistItemStatus, required: boolean): SpvChecklistItemRecord {
  return {
    id: `i-${Math.random()}`,
    spv_opportunity_id: "spv1",
    item_key: "k",
    title: "t",
    description: null,
    category: "compliance",
    status,
    required,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  } as SpvChecklistItemRecord;
}

describe("getSpvParticipationTotals — money arithmetic", () => {
  it("sums indicative amounts across active participations only", () => {
    const totals = getSpvParticipationTotals([
      participation("soft_committed", 100_000),
      participation("interested", 50_000),
      participation("completed", 25_000),
    ]);
    expect(totals.indicativeTotal).toBe(175_000);
    expect(totals.participantCount).toBe(3);
  });

  it("excludes declined and canceled participations from the total and the count", () => {
    // A withdrawn commitment must not inflate the raise total shown to anyone.
    const totals = getSpvParticipationTotals([
      participation("soft_committed", 100_000),
      participation("declined", 999_999),
      participation("canceled", 999_999),
    ]);
    expect(totals.indicativeTotal).toBe(100_000);
    expect(totals.participantCount).toBe(1);
  });

  it("treats a null indicative amount as zero, not NaN", () => {
    const totals = getSpvParticipationTotals([
      participation("soft_committed", null),
      participation("interested", 40_000),
    ]);
    expect(totals.indicativeTotal).toBe(40_000);
  });

  it("counts soft-committed participations separately", () => {
    const totals = getSpvParticipationTotals([
      participation("soft_committed", 10_000),
      participation("soft_committed", 20_000),
      participation("interested", 5_000),
    ]);
    expect(totals.softCommittedCount).toBe(2);
  });

  it("is zero across the board for an empty list", () => {
    expect(getSpvParticipationTotals([])).toEqual({
      participantCount: 0,
      indicativeTotal: 0,
      softCommittedCount: 0,
    });
  });
});

describe("areRequiredChecklistItemsComplete — the SPV close gate", () => {
  it("blocks close while any required item is still pending", () => {
    expect(areRequiredChecklistItemsComplete([item("completed", true), item("pending", true)])).toBe(false);
  });

  it("allows close when every required item is completed or waived", () => {
    expect(areRequiredChecklistItemsComplete([item("completed", true), item("waived", true)])).toBe(true);
  });

  it("ignores optional items — a pending optional item does not block close", () => {
    expect(areRequiredChecklistItemsComplete([item("completed", true), item("pending", false)])).toBe(true);
  });

  it("treats an in_progress required item as incomplete", () => {
    expect(areRequiredChecklistItemsComplete([item("in_progress", true)])).toBe(false);
  });

  it("returns true when there are no required items", () => {
    expect(areRequiredChecklistItemsComplete([item("pending", false)])).toBe(true);
    expect(areRequiredChecklistItemsComplete([])).toBe(true);
  });
});

describe("computeChecklistReadinessPct", () => {
  it("is 0 for an empty checklist", () => {
    expect(computeChecklistReadinessPct([])).toBe(0);
  });

  it("counts completed and waived as done and rounds", () => {
    // 2 of 3 done → 67%.
    expect(computeChecklistReadinessPct([item("completed", true), item("waived", false), item("pending", true)])).toBe(67);
  });

  it("is 100 when everything is done", () => {
    expect(computeChecklistReadinessPct([item("completed", true), item("waived", true)])).toBe(100);
  });
});

describe("summarizeChecklistByCategory", () => {
  it("tallies total and completed per category", () => {
    const rows = summarizeChecklistByCategory([
      { ...item("completed", true), category: "banking" },
      { ...item("pending", true), category: "banking" },
      { ...item("waived", true), category: "tax" },
    ]);
    const banking = rows.find((r) => r.category === "banking");
    const tax = rows.find((r) => r.category === "tax");
    expect(banking).toMatchObject({ total: 2, completed: 1 });
    expect(tax).toMatchObject({ total: 1, completed: 1 });
  });
});

describe("formatSpvCurrency", () => {
  it("formats whole-dollar USD", () => {
    expect(formatSpvCurrency(1_500_000)).toBe("$1,500,000");
  });
  it("renders an em dash for null or NaN", () => {
    expect(formatSpvCurrency(null)).toBe("—");
    expect(formatSpvCurrency(undefined)).toBe("—");
  });
});

describe("investorPreparationLabel", () => {
  it("is operational once documents are ready or readiness hits 100", () => {
    expect(investorPreparationLabel(100, null)).toBe("Document-ready (operational)");
    expect(investorPreparationLabel(0, "2026-01-01T00:00:00.000Z")).toBe("Document-ready (operational)");
  });
  it("is in preparation for partial progress", () => {
    expect(investorPreparationLabel(40, null)).toBe("In preparation");
  });
  it("is pending at zero", () => {
    expect(investorPreparationLabel(0, null)).toBe("Preparation pending");
    expect(investorPreparationLabel(null, null)).toBe("Preparation pending");
  });
});
