import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { planNumbering, stampPackagePdf } from "./numbering";
import { readPdfLines } from "../signature-anchors";

const blank = async (pages: number) => {
  const d = await PDFDocument.create();
  for (let i = 0; i < pages; i++) d.addPage([612, 792]);
  return Buffer.from(await d.save());
};

describe("package page numbering", () => {
  const inputs = [
    { id: "cover", part: "cover_index" as const, pageCount: 2 },
    { id: "instr", part: "instructions" as const, pageCount: 6 },
    { id: "sig1", part: "signature_pages" as const, pageCount: 2 },
    { id: "sig2", part: "signature_pages" as const, pageCount: 2 },
    { id: "w9", part: "forms" as const, pageCount: 6 },
    { id: "ppm", part: "ppm" as const, pageCount: 100 },
    { id: "agr", part: "agreement" as const, pageCount: 20 },
  ];

  it("counts across the whole package, with one extra Index page on the Cover", () => {
    const plan = planNumbering(inputs);
    expect(plan.total).toBe(139);
    expect(plan.docs.map((d) => [d.id, d.start, d.pages])).toEqual([
      ["cover", 1, 3], ["instr", 4, 6], ["sig1", 10, 2], ["sig2", 12, 2], ["w9", 14, 6], ["ppm", 20, 100], ["agr", 120, 20],
    ]);
    expect(plan.docs.filter((d) => d.indexPage).map((d) => d.id)).toEqual(["cover"]);
  });

  it("the Index lists each part present once, at the page its first document starts", () => {
    expect(planNumbering(inputs).index).toEqual([
      { part: "cover_index", label: "1. Cover and Index", start: 1 },
      { part: "instructions", label: "2. Subscription Instructions", start: 4 },
      { part: "signature_pages", label: "3. Signature Pages", start: 10 },
      { part: "forms", label: "4. Forms", start: 14 },
      { part: "ppm", label: "5. Private Placement Memorandum", start: 20 },
      { part: "agreement", label: "6. Subscription Agreement", start: 120 },
    ]);
  });

  it("leaves out a part that is not in the send, and numbers what remains", () => {
    const plan = planNumbering(inputs.filter((d) => d.part !== "forms"));
    expect(plan.index.map((e) => e.part)).not.toContain("forms");
    expect(plan.total).toBe(133);
  });

  it("stamps 'Page X of Y' on every page and appends the Index page to the Cover", async () => {
    const plan = planNumbering(inputs);
    const stamped = await stampPackagePdf(await blank(2), { start: 1, total: plan.total, label: "Cover and Index", indexPage: { title: "Index", entries: plan.index } });
    const { lines, pageCount } = await readPdfLines(new Uint8Array(stamped));
    expect(pageCount).toBe(3);
    const text = lines.map((l) => l.text);
    expect(text.some((t) => /Page 1 of 139/.test(t))).toBe(true);
    expect(text.some((t) => /Page 3 of 139/.test(t))).toBe(true);
    expect(text.some((t) => /Index/.test(t))).toBe(true);
    expect(text.some((t) => /Private Placement Memorandum/.test(t) && /20/.test(t))).toBe(true);
  });

  it("a part in the middle starts at its own page number", async () => {
    const stamped = await stampPackagePdf(await blank(2), { start: 10, total: 139, label: "Signature Pages" });
    const { lines } = await readPdfLines(new Uint8Array(stamped));
    expect(lines.some((l) => /Page 10 of 139/.test(l.text))).toBe(true);
    expect(lines.some((l) => /Page 11 of 139/.test(l.text))).toBe(true);
  });
});
