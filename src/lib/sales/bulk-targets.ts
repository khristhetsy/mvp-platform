/**
 * Resolve "which contacts does this bulk action touch?" for the Odoo-style selection bar.
 *
 * Two modes: an explicit id list (rows the user ticked), or a filter (the user pressed
 * "Select all N" and the action applies to every contact matching the current search).
 * The filter re-runs the same predicate the list itself used, so the count the user saw
 * is the count the action touches. Shared by Lead assign, Set lead source and Export.
 */
import { applyContactFilters } from "@/lib/sales/contact-filters";

export const CONTACT_GROUPS = ["founder", "investor", "advisor", "other"] as const;
/** Safety cap on how many contacts one action can touch. */
export const MAX_BULK_TARGET = 25_000;

export type BulkTarget =
  | { mode: "ids"; ids?: string[] }
  | { mode: "filter"; params?: string; group?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveContactIds(db: any, target: BulkTarget): Promise<string[]> {
  if (target.mode === "ids") return [...new Set(target.ids ?? [])];
  const p = new URLSearchParams(target.params ?? "");
  const PAGE = 1000;
  const ids: string[] = [];
  for (let from = 0; from < MAX_BULK_TARGET; from += PAGE) {
    let q = db.from("crm_contacts").select("id").order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (target.group && (CONTACT_GROUPS as readonly string[]).includes(target.group)) q = q.or(`contact_type.eq.${target.group},module.eq.${target.group}`);
    q = applyContactFilters(q, p);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    ids.push(...(data as Array<{ id: string }>).map((r) => r.id));
    if (data.length < PAGE) break;
  }
  return [...new Set(ids)];
}

/** RFC 4180-ish: quote when needed, double embedded quotes. */
export function csvCell(v: unknown): string {
  const s = v == null ? "" : Array.isArray(v) ? v.join("; ") : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
