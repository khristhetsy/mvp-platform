import { marketingDb } from "./db";
import type { MarketingContact, MarketingList } from "./types";

export async function getContacts(opts?: {
  search?: string;
  list_id?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}): Promise<{ contacts: MarketingContact[]; total: number }> {
  const db = await marketingDb();

  let query = db
    .from("marketing_contacts")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

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

  query = query.range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 50) - 1);

  const { data, count, error } = await query;
  if (error) throw error;
  return { contacts: (data ?? []) as MarketingContact[], total: count ?? 0 };
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
  const { data } = await db
    .from("marketing_unsubscribes")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  return !!data;
}

export async function addUnsubscribe(email: string, reason = "user_request"): Promise<void> {
  const db = await marketingDb();
  await db
    .from("marketing_unsubscribes")
    .upsert({ email, reason }, { onConflict: "email" });
}
