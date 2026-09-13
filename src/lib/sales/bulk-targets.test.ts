import { describe, it, expect } from "vitest";
import { csvCell, toCsv, resolveContactIds } from "./bulk-targets";

describe("csv", () => {
  it("quotes only when needed and doubles embedded quotes", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('He said "hi", ok')).toBe('"He said ""hi"", ok"');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(["VC", "Angel"])).toBe("VC; Angel");
  });
  it("writes header then rows with CRLF", () => {
    expect(toCsv(["a", "b"], [[1, "x,y"]])).toBe('a,b\r\n1,"x,y"\r\n');
  });
});

describe("resolveContactIds", () => {
  it("de-dups an explicit id list without touching the database", async () => {
    const db = { from: () => { throw new Error("should not query"); } };
    expect(await resolveContactIds(db, { mode: "ids", ids: ["a", "b", "a"] })).toEqual(["a", "b"]);
  });
  it("pages a filter until a short page, so more than 1,000 matches are all targeted", async () => {
    const pages = [Array.from({ length: 1000 }, (_, i) => ({ id: `p1-${i}` })), [{ id: "p2-0" }]];
    let call = 0;
    const q = {
      select: () => q, order: () => q, range: () => q, or: () => q, ilike: () => q, in: () => q, eq: () => q, contains: () => q,
      then: (res: (v: { data: { id: string }[]; error: null }) => void) => res({ data: pages[call++] ?? [], error: null }),
    };
    const db = { from: () => q };
    const ids = await resolveContactIds(db, { mode: "filter", params: "", group: "investor" });
    expect(ids).toHaveLength(1001);
    expect(call).toBe(2);
  });
});
