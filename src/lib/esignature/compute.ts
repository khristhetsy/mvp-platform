// Pure helpers for the e-signature feature — no I/O, unit-tested in compute.test.ts.

import { DEFAULT_TITLE_OPTIONS, type FieldOptions, type SignatureField } from "./types";

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
 * Date → signing date; Company → recipient company; Name → recipient name.
 * Server-authoritative.
 */
export function resolveAutoValue(
  field: Pick<SignatureField, "field_type" | "auto_source">,
  signingDate: string,
  signerCompany: string | null,
  signerName: string | null = null,
): string | null {
  if (field.auto_source === "signing_date" || field.field_type === "date") return signingDate;
  if (field.auto_source === "signer_company" || field.field_type === "company") return signerCompany ?? "";
  if (field.auto_source === "signer_name" || field.field_type === "name") return signerName ?? "";
  return null;
}

const MAX_CHOICES = 12;
const MAX_CHOICE_LEN = 40;

/** Clean a title field's options: trimmed, unique, non-empty; defaults when missing. */
export function normalizeTitleOptions(raw: unknown): FieldOptions {
  const v = (raw && typeof raw === "object" ? raw : {}) as { choices?: unknown; multiple?: unknown };
  const seen = new Set<string>();
  const choices: string[] = [];
  for (const c of Array.isArray(v.choices) ? v.choices : []) {
    if (typeof c !== "string") continue;
    const t = c.trim().replace(/,/g, " ").replace(/\s+/g, " ").slice(0, MAX_CHOICE_LEN);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    choices.push(t);
    if (choices.length >= MAX_CHOICES) break;
  }
  return {
    choices: choices.length ? choices : [...DEFAULT_TITLE_OPTIONS.choices],
    multiple: typeof v.multiple === "boolean" ? v.multiple : DEFAULT_TITLE_OPTIONS.multiple,
  };
}

/** Split a stored title value ("CEO, Founder") into its picks. */
export function splitTitleValue(value: string | null | undefined): string[] {
  return (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Check a signer's title picks against the field's options. Returns the value
 * to store ("CEO, Founder", in list order) or an error. Empty is allowed here;
 * the required check happens with the other fields.
 */
export function validateTitleValue(value: string, rawOptions: unknown): { value: string } | { error: string } {
  const options = normalizeTitleOptions(rawOptions);
  const picks = splitTitleValue(value);
  if (!picks.length) return { value: "" };
  const allowed = new Map(options.choices.map((c) => [c.toLowerCase(), c]));
  const chosen = new Set<string>();
  for (const p of picks) {
    const match = allowed.get(p.toLowerCase());
    if (!match) return { error: "Pick your title from the list." };
    chosen.add(match);
  }
  if (!options.multiple && chosen.size > 1) return { error: "Pick one title." };
  return { value: options.choices.filter((c) => chosen.has(c)).join(", ") };
}
