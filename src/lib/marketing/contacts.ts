import { marketingDb } from "./db";
import type { MarketingContact, MarketingList } from "./types";

export async function getContacts(opts?: {
  search?: string;
  list_id?: string;
  tag?: string;
  source?: string;
  limit?: number;
  offset?: number;
  sort?: "name" | "company" | "created_at";
  dir?: "asc" | "desc";
  enrich?: boolean;
}): Promise<{ contacts: MarketingContact[]; total: number }> {
  const db = await marketingDb();

  const sortCol = opts?.sort === "name" ? "first_name" : opts?.sort === "company" ? "company" : "created_at";
  const ascending = opts?.dir === "asc";

  let query = db
    .from("marketing_contacts")
    .select("*", { count: "exact" })
    .order(sortCol, { ascending, nullsFirst: false });

  if (opts?.search) {
    query = query.or(
      `email.ilike.%${opts.search}%,first_name.ilike.%${opts.search}%,last_name.ilike.%${opts.search}%,company.ilike.%${opts.search}%`
    );
  }

  if (opts?.list_id) {
    const { data: members } = await db
      .from("marketing_list_contacts")
      .select("contact_id")
      .eq("list_id", opts.list_id);
    const ids = (members ?? []).map((m: { contact_id: string }) => m.contact_id);
    if (ids.length === 0) return { contacts: [], total: 0 };
    query = query.in("id", ids);
  }

  if (opts?.tag) {
    query = query.contains("tags", [opts.tag]);
  }

  if (opts?.source) {
    query = query.eq("source", opts.source);
  }

  query = query.range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 50) - 1);

  const { data, count, error } = await query;
  if (error) throw error;
  let contacts = (data ?? []) as MarketingContact[];
  if (opts?.enrich && contacts.length) contacts = await enrichFromCrm(db, contacts);
  return { contacts, total: count ?? 0 };
}

// Attach phone / membership / type / lead-assignees from the CRM mirror (matched by
// email) so the Marketing contacts grid can show those columns.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enrichFromCrm(db: any, contacts: MarketingContact[]): Promise<MarketingContact[]> {
  try {
    const emails = [...new Set(contacts.map((c) => c.email).filter(Boolean))];
    if (emails.length === 0) return contacts;
    const { data: crm } = await db
      .from("crm_contacts")
      .select("email, phone, contact_type, plan, assignee_ids, raw")
      .in("email", emails);
    const byEmail = new Map<string, { phone: string | null; membership: string | null; type: string | null; assignee_ids: string[] }>();
    const ids = new Set<string>();
    for (const r of (crm ?? []) as Array<Record<string, unknown>>) {
      const email = String(r.email ?? "").toLowerCase();
      if (!email) continue;
      const raw = (r.raw ?? {}) as Record<string, unknown>;
      const phone = (r.phone as string) || (typeof raw.phone === "string" ? raw.phone : null) || (typeof raw.mobile === "string" ? raw.mobile : null) || null;
      const membership = (r.plan as string) || (typeof raw.membership_type === "string" ? raw.membership_type : null) || null;
      const assignee_ids = Array.isArray(r.assignee_ids) ? (r.assignee_ids as string[]) : [];
      assignee_ids.forEach((id) => ids.add(id));
      byEmail.set(email, { phone, membership, type: (r.contact_type as string) ?? null, assignee_ids });
    }
    const nameById = new Map<string, string>();
    if (ids.size) {
      const { data: profs } = await db.from("profiles").select("id, full_name, email").in("id", [...ids]);
      for (const p of (profs ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
        nameById.set(p.id, p.full_name ?? p.email ?? "Member");
      }
    }
    return contacts.map((c) => {
      const m = byEmail.get((c.email ?? "").toLowerCase());
      if (!m) return c;
      return { ...c, phone: m.phone, membership: m.membership, type: m.type, assignees: m.assignee_ids.map((id) => nameById.get(id)).filter(Boolean) as string[] };
    });
  } catch {
    return contacts;
  }
}

export async function createContact(
  input: Partial<MarketingContact>
): Promise<MarketingContact> {
  const db = await marketingDb();
  const { data, error } = await db
    .from("marketing_contacts")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as MarketingContact;
}

export async function upsertContact(
  input: Partial<MarketingContact> & { email: string }
): Promise<MarketingContact> {
  const db = await marketingDb();
  const { data, error } = await db
    .from("marketing_contacts")
    .upsert(input, { onConflict: "email" })
    .select()
    .single();
  if (error) throw error;
  return data as MarketingContact;
}

export async function deleteContact(id: string): Promise<void> {
  const db = await marketingDb();
  const { error } = await db.from("marketing_contacts").delete().eq("id", id);
  if (error) throw error;
}

export async function importContacts(
  rows: Array<{
    email: string;
    first_name?: string;
    last_name?: string;
    company?: string;
    title?: string;
    source?: string;
  }>,
  list_id?: string
): Promise<{ imported: number; skipped: number }> {
  const db = await marketingDb();

  const valid = rows.filter((r) => r.email?.includes("@"));
  if (valid.length === 0) return { imported: 0, skipped: rows.length };

  const { data: contacts, error } = await db
    .from("marketing_contacts")
    .upsert(valid, { onConflict: "email" })
    .select("id");

  if (error) throw error;

  if (list_id && contacts && contacts.length > 0) {
    const memberships = contacts.map((c: { id: string }) => ({
      list_id,
      contact_id: c.id,
    }));
    await db
      .from("marketing_list_contacts")
      .upsert(memberships, { onConflict: "list_id,contact_id" });
  }

  return { imported: contacts?.length ?? 0, skipped: rows.length - valid.length };
}

export async function getLists(): Promise<MarketingList[]> {
  const db = await marketingDb();
  const { data, error } = await db
    .from("marketing_lists")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MarketingList[];
}

export async function createList(name: string, description?: string): Promise<MarketingList> {
  const db = await marketingDb();
  const { data, error } = await db
    .from("marketing_lists")
    .insert({ name, description })
    .select()
    .single();
  if (error) throw error;
  return data as MarketingList;
}

export async function isUnsubscribed(email: string): Promise<boolean> {
  const db = await marketingDb();
  // Case-insensitive match so a case difference between the stored suppression
  // and the recipient address can't let an unsubscribed person through.
  const { data } = await db
    .from("marketing_unsubscribes")
    .select("email")
    .ilike("email", email.trim())
    .maybeSingle();
  return !!data;
}

export async function addUnsubscribe(email: string, reason = "user_request"): Promise<void> {
  const db = await marketingDb();
  // Store normalized so suppression is consistent regardless of source casing.
  await db
    .from("marketing_unsubscribes")
    .upsert({ email: email.trim().toLowerCase(), reason }, { onConflict: "email" });
}
