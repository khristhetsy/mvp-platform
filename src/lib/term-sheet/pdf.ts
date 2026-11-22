// Server-only: render a term sheet to a PDF Buffer (pdfkit), from the same template text the Word file holds.
// Times type, the letterhead on page one, borderless clause tables, and the footer with the page number,
// as in the templates. The Word file is the exact original format; this PDF follows it as closely as pdfkit allows.
import PDFDocument from "pdfkit";
import { PDF_BLOCKS } from "./blocks.generated";
import { TERM_SHEET_FORMS, fieldMap } from "./fields";
import { LETTERHEAD_PNG_B64 } from "./logo.generated";
import type { TsBlock, TsCell, TsParagraph, TsRun } from "./pdf-model";
import { printedValue } from "./render";
import type { TermSheetFormType, TermSheetValues } from "./types";

const M = 72; // one inch margins, as in the templates
const FOOT_Y = 792 - 50;
const SIZE = 11;

function fontFor(r: TsRun, base: "Times-Roman" | "Times-Bold" = "Times-Roman"): string {
  const bold = r.b || base === "Times-Bold";
  if (bold && r.i) return "Times-BoldItalic";
  if (bold) return "Times-Bold";
  if (r.i) return "Times-Italic";
  return "Times-Roman";
}

export function renderTermSheetPdf(form: TermSheetFormType, values: TermSheetValues): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const defs = fieldMap(form);
      const meta = TERM_SHEET_FORMS[form];
      const doc = new PDFDocument({ size: "LETTER", margins: { top: M, bottom: M, left: M, right: M }, bufferPages: true, info: { Title: `${meta.label} term sheet` } });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(Buffer.from(c)));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const textOf = (r: TsRun): string => {
        if (r.br) return "\n";
        if (r.f) {
          const def = defs[r.f];
          const v = def ? printedValue(def, values[r.f]) : null;
          return v ?? r.p ?? "";
        }
        return r.s ?? "";
      };

      const drawRuns = (runs: TsRun[], x: number, y: number, width: number, opts: { base?: "Times-Roman" | "Times-Bold"; indent?: number } = {}) => {
        const list = runs.filter((r) => textOf(r) !== "");
        // Trim trailing line breaks and spaces.
        while (list.length && /^\s*$/.test(textOf(list[list.length - 1]))) list.pop();
        if (!list.length) return y;
        doc.x = x;
        doc.y = y;
        list.forEach((r, idx) => {
          const t = textOf(r);
          const filled = r.f ? printedValue(defs[r.f], values[r.f]) !== null : false;
          doc.font(fontFor(r, opts.base)).fontSize(SIZE).fillColor("#000000");
          const o: PDFKit.Mixins.TextOptions = { continued: idx < list.length - 1, underline: Boolean(r.u) || (Boolean(r.f) && !filled), width, lineGap: 1.5 };
          if (idx === 0 && opts.indent) o.indent = opts.indent;
          if (idx === 0) doc.text(t, x, y, o);
          else doc.text(t, o);
        });
        return doc.y;
      };

      const heightOf = (runs: TsRun[], width: number, base?: "Times-Roman" | "Times-Bold") => {
        const t = runs.map(textOf).join("");
        const bold = runs.some((r) => r.b) || base === "Times-Bold";
        doc.font(bold ? "Times-Bold" : "Times-Roman").fontSize(SIZE);
        return doc.heightOfString(t, { width, lineGap: 1.5 });
      };

      const room = () => FOOT_Y - 12 - doc.y;
      const content = 612 - 2 * M;

      // Letterhead on page one, as in the first page header of the template.
      const logo = Buffer.from(LETTERHEAD_PNG_B64, "base64");
      try {
        doc.image(logo, M, 40, { height: 44 });
      } catch {
        // A logo that cannot be drawn must not stop the term sheet.
      }
      doc.font("Helvetica").fontSize(8).fillColor("#222222");
      doc.text("La Jolla Executive Center\n4225 Executive Square, Suite 600-#690\nLa Jolla, CA 92037\nMain Office: (619) 956-9114\nservice@myicfos.com", M, 40, { width: content, align: "right", lineGap: 1 });
      doc.y = Math.max(doc.y, 96);

      const blocks: TsBlock[] = PDF_BLOCKS[form];
      for (const b of blocks) {
        if (b.t === "p") {
          const x = M + (b.q ? 28 : 0);
          const w = content - (b.q ? 28 : 0);
          const h = heightOf(b.r, w);
          if (h > room() && h < 600) doc.addPage();
          const y = drawRuns(b.r, x, doc.y, w);
          doc.y = y + 7;
        } else {
          const total = b.w.reduce((a, c) => a + c, 0) || 100;
          const widths = b.w.map((w) => (w / total) * content);
          for (const row of b.rows) {
            const cellH = row.map((c: TsCell, ci: number) => {
              const w = (widths[ci] ?? content / row.length) - 10;
              return c.p.reduce((acc: number, p: TsParagraph) => acc + heightOf(p, w, c.h ? "Times-Bold" : undefined) + 4, 0);
            });
            const rowH = Math.max(...cellH, 14);
            if (rowH > room()) doc.addPage();
            const top = doc.y;
            let x = M;
            row.forEach((c: TsCell, ci: number) => {
              const w = (widths[ci] ?? content / row.length) - 10;
              let y = top;
              for (const p of c.p) {
                y = drawRuns(p, x, y, w, { base: undefined }) + 4;
              }
              x += widths[ci] ?? content / row.length;
            });
            doc.x = M;
            doc.y = top + rowH + 6;
          }
        }
        doc.x = M;
      }

      // Footer: title on the left, page number on the right, on every page.
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.page.margins.bottom = 0;
        doc.font("Times-Roman").fontSize(10).fillColor("#444444");
        doc.text(meta.footer, M, FOOT_Y, { width: content - 40, lineBreak: false });
        doc.text(String(i + 1), M, FOOT_Y, { width: content, align: "right", lineBreak: false });
      }
      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error("PDF render failed"));
    }
  });
}
