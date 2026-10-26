// Package-wide page numbers for a sent subscription package. Each part is its own PDF (the
// signature pages are signed separately), so the numbers are stamped at send, once every
// part is rendered and its page count is known:
//   - every page gets a footer "Page X of Y" counted across the whole package;
//   - the Cover and Index part gets one extra page listing each part and the page it starts on.
// Pure planning (unit tested in numbering.test.ts) plus pdf-lib stamping.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { PARTS, type PartKey } from "./package";

export type NumberingInput = { id: string; part: PartKey; pageCount: number };
export type NumberingPlan = {
  total: number;
  /** Per document: the package page its first page lands on, and its page count including any index page. */
  docs: { id: string; part: PartKey; start: number; pages: number; indexPage: boolean }[];
  /** One line per part present, in package order. */
  index: { part: PartKey; label: string; start: number }[];
};

/** Where each document starts. The first Cover document carries the extra Index page. */
export function planNumbering(inputs: NumberingInput[]): NumberingPlan {
  let next = 1;
  let indexed = false;
  const docs: NumberingPlan["docs"] = [];
  for (const d of inputs) {
    const indexPage = d.part === "cover_index" && !indexed;
    if (indexPage) indexed = true;
    const pages = d.pageCount + (indexPage ? 1 : 0);
    docs.push({ id: d.id, part: d.part, start: next, pages, indexPage });
    next += pages;
  }
  const index: NumberingPlan["index"] = [];
  for (const p of PARTS) {
    const first = docs.find((d) => d.part === p.key);
    if (first) index.push({ part: p.key, label: `${p.no}. ${p.label}`, start: first.start });
  }
  return { total: next - 1, docs, index };
}

const GREY = rgb(0.35, 0.37, 0.42);

/** The PDF with "Page X of Y" in the bottom margin of every page and, when `indexPage` is set, the Index page appended. */
export async function stampPackagePdf(
  pdf: Buffer,
  opts: { start: number; total: number; label: string; indexPage?: { title: string; entries: NumberingPlan["index"] } },
): Promise<Buffer> {
  const doc = await PDFDocument.load(new Uint8Array(pdf), { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  if (opts.indexPage) {
    const last = doc.getPages().at(-1);
    const page = doc.addPage(last ? [last.getWidth(), last.getHeight()] : undefined);
    const { width, height } = page.getSize();
    const left = 72;
    const right = width - 72;
    page.drawText(opts.indexPage.title, { x: left, y: height - 110, size: 15, font: bold, color: rgb(0.04, 0.1, 0.25) });
    let y = height - 150;
    for (const e of opts.indexPage.entries) {
      const num = String(e.start);
      const label = e.label;
      page.drawText(label, { x: left, y, size: 11.5, font, color: rgb(0.1, 0.1, 0.1) });
      const labelEnd = left + font.widthOfTextAtSize(label, 11.5) + 6;
      const numX = right - font.widthOfTextAtSize(num, 11.5);
      // Dotted leader between the name and the page number.
      const dot = font.widthOfTextAtSize(". ", 11.5);
      let x = labelEnd;
      while (x + dot < numX - 6) {
        page.drawText(".", { x, y, size: 11.5, font, color: GREY });
        x += dot;
      }
      page.drawText(num, { x: numX, y, size: 11.5, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 26;
    }
  }
  doc.getPages().forEach((page, i) => {
    const { width } = page.getSize();
    const text = `Page ${opts.start + i} of ${opts.total}`;
    page.drawText(opts.label, { x: 36, y: 14, size: 7.5, font, color: GREY });
    page.drawText(text, { x: width - 36 - font.widthOfTextAtSize(text, 7.5), y: 14, size: 7.5, font, color: GREY });
  });
  return Buffer.from(await doc.save());
}
