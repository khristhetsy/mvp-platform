import { describe, expect, it } from "vitest";
import { groupLines, placeSignatureFields, type PdfItem } from "./signature-anchors";

// A two column signature table: SPV on the left, the company on the right.
const items: PdfItem[] = [
  { str: "IN WITNESS WHEREOF", x: 72, y: 700, w: 140, h: 10 },
  { str: "ICFO ARRAYWORKS SPV, LLC", x: 72, y: 600, w: 150, h: 10 },
  { str: "ARRAYWORKS, INC.", x: 330, y: 600, w: 110, h: 10 },
  { str: "By:", x: 72, y: 570, w: 16, h: 10 },
  { str: "By:", x: 330, y: 570, w: 16, h: 10 },
  { str: "Name:", x: 72, y: 552, w: 30, h: 10 },
  { str: "Name:", x: 330, y: 552, w: 30, h: 10 },
  { str: "Title:", x: 72, y: 534, w: 26, h: 10 },
  { str: "Title:", x: 330, y: 534, w: 26, h: 10 },
];

describe("signature placement", () => {
  const lines = groupLines(items, 6, 612, 792);
  it("puts the prospect's fields in the company's column", () => {
    const r = placeSignatureFields(lines, { prospect: { party: "{{company_name}}" }, countersign: [{ party: "{{spv_name}}" }] }, { company_name: "ARRAYWORKS, INC.", spv_name: "ICFO ARRAYWORKS SPV, LLC" });
    expect(r.prospect.signature.page).toBe(6);
    expect(r.prospect.signature.x * 612).toBeGreaterThan(330);
    expect(r.prospect.name).not.toBeNull();
    expect(r.prospect.title).not.toBeNull();
    const sig = r.countersign.find((f) => f.kind === "signature")!;
    expect(sig.x * 612).toBeLessThan(200);
    // Normalized top-left origin, above the "By:" baseline.
    expect(r.prospect.signature.y).toBeCloseTo((792 - (570 + 26 - 4)) / 792, 5);
  });
  it("fails closed when the block is missing", () => {
    expect(() => placeSignatureFields(lines, { prospect: { party: "NOT HERE" }, countersign: [] }, {})).toThrow(/signature block/);
  });
});
