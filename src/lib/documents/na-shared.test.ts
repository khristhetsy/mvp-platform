import { describe, it, expect } from "vitest";
import { NA_ALLOWED_TYPES, normalizeNaType, formatPt, naMarkedLine, naSummaryNote } from "./na-shared";

describe("N/A shared rules", () => {
  it("allows N/A on every required document type", () => {
    for (const code of ["PITCH_DECK", "FINANCIAL_MODEL", "CAP_TABLE", "BUSINESS_PLAN", "TEAM_BIOS", "LEGAL_DOCUMENTS", "CORPORATE_DOCUMENTS", "CUSTOMER_CONTRACTS", "MARKET_RESEARCH"]) {
      expect(NA_ALLOWED_TYPES.has(code)).toBe(true);
    }
  });

  it("normalizes UI and upload values to checklist codes", () => {
    expect(normalizeNaType("legal_document")).toBe("LEGAL_DOCUMENTS");
    expect(normalizeNaType("FINANCIALS")).toBe("FINANCIAL_MODEL");
    expect(normalizeNaType("FINANCIAL_STATEMENTS")).toBe("FINANCIAL_MODEL");
    expect(normalizeNaType("customer_contracts")).toBe("CUSTOMER_CONTRACTS");
  });

  it("formats times in Pacific time", () => {
    expect(formatPt("2026-10-08T22:12:00Z")).toBe("Oct 8, 2026 3:12 PM PT");
    expect(formatPt(null)).toBe("");
  });

  it("builds the marked line and the step note", () => {
    expect(naMarkedLine({ markedByName: "Jane Founder", markedAt: "2026-10-08T22:12:00Z" })).toBe("Marked N/A by Jane Founder · Oct 8, 2026 3:12 PM PT");
    expect(naMarkedLine({})).toBe("Marked N/A");
    expect(naSummaryNote([])).toBeUndefined();
    expect(naSummaryNote(["Customer contracts"])).toBe("1 item marked N/A: Customer contracts");
    expect(naSummaryNote(["A", "B"], "section")).toBe("2 sections marked N/A: A, B");
  });
});
