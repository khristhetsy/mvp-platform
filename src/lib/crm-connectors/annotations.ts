// Read/write internal CRM annotations (crm_contact_annotations). Service-role
// only (the admin API gates on requireRole). Keyed by (source, external_id) so
// annotations survive Odoo re-imports.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { CrmAnnotation } from "@/lib/crm/types";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

const SOURCE = "odoo";

export async function getAnnotation(externalId: string): Promise<CrmAnnotation | null> {
  const supabase = raw(createServiceRoleClient());
  const { data } = await supabase
    .from("crm_contact_annotations")
    .select("owner, status, tags, notes, updated_at")
    .eq("source", SOURCE)
    .eq("external_id", externalId)
    .maybeSingle();
  if (!data) return null;
  const row = data as { owner: string | null; status: string | null; tags: string[] | null; notes: string | null; updated_at: string | null };
  return {
    owner: row.owner,
    status: row.status,
    tags: row.tags ?? [],
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

export async function upsertAnnotation(
  externalId: string,
  patch: { owner?: string | null; status?: string | null; tags?: string[]; notes?: string | null },
  updatedBy: string | null,
): Promise<CrmAnnotation> {
  const supabase = raw(createServiceRoleClient());
  const row = {
    source: SOURCE,
    external_id: externalId,
    owner: patch.owner ?? null,
    status: patch.status ?? null,
    tags: patch.tags ?? [],
    notes: patch.notes ?? null,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("crm_contact_annotations")
    .upsert(row, { onConflict: "source,external_id" })
    .select("owner, status, tags, notes, updated_at")
    .single();
  if (error) throw new Error(error.message);
  const r = data as { owner: string | null; status: string | null; tags: string[] | null; notes: string | null; updated_at: string | null };
  return { owner: r.owner, status: r.status, tags: r.tags ?? [], notes: r.notes, updatedAt: r.updated_at };
}
