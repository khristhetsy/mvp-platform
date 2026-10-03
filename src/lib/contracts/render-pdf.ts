// One render engine for every PDF the contract feature produces: the editor's
// true preview, the PDF download, the e-signature copy and (through sealing)
// the executed copy all come from this converter, so they cannot differ.
//
// iCapOS renders the filled Word file itself (docx-pdf/): no outside service,
// no keys. It follows Word's layout rules with fonts that have the same
// character widths as Times New Roman, Arial and Calibri. Measured against
// Word's own PDFs of the five iCFO masters (Oct 3, 2026): 97.9% of 1,855 lines
// have the same text, page and position, and every master has the same page
// count as in Word.

import { renderDocxToPdf } from "./docx-pdf";

export class RenderUnavailableError extends Error {
  constructor(message = "PDF rendering is unavailable.") {
    super(message);
    this.name = "RenderUnavailableError";
  }
}

export class RenderFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderFailedError";
  }
}

/** Always available: the renderer runs inside iCapOS. */
export function renderConfigured(): boolean {
  return true;
}

export async function docxToPdf(docx: Buffer, filename: string): Promise<Buffer> {
  try {
    const pdf = await renderDocxToPdf(docx);
    if (pdf.subarray(0, 4).toString() !== "%PDF") throw new Error("not a PDF");
    return pdf;
  } catch (err) {
    throw new RenderFailedError(`Could not make the PDF for ${filename.replace(/\.docx$/i, "")}: ${err instanceof Error ? err.message : "unknown error"}.`);
  }
}
