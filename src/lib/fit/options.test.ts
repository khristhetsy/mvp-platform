import { describe, it, expect } from "vitest";
import { canonicalInvestorType, INVESTOR_TYPE_VOCAB, Q5_INVESTOR_TYPE, investorTypeStoredFor } from "./options";

describe("canonicalInvestorType", () => {
  it("maps common spellings onto one canonical value", () => {
    expect(canonicalInvestorType("Angel Investor")).toBe("Angel");
    expect(canonicalInvestorType("angel")).toBe("Angel");
    expect(canonicalInvestorType("Venture Capital")).toBe("VC");
    expect(canonicalInvestorType("VC")).toBe("VC");
    expect(canonicalInvestorType("Ventures")).toBe("VC");
    expect(canonicalInvestorType("Private Equity")).toBe("Private Equity");
    expect(canonicalInvestorType("PE")).toBe("Private Equity");
    expect(canonicalInvestorType("Family Office")).toBe("Family Office");
    expect(canonicalInvestorType("Accelerator")).toBe("Accelerator");
  });
  it("folds the dead 'Corporate VC' spelling onto one the matcher knows", () => {
    // This was the bug: 'Corporate VC' is not in Q5_INVESTOR_TYPE.stored, so a contact
    // stamped with it could never match a founder who picked "Corporate / Strategic".
    expect(canonicalInvestorType("Corporate VC")).toBe("Corporate Venture");
    expect(canonicalInvestorType("CVC")).toBe("Corporate Venture");
    expect(canonicalInvestorType("Strategic")).toBe("Corporate Venture");
    expect(canonicalInvestorType("Corporate")).toBe("Corporate Venture");
  });
  it("prefers the more specific type", () => {
    expect(canonicalInvestorType("Corporate Venture Capital")).toBe("Corporate Venture");
    expect(canonicalInvestorType("Family Office / Angel")).toBe("Family Office");
  });
  it("returns null for empty or unrecognised input", () => {
    expect(canonicalInvestorType(null)).toBeNull();
    expect(canonicalInvestorType("")).toBeNull();
    expect(canonicalInvestorType("   ")).toBeNull();
    expect(canonicalInvestorType("Hedge Fund")).toBeNull();
    expect(canonicalInvestorType("Los Angeles Holdings")).toBeNull();
  });
  it("is idempotent — a canonical value maps to itself", () => {
    for (const t of INVESTOR_TYPE_VOCAB) expect(canonicalInvestorType(t)).toBe(t);
  });
  it("every canonical value except Accelerator is matchable on /fit", () => {
    // Accelerator is real information but /fit doesn't offer it, so it scores nothing.
    const matchable = new Set(Q5_INVESTOR_TYPE.flatMap((o) => o.stored));
    for (const t of INVESTOR_TYPE_VOCAB) {
      if (t === "Accelerator") continue;
      expect(matchable, `"${t}" is not in Q5_INVESTOR_TYPE.stored`).toContain(t);
    }
  });
  it("a founder picking a type matches contacts stamped with the canonical value", () => {
    const lc = (xs: string[]) => xs.map((s) => s.toLowerCase());
    for (const [key, canonical] of [["angel", "Angel"], ["vc", "VC"], ["pe", "Private Equity"], ["family_office", "Family Office"], ["corporate", "Corporate Venture"]] as const) {
      expect(lc(investorTypeStoredFor([key]))).toContain(canonical.toLowerCase());
    }
  });
});
