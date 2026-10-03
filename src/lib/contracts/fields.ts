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
