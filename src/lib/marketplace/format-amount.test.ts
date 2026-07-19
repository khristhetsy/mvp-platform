import { describe, it, expect } from "vitest";
import { formatAmount, formatAmountRange } from "./format-amount";

describe("formatAmount", () => {
  it("abbreviates thousands and millions", () => {
    expect(formatAmount(250_000)).toBe("$250K");
    expect(formatAmount(1_200_000)).toBe("$1.2M");
    expect(formatAmount(2_000_000)).toBe("$2M");
    expect(formatAmount(500)).toBe("$500");
  });
  it("handles invalid input", () => {
    expect(formatAmount(-1)).toBe("—");
    expect(formatAmount(Number.NaN)).toBe("—");
  });
});

describe("formatAmountRange", () => {
  it("formats a min–max range with en dash", () => {
    expect(formatAmountRange(250_000, 1_200_000)).toBe("$250K – $1.2M");
  });
  it("collapses equal min/max to a single value", () => {
    expect(formatAmountRange(500_000, 500_000)).toBe("$500K");
  });
  it("handles a null max", () => {
    expect(formatAmountRange(250_000, null)).toBe("$250K+");
  });
  it("handles a null min", () => {
    expect(formatAmountRange(null, 900_000)).toBe("Up to $900K");
  });
  it("returns em-dash when both missing", () => {
    expect(formatAmountRange(null, null)).toBe("—");
  });
});
