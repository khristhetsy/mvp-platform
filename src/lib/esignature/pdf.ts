// Server-only PDF utilities for the e-signature feature.

import { PDFDocument } from "pdf-lib";
import { MAX_PAGE_COUNT } from "./types";

/**
 * Count pages in a PDF buffer. Throws on an unreadable/corrupt PDF or one that
 * exceeds the page limit (so the caller can surface a friendly error).
 */
export async function countPdfPages(pdf: Buffer | Uint8Array): Promise<number> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(pdf, { updateMetadata: false });
  } catch {
    throw new PdfValidationError("This file isn't a readable PDF.");
  }
  const pages = doc.getPageCount();
  if (pages < 1) throw new PdfValidationError("The PDF has no pages.");
  if (pages > MAX_PAGE_COUNT) {
    throw new PdfValidationError(`The document has ${pages} pages; the limit is ${MAX_PAGE_COUNT}.`);
  }
  return pages;
}

export class PdfValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfValidationError";
  }
}
