import { describe, it, expect } from "vitest";
import {
  QUALIFY_REQUIRED_DOCUMENTS,
  isQualifyDocSatisfied,
  allQualifyDocsUploaded,
} from "./documents";

const pitchDeck = QUALIFY_REQUIRED_DOCUMENTS.find((d) => d.code === "PITCH_DECK")!;
const financials = QUALIFY_REQUIRED_DOCUMENTS.find((d) => d.code === "FINANCIAL_STATEMENTS")!;
const capTable = QUALIFY_REQUIRED_DOCUMENTS.find((d) => d.code === "CAP_TABLE")!;

describe("isQualifyDocSatisfied", () => {
  it("matches the canonical uppercase code uploads actually store", () => {
    expect(isQualifyDocSatisfied(["PITCH_DECK"], pitchDeck)).toBe(true);
    expect(isQualifyDocSatisfied(["CAP_TABLE"], capTable)).toBe(true);
  });

  it("matches case-insensitively (legacy lowercase rows still count)", () => {
    expect(isQualifyDocSatisfied(["pitch_deck"], pitchDeck)).toBe(true);
    expect(isQualifyDocSatisfied(["cap_table"], capTable)).toBe(true);
  });

  it("treats the FINANCIALS alias as financial statements", () => {
    expect(isQualifyDocSatisfied(["FINANCIAL_STATEMENTS"], financials)).toBe(true);
    expect(isQualifyDocSatisfied(["financials"], financials)).toBe(true);
    expect(isQualifyDocSatisfied(["FINANCIALS"], financials)).toBe(true);
  });

  it("ignores null/undefined and unrelated types", () => {
    expect(isQualifyDocSatisfied([null, undefined, "OTHER"], pitchDeck)).toBe(false);
    expect(isQualifyDocSatisfied([], capTable)).toBe(false);
  });
});

describe("allQualifyDocsUploaded", () => {
  it("is true only when all three required docs are present", () => {
    expect(
      allQualifyDocsUploaded(["PITCH_DECK", "FINANCIAL_STATEMENTS", "CAP_TABLE"]),
    ).toBe(true);
  });

  it("accepts mixed-case and alias codes", () => {
    expect(allQualifyDocsUploaded(["pitch_deck", "financials", "CAP_TABLE"])).toBe(true);
  });

  it("is false when any required doc is missing", () => {
    expect(allQualifyDocsUploaded(["PITCH_DECK", "CAP_TABLE"])).toBe(false);
    expect(allQualifyDocsUploaded([])).toBe(false);
  });

  it("regression: the old lowercase-only codes no longer silently fail real uploads", () => {
    // Uploads store FINANCIAL_STATEMENTS (not 'financials'); this must still pass.
    expect(
      allQualifyDocsUploaded(["PITCH_DECK", "FINANCIAL_STATEMENTS", "CAP_TABLE", "MARKET_RESEARCH"]),
    ).toBe(true);
  });
});
