// Pure helpers for the e-signature feature — no I/O, unit-tested in compute.test.ts.

import type { SignatureField } from "./types";

export type PdfRect = { left: number; bottom: number; width: number; height: number };

/**
 * Convert a normalized field box (x/y from the TOP-LEFT, 0–1) into pdf-lib
 * coordinates (origin BOTTOM-LEFT, points). Resolution-independent.
 */
export function fieldToPdfRect(
  field: Pick<SignatureField, "x" | "y" | "width" | "height">,
  pageWidth: number,
  pageHeight: number,
): PdfRect {
  const width = field.width * pageWidth;
  const height = field.height * pageHeight;
  const left = field.x * pageWidth;
  const topFromTop = field.y * pageHeight;
  const bottom = pageHeight - topFromTop - height;
  return { left, bottom, width, height };
}

/**
 * Auto-filled value for a field, or null if the signer must provide it.
 * Date → signing date; Company → recipient company. Server-authoritative.
 */
export function resolveAutoValue(
  field: Pick<SignatureField, "field_type" | "auto_source">,
  signingDate: string,
  signerCompany: string | null,
): string | null {
  if (field.auto_source === "signing_date" || field.field_type === "date") return signingDate;
  if (field.auto_source === "signer_company" || field.field_type === "company") return signerCompany ?? "";
  return null;
}
