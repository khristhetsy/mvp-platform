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
  it("uses the company with the largest rise, not a newer placeholder", () => {
    const out = computeCrrChange([
      row("real", 28, "2026-07-01"),
      row("real", 76, "2026-08-01"),
      row("placeholder", 1, "2026-09-01"),
      row("placeholder", 3, "2026-09-20"),
    ]);
    expect(out).toEqual({ starting_crr: "28", current_crr: "76" });
  });
  it("rounds scores", () => {
    expect(computeCrrChange([row("a", 30.4, "2026-07-01"), row("a", 71.6, "2026-09-01")])).toEqual({ starting_crr: "30", current_crr: "72" });
  });
  it("returns null below the minimum gain, for one score, or no scores", () => {
    expect(computeCrrChange([row("a", 7, "2026-07-01"), row("a", 8, "2026-08-01")])).toBeNull();
    expect(computeCrrChange([row("a", 50, "2026-07-01"), row("a", 59, "2026-08-01")])).toBeNull();
    expect(computeCrrChange([row("a", 50, "2026-07-01")])).toBeNull();
    expect(computeCrrChange([row("a", 70, "2026-07-01"), row("a", 50, "2026-08-01")])).toBeNull();
    expect(computeCrrChange([])).toBeNull();
  });
  it("accepts exactly the minimum gain", () => {
    expect(computeCrrChange([row("a", 50, "2026-07-01"), row("a", 60, "2026-08-01")])).toEqual({ starting_crr: "50", current_crr: "60" });
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
