import { describe, it, expect } from "vitest";
import { normalizeFirm } from "@/lib/formd/normalize-firm";

describe("normalizeFirm (§5)", () => {
  it("strips entity suffix, fund-role words, and roman numerals to a stem", () => {
    expect(normalizeFirm("Acme Ventures Fund II, LP").firmStem).toBe("acme");
  });

  it("rolls a firm's vehicles to one stem (acceptance test 2)", () => {
    const a = normalizeFirm("Acme Ventures Fund II, LP").firmStem;
    const b = normalizeFirm("Acme Ventures Fund III LLC").firmStem;
    expect(a).toBe(b);
    expect(a).toBe("acme");
  });

  it("keeps target-named SPVs as a distinct stem (they shouldn't roll up)", () => {
    expect(normalizeFirm("Project Falcon SPV LLC").firmStem).toBe("project falcon");
    expect(normalizeFirm("Project Falcon SPV LLC").firmStem).not.toBe("acme");
  });

  it("strips a trailing four-digit year", () => {
    expect(normalizeFirm("Horizon 2021 Fund LP").firmStem).toBe("horizon");
  });

  it("strips vehicle words like Feeder", () => {
    expect(normalizeFirm("Blue Feeder Fund LP").firmStem).toBe("blue");
  });

  it("normalizes dotted abbreviations (L.P.)", () => {
    expect(normalizeFirm("Redpoint L.P.").firmStem).toBe("redpoint");
  });

  it("strips the 'Capital Partners' phrase as a unit", () => {
    expect(normalizeFirm("Meridian Capital Partners LP").firmStem).toBe("meridian");
  });

  it("falls back to the raw name and flags review when the stem < 3 chars (acceptance test 3)", () => {
    const r = normalizeFirm("XY Capital Partners LP");
    expect(r.needsReview).toBe(true);
    expect(r.firmStem).toContain("xy");
  });

  it("empty name is flagged for review", () => {
    expect(normalizeFirm("").needsReview).toBe(true);
  });

  it("collapses 'a Series of' vehicles to the master fund", () => {
    expect(normalizeFirm("Equitybee 22-41600, a Series of Equitybee cFund Master LLC").firmStem).toBe("equitybee cfund");
    expect(normalizeFirm("AR-0708 Fund I, a series of MV Funds, LP").firmStem).toBe("mv funds");
  });

  it("strips trailing regional/vehicle words like International + Master", () => {
    expect(normalizeFirm("Bridge Debt Strategies Fund VI International Master LP").firmStem).toBe("bridge debt strategies");
  });

  it("strips trailing alphanumeric code fragments", () => {
    expect(normalizeFirm("Horizon 706 LP").firmStem).toBe("horizon");
  });
});
