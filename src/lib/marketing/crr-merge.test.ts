import { describe, expect, it } from "vitest";
import { computeCrrChange, usesCrrTokens } from "./crr-merge";
import { interpolate } from "./send";

const row = (company_id: string, effective_score: number | null, created_at: string) => ({ company_id, effective_score, created_at });

describe("usesCrrTokens", () => {
  it("detects the tokens in any brace or case form", () => {
    expect(usesCrrTokens("went from {{starting_crr}}")).toBe(true);
    expect(usesCrrTokens(null, "to {Current CRR}")).toBe(true);
    expect(usesCrrTokens("Hi {{first_name}}", undefined)).toBe(false);
  });
});

describe("computeCrrChange", () => {
  it("uses the first and latest score of the most recently scored company", () => {
    const out = computeCrrChange([
      row("a", 40, "2026-07-01"),
      row("b", 30, "2026-07-02"),
      row("a", 55, "2026-08-01"),
      row("b", 71.6, "2026-09-01"),
    ]);
    expect(out).toEqual({ starting_crr: "30", current_crr: "72" });
  });
  it("returns null for a single score, a flat or falling score, or no scores", () => {
    expect(computeCrrChange([row("a", 50, "2026-07-01")])).toBeNull();
    expect(computeCrrChange([row("a", 60, "2026-07-01"), row("a", 60, "2026-08-01")])).toBeNull();
    expect(computeCrrChange([row("a", 70, "2026-07-01"), row("a", 50, "2026-08-01")])).toBeNull();
    expect(computeCrrChange([])).toBeNull();
  });
});

describe("interpolate CRR tokens", () => {
  it("fills CRR tokens when provided", () => {
    expect(interpolate("{{starting_crr}} to {{current_crr}}", { starting_crr: "52", current_crr: "78" })).toBe("52 to 78");
  });
  it("leaves CRR tokens untouched when not provided", () => {
    expect(interpolate("from {{starting_crr}}", { first_name: "Ana" })).toBe("from {{starting_crr}}");
  });
});
