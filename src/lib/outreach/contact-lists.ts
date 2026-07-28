import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Reusable, named investor contact lists for manual outreach. A founder builds a
 * list (from their contacts / an import), names it, and can pick it again for a
 * future campaign.
 */

export type ContactList = {
  id: string;
  name: string;
  contactIds: string[];
  updatedAt: string;
};

function client(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export async function getContactLists(companyId: string): Promise<ContactList[]> {
  const { data } = await client()
    .from("founder_contact_lists")
    .select("id, name, contact_ids, updated_at")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });
  return ((data ?? []) as Array<{ id: string; name: string; contact_ids: string[] | null; updated_at: string }>).map(
    (r) => ({
      id: r.id,
      name: r.name,
      contactIds: Array.isArray(r.contact_ids) ? r.contact_ids : [],
      updatedAt: r.updated_at,
    }),
  );
}

/** Create or update (by id) a named list. Ownership-verified. Returns the id. */
export async function saveContactList(
  companyId: string,
  founderId: string,
  input: { id?: string | null; name: string; contactIds: string[] },
): Promise<string | null> {
  const db = client();
  const { data: owned } = await db
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("founder_id", founderId)
    .maybeSingle();
  if (!owned) return null;

  const now = new Date().toISOString();
  if (input.id) {
    const { data } = await db
      .from("founder_contact_lists")
      .update({ name: input.name, contact_ids: input.contactIds, updated_at: now })
      .eq("id", input.id)
      .eq("company_id", companyId)
      .select("id")
      .maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  }

  const { data } = await db
    .from("founder_contact_lists")
    .insert({ company_id: companyId, name: input.name, contact_ids: input.contactIds, created_by: founderId })
    .select("id")
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}
