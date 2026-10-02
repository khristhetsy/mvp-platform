import { describe, expect, it } from "vitest";
import { crrBadge, founderResults, initials, visibleFounderResults, type FounderResult } from "./founder-results";

const q = (o: Partial<FounderResult> = {}): FounderResult => ({ quote: "Helpful.", approvedOn: "2026-10-02", name: "Ana Diaz", ...o });

describe("visibleFounderResults", () => {
  it("ships empty, so the section is hidden", () => {
    expect(founderResults).toEqual([]);
    expect(visibleFounderResults()).toEqual([]);
  });
  it("stays hidden below three qualifying entries", () => {
    expect(visibleFounderResults([q(), q(), q({ approvedOn: "" })])).toEqual([]);
  });
  it("shows once three entries qualify, dropping unapproved or unnamed ones", () => {
    const list = [q(), q({ anonymous: true, name: undefined }), q(), q({ name: "" }), q({ quote: " " })];
    expect(visibleFounderResults(list)).toHaveLength(3);
  });
});

describe("crrBadge", () => {
  it("shows only a real rising pair", () => {
    expect(crrBadge(q({ crrStart: 52, crrCurrent: 78.4 }))).toBe("CRR 52 → 78");
    expect(crrBadge(q({ crrStart: 60, crrCurrent: 60 }))).toBeNull();
    expect(crrBadge(q())).toBeNull();
  });
});

describe("initials", () => {
  it("takes up to two initials", () => {
    expect(initials("Ana Maria Diaz")).toBe("AM");
    expect(initials(undefined)).toBe("F");
  });
});
