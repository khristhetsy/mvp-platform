import { GENERATED_FIELDS } from "./fields.generated";
import type { TermSheetFieldDef, TermSheetFormType } from "./types";

export interface TermSheetFormMeta {
  type: TermSheetFormType;
  label: string;
  /** Short name used in file names and titles. */
  short: string;
  footer: string;
  blurb: string;
}

export const TERM_SHEET_FORMS: Record<TermSheetFormType, TermSheetFormMeta> = {
  convertible_note: {
    type: "convertible_note",
    label: "Convertible Note",
    short: "Convertible Note",
    footer: "Term Sheet for Equity Financing",
    blurb: "Debt that converts into equity at the next round, with interest, discount, cap and warrant coverage.",
  },
  safe: {
    type: "safe",
    label: "SAFE",
    short: "SAFE",
    footer: "Term Sheet for Equity Financing",
    blurb: "A post money SAFE with a valuation cap and discount.",
  },
  series_a: {
    type: "series_a",
    label: "Series A Preferred",
    short: "Series A Preferred",
    footer: "Term Sheet For Series A Preferred Stock Financing",
    blurb: "A priced Series A Preferred round with the full set of standard clauses.",
  },
};

export function isFormType(v: unknown): v is TermSheetFormType {
  return v === "convertible_note" || v === "safe" || v === "series_a";
}

export function fieldsFor(form: TermSheetFormType): TermSheetFieldDef[] {
  return GENERATED_FIELDS[form];
}

export function fieldMap(form: TermSheetFormType): Record<string, TermSheetFieldDef> {
  return Object.fromEntries(fieldsFor(form).map((f) => [f.id, f]));
}

/** Clauses that contain at least one blank, in template order. */
export function clausesFor(form: TermSheetFormType): string[] {
  const out: string[] = [];
  for (const f of fieldsFor(form)) if (!out.includes(f.sec)) out.push(f.sec);
  return out;
}

export function fieldsInClause(form: TermSheetFormType, clause: string): TermSheetFieldDef[] {
  return fieldsFor(form).filter((f) => f.sec === clause);
}

export function requiredFields(form: TermSheetFormType): TermSheetFieldDef[] {
  return fieldsFor(form).filter((f) => f.req);
}
