// Pure helpers: turn the founder's typed values into the text printed in the term sheet.
import { fieldMap, fieldsFor } from "./fields";
import { PREVIEW_HTML } from "./preview-html.generated";
import type { TermSheetFieldDef, TermSheetFormType, TermSheetValues } from "./types";

const WORDS: Record<number, string> = {
  1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten", 11: "eleven", 12: "twelve",
  13: "thirteen", 14: "fourteen", 15: "fifteen", 16: "sixteen", 17: "seventeen", 18: "eighteen", 19: "nineteen", 20: "twenty", 24: "twenty-four",
};

export function wordsFor(n: number): string {
  return WORDS[n] ?? String(n);
}

/** Group digits with commas when the text is a plain number. Anything else is returned as typed. */
export function groupNumber(raw: string): string {
  const t = raw.trim();
  if (!/^[\d,]+(\.\d+)?$/.test(t)) return t;
  const [int, dec] = t.replace(/,/g, "").split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec !== undefined ? `${grouped}.${dec}` : grouped;
}

/** Tidy what the founder typed so it does not double up the prefix or suffix the template already prints. */
export function normalizeInput(def: TermSheetFieldDef, raw: string): string {
  let t = (raw ?? "").trim();
  if (!t) return "";
  if (def.kind === "words") return t.replace(/\D/g, "");
  if (def.prefix && t.startsWith(def.prefix)) t = t.slice(def.prefix.length).trim();
  if (def.suffix?.trim() === "%") t = t.replace(/\s*%$/, "");
  if (def.suffix?.trim() === "months") t = t.replace(/\s*months?$/i, "");
  if (def.suffix?.trim() === "million") t = t.replace(/\s*million$/i, "");
  if (def.prefix === "$") t = groupNumber(t);
  return t;
}

/** The text printed for a filled blank, or null when the blank is empty. */
export function printedValue(def: TermSheetFieldDef, raw: string | undefined): string | null {
  const v = normalizeInput(def, raw ?? "");
  if (!v) return null;
  if (def.kind === "words") {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? `${wordsFor(n)} (${n})` : v;
  }
  if (def.kind === "num") return `${def.prefix ?? ""}${v}${def.suffix ?? ""}`;
  return `${def.prefix ?? ""}${v}`;
}

export function isFilled(def: TermSheetFieldDef, values: TermSheetValues): boolean {
  return printedValue(def, values[def.id]) !== null;
}

/** Required blanks that are still empty. */
export function missingRequired(form: TermSheetFormType, values: TermSheetValues): TermSheetFieldDef[] {
  return fieldsFor(form).filter((f) => f.req && !isFilled(f, values));
}

export function progress(form: TermSheetFormType, values: TermSheetValues): { done: number; total: number } {
  const req = fieldsFor(form).filter((f) => f.req);
  return { done: req.filter((f) => isFilled(f, values)).length, total: req.length };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function unesc(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

/**
 * The template text as HTML with the founder's values swapped into the blanks.
 * filled: a value is typed. blank: a required blank with nothing typed (printed placeholder, highlighted).
 * tv: a template value the founder has not confirmed (printed as in the template).
 */
export function previewHtml(form: TermSheetFormType, values: TermSheetValues): string {
  const defs = fieldMap(form);
  return PREVIEW_HTML[form].replace(
    /<span class="fld" data-f="(\w+)" data-p="([^"]*)">⟦\w+⟧<\/span>/g,
    (_m, id: string, p: string) => {
      const def = defs[id];
      const printed = def ? printedValue(def, values[id]) : null;
      if (printed !== null) return `<span class="fld filled" data-f="${id}">${esc(printed)}</span>`;
      const cls = def && !def.req ? "tv" : "blank";
      return `<span class="fld ${cls}" data-f="${id}">${p}</span>`;
    },
  );
}

/** The whole term sheet as plain text with the values filled in. Used by tests and Round structure checks. */
export function filledPlainText(form: TermSheetFormType, values: TermSheetValues): string {
  const html = previewHtml(form, values);
  return unesc(
    html
      .replace(/<br\s*\/?>/g, " ")
      .replace(/<\/(p|tr|th|td|blockquote)>/g, " ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}
