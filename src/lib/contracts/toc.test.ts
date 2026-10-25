import { describe, expect, it } from "vitest";
import { locateEntries } from "./toc";

const L = (page: number, text: string) => ({ page, text });

describe("locateEntries", () => {
  it("finds headings in contents order, skipping the contents page itself and repeated generic names", () => {
    const lines = [
      L(2, "Table of Contents"),
      L(2, "NOTICES 3"),
      L(2, "General 4"),
      L(2, "TERMS 4"),
      L(3, "NOTICES"),
      L(4, "General"),
      L(5, "TERMS"),
      L(6, "General"),
    ];
    expect(locateEntries(["NOTICES", "General", "TERMS"], lines)).toEqual([3, 4, 5]);
  });
  it("returns null for a heading it cannot find and carries on", () => {
    const lines = [L(1, "Table of Contents"), L(1, "A 2"), L(1, "B 2"), L(2, "B")];
    expect(locateEntries(["A", "B"], lines)).toEqual([null, 2]);
  });
  it("gives nothing when there is no contents page", () => {
    expect(locateEntries(["A"], [L(1, "A")])).toEqual([null]);
  });
});
