/**
 * A reminder set from a founder's contact page carries that contact's id. In the clock menu
 * it shows the contact's name and a click opens the contact's Tasks tab.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export function contactReminderHref(contactId: string): string {
  return `/founder/contacts/${encodeURIComponent(contactId)}?tab=tasks`;
}

type WithContact = { contact_id?: string | null };

/** Replaces contact_id with the clock row's context (contact name) and href. Rows with no contact pass through. */
export function attachContactLinks<T extends WithContact>(
  rows: readonly T[],
  names: ReadonlyMap<string, string>,
): Array<Omit<T, "contact_id"> & { context?: string; href?: string }> {
  return rows.map((row) => {
    const { contact_id: contactId, ...rest } = row;
    if (!contactId) return rest;
    const name = names.get(contactId);
    return { ...rest, ...(name ? { context: name } : {}), href: contactReminderHref(contactId) };
  });
}

/** Names of the contacts the rows point at, read through the person's own session. */
export async function loadContactNames(supabase: SupabaseClient, rows: readonly WithContact[]): Promise<Map<string, string>> {
  const ids = [...new Set(rows.map((r) => r.contact_id).filter((x): x is string => typeof x === "string" && x.length > 0))];
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data } = await supabase.from("founder_investor_contacts").select("id, investor_name").in("id", ids);
  for (const c of (data ?? []) as Array<{ id: string; investor_name: string }>) out.set(c.id, c.investor_name);
  return out;
}
