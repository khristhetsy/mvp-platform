// Read/write helpers for the crm_contacts mirror + crm_sync_state. Service-role
// only (PII). Tables aren't in the generated types yet → untyped raw client.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { CrmContact } from "@/lib/crm-connectors/source-types";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

export async function upsertContacts(contacts: CrmContact[]): Promise<number> {
  if (contacts.length === 0) return 0;
  const supabase = raw(createServiceRoleClient());

  // Link to an existing Supabase profile by email where one exists.
  const emails = [...new Set(contacts.map((c) => c.email?.toLowerCase()).filter(Boolean))] as string[];
  const profileByEmail = new Map<string, string>();
  if (emails.length) {
    const { data } = await supabase.from("profiles").select("id, email").in("email", emails);
    for (const p of (data ?? []) as { id: string; email: string | null }[]) {
      if (p.email) profileByEmail.set(p.email.toLowerCase(), p.id);
    }
  }

  const rows = contacts.map((c) => ({
    source: c.source,
    external_id: c.externalId,
    module: c.module,
    name: c.name,
    email: c.email,
    company: c.company,
    phone: c.phone,
    website: c.website,
    stage: c.stage,
    owner: c.owner,
    plan: c.plan,
    tags: c.tags,
    raw: c.raw,
    supabase_profile_id: c.email ? profileByEmail.get(c.email.toLowerCase()) ?? null : null,
    synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("crm_contacts").upsert(rows, { onConflict: "source,external_id" });
  if (error) throw new Error(error.message);
  return rows.length;
}

export type SyncState = {
  source: string;
  last_full_import_at: string | null;
  last_delta_at: string | null;
  last_cursor: string | null;
  total_imported: number;
  last_error: string | null;
};

export async function getSyncState(source: string): Promise<SyncState | null> {
  const supabase = raw(createServiceRoleClient());
  const { data } = await supabase.from("crm_sync_state").select("*").eq("source", source).maybeSingle();
  return (data as SyncState | null) ?? null;
}

export async function setSyncState(source: string, patch: Partial<SyncState>): Promise<void> {
  const supabase = raw(createServiceRoleClient());
  await supabase
    .from("crm_sync_state")
    .upsert({ source, ...patch, updated_at: new Date().toISOString() }, { onConflict: "source" });
}

export async function countMirror(
  source: string,
): Promise<{ total: number; founders: number; investors: number; unclassified: number }> {
  const supabase = raw(createServiceRoleClient());
  const one = async (module?: string) => {
    let q = supabase.from("crm_contacts").select("id", { count: "exact", head: true }).eq("source", source);
    if (module) q = q.eq("module", module);
    const { count } = await q;
    return count ?? 0;
  };
  const [total, founders, investors, unclassified] = await Promise.all([
    one(), one("founder"), one("investor"), one("unknown"),
  ]);
  return { total, founders, investors, unclassified };
}

/** Patch a mirrored contact's top-level columns + merge raw fields after an Odoo write. */
export async function patchMirrorContact(
  externalId: string,
  patch: { name?: string | null; email?: string | null; company?: string | null; rawPatch?: Record<string, unknown> },
): Promise<void> {
  const supabase = raw(createServiceRoleClient());
  const { data } = await supabase
    .from("crm_contacts")
    .select("raw")
    .eq("source", "odoo")
    .eq("external_id", externalId)
    .maybeSingle();
  const existingRaw = ((data as { raw?: Record<string, unknown> } | null)?.raw ?? {}) as Record<string, unknown>;
  const update: Record<string, unknown> = { synced_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.email !== undefined) update.email = patch.email;
  if (patch.company !== undefined) update.company = patch.company;
  if (patch.rawPatch) update.raw = { ...existingRaw, ...patch.rawPatch };
  await supabase.from("crm_contacts").update(update).eq("source", "odoo").eq("external_id", externalId);
}

/** Remove a mirrored contact (e.g. after archiving in Odoo). */
export async function deleteMirrorContact(externalId: string): Promise<void> {
  const supabase = raw(createServiceRoleClient());
  await supabase.from("crm_contacts").delete().eq("source", "odoo").eq("external_id", externalId);
}

export async function recentContacts(source: string, limit = 8) {
  const supabase = raw(createServiceRoleClient());
  const { data } = await supabase
    .from("crm_contacts")
    .select("name, module, email, stage, synced_at")
    .eq("source", source)
    .order("synced_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as { name: string | null; module: string; email: string | null; stage: string | null; synced_at: string }[];
}
