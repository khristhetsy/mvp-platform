/**
 * Bridge a Contacts/Opportunities selection into the marketing_contacts world so the
 * existing campaign + sequence engines can act on it. The grids show crm_contacts;
 * marketing lists/campaigns/sequences live over marketing_contacts (keyed by email).
 */

import { marketingDb } from "./db";

function splitName(name: string): { first: string | null; last: string | null } {
  const n = (name ?? "").trim();
  if (!n) return { first: null, last: null };
  const i = n.indexOf(" ");
  return i === -1 ? { first: n, last: null } : { first: n.slice(0, i), last: n.slice(i + 1) };
}

/** Opportunity ids → the crm_contacts ids they're linked to (deduped, non-null). */
export async function oppIdsToCrmIds(oppIds: string[]): Promise<string[]> {
  if (!oppIds.length) return [];
  const db = await marketingDb();
  const out: string[] = [];
  for (let i = 0; i < oppIds.length; i += 500) {
    const chunk = oppIds.slice(i, i + 500);
    const { data } = await db.from("sales_opportunities").select("contact_crm_id").in("id", chunk);
    for (const r of (data ?? []) as { contact_crm_id: string | null }[]) if (r.contact_crm_id) out.push(r.contact_crm_id);
  }
  return [...new Set(out)];
}

export type MarketingRecipient = { id: string; email: string; first_name: string | null; company: string | null };

/**
 * crm_contacts ids → upserted marketing_contacts (by email). Returns the mirror rows
 * (id + email + name/company for personalization) and how many were skipped for no email.
 */
export async function crmIdsToMarketingContacts(crmIds: string[]): Promise<{ recipients: MarketingRecipient[]; skippedNoEmail: number }> {
  if (!crmIds.length) return { recipients: [], skippedNoEmail: 0 };
  const db = await marketingDb();
  const rows: { id: string; name: string | null; email: string | null; company: string | null }[] = [];
  for (let i = 0; i < crmIds.length; i += 500) {
    const chunk = crmIds.slice(i, i + 500);
    const { data } = await db.from("crm_contacts").select("id, name, email, company").in("id", chunk);
    rows.push(...((data ?? []) as typeof rows));
  }
  const byEmail = new Map<string, { email: string; first_name: string | null; last_name: string | null; company: string | null; source: string }>();
  let skippedNoEmail = 0;
  for (const r of rows) {
    const email = (r.email ?? "").trim().toLowerCase();
    if (!email) { skippedNoEmail++; continue; }
    if (byEmail.has(email)) continue;
    const { first, last } = splitName(r.name ?? "");
    byEmail.set(email, { email, first_name: first, last_name: last, company: r.company ?? null, source: "crm" });
  }
  const mirror = [...byEmail.values()];
  if (mirror.length === 0) return { recipients: [], skippedNoEmail };
  const { data: up } = await db.from("marketing_contacts").upsert(mirror, { onConflict: "email" }).select("id, email, first_name, company");
  return { recipients: ((up ?? []) as MarketingRecipient[]), skippedNoEmail };
}

/** Create a hidden (archived) list holding these marketing_contacts — the vehicle a
 *  campaign or sequence enroll reads from. Returns the new list id. */
export async function createHiddenList(contactIds: string[], name: string): Promise<string> {
  const db = await marketingDb();
  const { data: list, error } = await db.from("marketing_lists").insert({ name, department: "Marketing", archived: true }).select("id").single();
  if (error || !list) throw new Error(error?.message ?? "Could not create the send list.");
  if (contactIds.length) {
    const rows = contactIds.map((contact_id) => ({ list_id: list.id, contact_id }));
    await db.from("marketing_list_contacts").upsert(rows, { onConflict: "list_id,contact_id" });
  }
  return list.id as string;
}
