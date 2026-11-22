// Read values back out of a term sheet the founder uploads (text based PDF or Word), by the text around
// each blank in the template. Fills only the blanks it can match, never overwrites a clause.
import { FIELD_CONTEXTS } from "./contexts.generated";
import { fieldsFor, TERM_SHEET_FORMS } from "./fields";
import { normalizeInput } from "./render";
import type { TermSheetFieldDef, TermSheetFormType, TermSheetValues } from "./types";

function norm(t: string): string {
  return t.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\s+/g, " ").trim();
}

/** Like norm but keeps line breaks, so a value in its own table cell stops at the end of its line. */
function normLines(t: string): string {
  return t
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{2,}/g, "\n");
}

/** Guess which template an uploaded term sheet follows from its title and distinctive terms. */
export function detectFormType(text: string): TermSheetFormType | null {
  const t = norm(text).toLowerCase();
  if (t.includes("series a preferred")) return "series_a";
  if (t.includes("simple agreement for future equity") || t.includes("for safe financing")) return "safe";
  if (t.includes("convertible note") || t.includes("valuation cap") && t.includes("interest")) return "convertible_note";
  return null;
}

function valueFromPrinted(def: TermSheetFieldDef, printed: string): string {
  let t = printed.trim().replace(/[;]$/, "");
  if (def.kind !== "text") t = t.replace(/[.,]$/, "");
  else t = t.replace(/,$/, "");
  if (def.kind === "words") {
    const m = t.match(/\((\d+)\)/);
    return m ? m[1] : t.replace(/\D/g, "");
  }
  if (def.prefix && t.startsWith(def.prefix)) t = t.slice(def.prefix.length);
  if (def.suffix) {
    const s = def.suffix.replace(/\.$/, "");
    if (s && t.endsWith(s)) t = t.slice(0, -s.length);
  }
  return normalizeInput(def, t.replace(/^\(|\)$/g, ""));
}

function plausible(def: TermSheetFieldDef, v: string): boolean {
  if (!v || v.length > 60 || v.includes("\n")) return false;
  if (def.kind === "words") return /^\d{1,2}$/.test(v);
  if (def.kind === "num") return /^\d[\d,]*(\.\d+)?$/.test(v);
  return !/\(?(DATE|COMPANY|INVESTOR|STATE|AMOUNT)\)?/.test(v);
}

/** The text where the blank sits, using the row label for table cells, else the words around it. */
function candidateFor(def: TermSheetFieldDef, ctx: { pre: string; post: string; lab?: string }, text: string, lines: string): string | null {
  const pre = norm(ctx.pre).toLowerCase();
  const post = norm(ctx.post).toLowerCase();
  const lowerLines = lines.toLowerCase();
  const lower = text.toLowerCase();

  if (ctx.lab) {
    const lab = norm(ctx.lab).toLowerCase();
    let from = 0;
    for (let guard = 0; guard < 6; guard++) {
      const at = lowerLines.indexOf(lab, from);
      if (at < 0) break;
      let start = at + lab.length;
      while (start < lowerLines.length && /\s/.test(lowerLines[start])) start++;
      from = at + lab.length;
      const p = pre.trimStart();
      if (p) {
        // The words before the blank sit somewhere in this row's text, which can be long.
        const found = lowerLines.indexOf(p, start);
        if (found < 0 || found - start > 9000) continue;
        start = found + p.length;
      }
      const rest = lines.slice(start, start + 140);
      let end = rest.indexOf("\n");
      if (end < 0) end = rest.length;
      if (post.length >= 2) {
        const pe = rest.toLowerCase().indexOf(post.slice(0, 14));
        if (pe >= 0 && (end < 0 || pe < end || end === rest.length)) end = pe;
      }
      return rest.slice(0, end);
    }
    return null;
  }

  if (pre.length >= 6) {
    let from = 0;
    for (let guard = 0; guard < 12; guard++) {
      const at = lower.indexOf(pre, from);
      if (at < 0) break;
      from = at + 1;
      const start = at + pre.length;
      if (post.length >= 2) {
        const pe = lower.indexOf(post.slice(0, 14), start);
        if (pe >= 0 && pe - start <= 80) return text.slice(start, pe);
        continue; // This is not the place: the words after it do not match.
      }
      const rest = text.slice(start, start + 40);
      const stop = rest.search(/;|\.\s|\.$/);
      return rest.slice(0, stop >= 0 ? stop : rest.length);
    }
    return null;
  }
  if (post.length >= 8) {
    const pe = lower.indexOf(post.slice(0, 20));
    if (pe > 0) {
      const m = text.slice(Math.max(0, pe - 24), pe).trimEnd().match(/(\S+)$/);
      return m ? m[1] : null;
    }
  }
  return null;
}

/** Values found in the text, for blanks where the template context matched. Blanks that still print the template placeholder are left empty. */
export function extractValues(form: TermSheetFormType, rawText: string): TermSheetValues {
  const text = norm(rawText);
  const lines = normLines(rawText);
  const out: TermSheetValues = {};
  for (const def of fieldsFor(form)) {
    const ctx = FIELD_CONTEXTS[form][def.id];
    if (!ctx) continue;
    const candidate = candidateFor(def, ctx, text, lines);
    if (!candidate) continue;
    const trimmed = candidate.trim();
    if (!trimmed || trimmed === def.ph) continue; // Still the template placeholder, or its printed default.
    const v = valueFromPrinted(def, trimmed);
    if (!plausible(def, v)) continue;
    out[def.id] = v;
  }
  return out;
}

export function formLabel(form: TermSheetFormType): string {
  return TERM_SHEET_FORMS[form].label;
}
