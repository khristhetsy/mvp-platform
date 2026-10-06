// Field values: formatting, defaults, and the open-field check that blocks send.
// Pure functions (unit tested in fields.test.ts).

import type { FieldType, IssuingEntity, TemplateField } from "./types";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10-02" → "October 2, 2026". Anything else is returned as typed. */
export function formatDate(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return v.trim();
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[3])}, ${m[1]}` : v.trim();
}

/** "2500000" or "2,500,000.00" → "2,500,000". Non numeric text is kept as typed. */
export function formatCurrency(v: string): string {
  const raw = v.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(raw)) return v.trim();
  const [int, dec] = raw.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec && Number(dec) !== 0 ? `${grouped}.${dec}` : grouped;
}

/** "10 %" → "10". The % sign lives in the master next to the token. */
export function formatPercent(v: string): string {
  return v.trim().replace(/\s*%$/, "");
}

export function formatValue(type: FieldType, v: string): string {
  if (type === "date") return formatDate(v);
  if (type === "currency") return formatCurrency(v);
  if (type === "percent") return formatPercent(v);
  return type === "multiline" ? v.replace(/\r\n/g, "\n").trim() : v.trim();
}

/** Values to render: stored values over defaults, formatted, plus the issuing entity. */
export function resolveValues(
  fields: TemplateField[],
  stored: Record<string, string>,
  entity: IssuingEntity | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = stored[f.token] ?? f.default_value ?? "";
    if (v.trim()) out[f.token] = formatValue(f.type, v);
  }
  if (entity) out.issuing_entity = entity.legal_name;
  return out;
}

export type OpenField = { token: string; label: string };

/** Required fields still empty, the issuing entity included. Send is blocked while any remain. */
export function openFields(
  fields: TemplateField[],
  stored: Record<string, string>,
  entity: IssuingEntity | null,
  needsEntity: boolean,
): OpenField[] {
  const open: OpenField[] = [];
  if (needsEntity && !entity) open.push({ token: "issuing_entity", label: "Issuing entity" });
  for (const f of fields) {
    if (!f.required) continue;
    const v = (stored[f.token] ?? f.default_value ?? "").trim();
    if (!v) open.push({ token: f.token, label: f.label });
  }
  return open;
}

/** "Arrayworks, Inc." → "ICFO ARRAYWORKS SPV, LLC" (the naming used on signed term sheets). */
export function defaultSpvName(company: string | null | undefined): string {
  const base = (company ?? "")
    .replace(/[,.]?\s*(inc|incorporated|corp|corporation|llc|l\.l\.c|ltd|limited|co|company|plc|lp|llp)\.?$/i, "")
    .replace(/[,.\s]+$/, "")
    .trim();
  return base ? `ICFO ${base.toUpperCase()} SPV, LLC` : "";
}

/** Company legal name as written on the masters (upper case). */
export function defaultCompanyName(company: string | null | undefined): string {
  return (company ?? "").trim().toUpperCase();
}

/**
 * Currency as shown while typing: "1500000" → "1,500,000", "1500000.5" → "1,500,000.5".
 * Keeps a trailing "." so decimals can be typed. Non numeric text is kept as typed.
 */
export function groupCurrencyInput(v: string): string {
  const raw = v.replace(/,/g, "").trim();
  if (!raw) return "";
  const m = /^\$?(\d*)(\.\d*)?$/.exec(raw);
  if (!m) return v;
  const int = (m[1] ?? "").replace(/^0+(?=\d)/, "");
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${m[2] ?? ""}`;
}

/** What gets stored for a currency input: digits and one ".", no commas. */
export function plainCurrency(v: string): string {
  const cleaned = v.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  return dot === -1 ? cleaned : `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, "")}`;
}

/**
 * Fields on a services agreement that mirror a term sheet field in the same send.
 * The Due Diligence agreement's valuation follows the term sheet's valuation cap
 * (Series A has a pre money valuation instead), and its company legal name
 * follows the term sheet's company legal name.
 */
export const LINKED_FIELDS: { token: string; from: string[]; text?: boolean }[] = [
  { token: "equity_valuation", from: ["valuation_cap", "pre_money_valuation"] },
  { token: "company_name", from: ["company_name"], text: true },
];

/** A linked field's value in comparable form: trimmed text for text links, a plain number otherwise. */
export function linkedValue(token: string, raw: string): string {
  return LINKED_FIELDS.find((l) => l.token === token)?.text ? raw.trim() : plainCurrency(raw);
}

/** Linked values for a target document, read from the term sheets in the same send. Numbers are plain; text is trimmed. */
export function linkedFieldValues(
  targetFields: TemplateField[],
  sources: { fields: TemplateField[]; values: Record<string, string> }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  const has = new Set(targetFields.map((f) => f.token));
  for (const link of LINKED_FIELDS) {
    if (!has.has(link.token)) continue;
    for (const s of sources) {
      const f = s.fields.find((x) => link.from.includes(x.token));
      if (!f) continue;
      const v = linkedValue(link.token, s.values[f.token] ?? f.default_value ?? "");
      if (v) {
        out[link.token] = v;
        break;
      }
    }
  }
  return out;
}
