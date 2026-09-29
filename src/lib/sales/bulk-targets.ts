/**
 * Resolve "which contacts does this bulk action touch?" for the Odoo-style selection bar.
 *
 * Two modes: an explicit id list (rows the user ticked), or a filter (the user pressed
 * "Select all N" and the action applies to every contact matching the current search).
 * The filter re-runs the same predicate the list itself used — same SQL function, same
 * owner scope (including a manager's `viewAs`) — so the count the user saw is the count
 * the action touches. Shared by Lead assign, Set lead source, Create list, Email, Export.
 */
import { parseContactsQuery, searchContactIds } from "@/lib/sales/contacts-search";
import { getSalesScope, effectiveContactsOwner } from "@/lib/sales/scope";

export const CONTACT_GROUPS = ["founder", "investor", "advisor", "other"] as const;
/** Safety cap on how many contacts one action can touch. */
export const MAX_BULK_TARGET = 25_000;

export type BulkTarget =
  | { mode: "ids"; ids?: string[] }
  | { mode: "filter"; params?: string; group?: string };

type Caller = { id: string; role?: string | null; is_super_admin?: boolean | null };

/**
 * Filter mode re-runs the exact predicate the list ran, scoped exactly as the list was
 * (the caller's contacts scope; `viewAs` travels inside `params`). Throws on a database
 * error — a bulk action must never quietly run on a partial id set.
 */
export async function resolveContactIds(caller: Caller, target: BulkTarget): Promise<string[]> {
  if (target.mode === "ids") return [...new Set(target.ids ?? [])];
  const p = new URLSearchParams(target.params ?? "");
  if (target.group && (CONTACT_GROUPS as readonly string[]).includes(target.group)) p.set("group", target.group);
  const q = parseContactsQuery(p);
  const owner = effectiveContactsOwner(await getSalesScope(caller, p.get("viewAs")));
  return searchContactIds(q.spec, owner, q.groupBy, q.groupValue, MAX_BULK_TARGET);
}

/** RFC 4180-ish: quote when needed, double embedded quotes. */
export function csvCell(v: unknown): string {
  const s = v == null ? "" : Array.isArray(v) ? v.join("; ") : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
