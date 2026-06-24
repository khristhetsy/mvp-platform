import { describe, expect, it } from "vitest";
import {
  averageReadiness,
  fillPercent,
  readinessBand,
  toSymbol,
} from "./private-market";

describe("fillPercent", () => {
  it("returns null when target is missing or non-positive", () => {
    expect(fillPercent(1000, null)).toBeNull();
    expect(fillPercent(1000, 0)).toBeNull();
    expect(fillPercent(1000, -500)).toBeNull();
  });

  it("computes a rounded percentage", () => {
    expect(fillPercent(1_800_000, 2_500_000)).toBe(72);
    expect(fillPercent(880_000, 2_000_000)).toBe(44);
  });

  it("clamps to 0..100", () => {
    expect(fillPercent(3_000_000, 2_000_000)).toBe(100);
    expect(fillPercent(-5, 1000)).toBe(0);
  });

  it("treats no indicated interest as 0", () => {
    expect(fillPercent(0, 1_000_000)).toBe(0);
  });
});

describe("averageReadiness", () => {
  it("returns null for an empty or all-null set", () => {
    expect(averageReadiness([])).toBeNull();
    expect(averageReadiness([null, undefined])).toBeNull();
  });

  it("ignores nulls and rounds to one decimal", () => {
    expect(averageReadiness([84, null, 80.5, 76.4, undefined])).toBe(80.3);
  });

  it("handles a single value", () => {
    expect(averageReadiness([62.8])).toBe(62.8);
  });
});

describe("readinessBand", () => {
  it("bands by threshold", () => {
    expect(readinessBand(84).key).toBe("high");
    expect(readinessBand(80).key).toBe("high");
    expect(readinessBand(79.9).key).toBe("mid");
    expect(readinessBand(70).key).toBe("mid");
    expect(readinessBand(69).key).toBe("low");
  });

  it("returns 'none' for null/invalid", () => {
    expect(readinessBand(null)).toEqual({ key: "none", label: "—" });
    expect(readinessBand(undefined).key).toBe("none");
  });

  it("labels match the band", () => {
    expect(readinessBand(90).label).toBe("Strong");
    expect(readinessBand(72).label).toBe("Moderate");
    expect(readinessBand(40).label).toBe("Building");
  });
});

describe("toSymbol", () => {
  it("uppercases the first word, capped at 6 chars", () => {
    expect(toSymbol("FoxEyes Vision AI")).toBe("FOXEYE");
    expect(toSymbol("Diamond AI")).toBe("DIAMON");
    expect(toSymbol("Verde Cargo")).toBe("VERDE");
  });

  it("handles punctuation and short names", () => {
    expect(toSymbol("HeartScoreX·MRI")).toBe("HEARTS");
    expect(toSymbol("A")).toBe("A");
  });
});
