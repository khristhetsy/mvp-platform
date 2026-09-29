import { describe, it, expect } from "vitest";
import { extractDocumentText } from "./extract-text";

// Smallest valid one-page PDF with a text layer, built so xref offsets are exact.
function tinyPdf(text: string): Uint8Array {
  const stream = `BT /F1 24 Tf 72 720 Td (${text}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

describe("extractDocumentText (pdf)", () => {
  it("reads the text layer", async () => {
    const text = await extractDocumentText(tinyPdf("Seed round pitch deck"), "application/pdf", "deck.pdf");
    expect(text).toContain("Seed round pitch deck");
  });

  it("leaves the caller's bytes intact so they can still be sent to Claude", async () => {
    // pdfjs detaches the buffer it is handed. summarize.ts falls back to sending
    // these same bytes to Claude, which failed with "PDF cannot be empty".
    const bytes = tinyPdf("Financial statements FY2025");
    const before = bytes.byteLength;
    await extractDocumentText(bytes, "application/pdf", "fin.pdf");
    expect(bytes.byteLength).toBe(before);
  });
});
