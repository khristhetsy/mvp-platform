// Server-only: render a pitch deck to a PDF Buffer (pdfkit) — one landscape slide per page.
import PDFDocument from "pdfkit";
import { DECK_SLIDES } from "./slides";
import type { PitchDeck } from "./types";

const NAVY = "#0C2340";
const INDIGO = "#2E78F5";
const LIGHT = "#DCE6F5";

export function renderDeckPdf(deck: PitchDeck, company: { name: string }): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: [720, 405], margin: 0, bufferPages: true }); // 16:9
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(Buffer.from(c)));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      DECK_SLIDES.forEach((def, i) => {
        if (i > 0) doc.addPage({ size: [720, 405], margin: 0 });
        const s = deck.slides[def.id];
        // Background
        doc.rect(0, 0, 720, 405).fill(NAVY);
        // Eyebrow
        doc.font("Helvetica-Bold").fontSize(10).fillColor(INDIGO).text(def.title.toUpperCase(), 48, 44, { characterSpacing: 1 });
        // Headline
        doc.font("Helvetica-Bold").fontSize(26).fillColor("#FFFFFF").text(s?.headline || def.title, 48, 74, { width: 624, lineGap: 2 });
        // Body bullets
        const body = (s?.body || "").split("\n").map((l) => l.replace(/^•\s*/, "")).filter(Boolean);
        let y = 150;
        doc.font("Helvetica").fontSize(13).fillColor(LIGHT);
        for (const line of body.slice(0, 6)) {
          doc.circle(54, y + 7, 2).fill(INDIGO);
          doc.fillColor(LIGHT).text(line, 66, y, { width: 606, lineGap: 2 });
          y = doc.y + 8;
        }
        // Footer
        doc.font("Helvetica").fontSize(8).fillColor("#6B7DA0").text(`${company.name}  ·  ${i + 1} / ${DECK_SLIDES.length}`, 48, 384);
      });

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error("PDF render failed"));
    }
  });
}
