// Cover email tokens. Values come from the contact and from the documents'
// own field values, so the email and the documents cannot disagree. Pure.

import { formatValue } from "./fields";
import type { TemplateField } from "./types";

export type EmailTokenContext = {
  contactName: string | null;
  company: string | null;
  senderName: string | null;
  /** Each document's fields and resolved values, term sheet first. */
  documents: { fields: TemplateField[]; values: Record<string, string>; entityName: string | null; title: string }[];
};

/** Display form for email: currency gets "$", percent gets "%". */
function display(field: TemplateField | undefined, value: string): string {
  if (!field) return value;
  const v = formatValue(field.type, value);
  if (field.type === "currency") return `$${v}`;
  if (field.type === "percent") return `${v}%`;
  return v;
}

export function emailTokenValues(ctx: EmailTokenContext): Record<string, string> {
  const out: Record<string, string> = {};
  const first = ctx.contactName?.trim().split(/\s+/)[0] ?? "";
  if (first) out.first_name = first;
  if (ctx.contactName) out.full_name = ctx.contactName.trim();
  if (ctx.company) out.company = ctx.company.trim();
  if (ctx.senderName) out.sender_name = ctx.senderName.trim();
  const titles: string[] = [];
  // Later documents never overwrite a value an earlier document already set.
  for (const d of ctx.documents) {
    titles.push(d.title);
    if (d.entityName && !out.issuing_entity) out.issuing_entity = d.entityName;
    // A field left at its master default (e.g. interest rate 10.0) still has a value.
    const merged: Record<string, string> = {};
    for (const f of d.fields) if (f.default_value) merged[f.token] = f.default_value;
    for (const [token, value] of Object.entries(d.values)) if (value?.trim()) merged[token] = value;
    for (const [token, value] of Object.entries(merged)) {
      if (out[token] || !value.trim()) continue;
      out[token] = display(d.fields.find((f) => f.token === token), value);
    }
  }
  if (titles.length) out.document_list = titles.join(", ");
  return out;
}

/** Tokens a cover email can use, for the editor's help line. */
export const EMAIL_TOKENS_BASE = ["first_name", "full_name", "company", "sender_name", "issuing_entity", "document_list"];

/** Replace {{tokens}}; returns the text and any tokens that had no value. */
export function applyEmailTokens(text: string, values: Record<string, string>): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const out = text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/g, (m, tok: string) => {
    const v = values[tok];
    if (v === undefined || v === "") {
      missing.add(tok);
      return m;
    }
    return v;
  });
  return { text: out, missing: [...missing] };
}
