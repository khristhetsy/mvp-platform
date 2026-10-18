import "server-only";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";

/**
 * The field choices an admin confirmed per column header, reused on the next import.
 * Service role only: the table has RLS on with no policies, like the other directory tables.
 */
export async function loadImportMemory(profileId: string): Promise<Record<string, string[]>> {
  const { data, error } = await serviceRoleClientUntyped()
    .from("investor_directory_import_memory")
    .select("header_key, fields")
    .eq("profile_id", profileId)
    .limit(2000);
  if (error) throw new Error(error.message);
  const out: Record<string, string[]> = {};
  for (const r of (data ?? []) as { header_key: string; fields: string[] }[]) out[r.header_key] = r.fields ?? [];
  return out;
}

export async function saveImportMemory(profileId: string, answers: Record<string, string[]>): Promise<void> {
  const rows = Object.entries(answers).slice(0, 500).map(([header_key, fields]) => ({
    profile_id: profileId, header_key: header_key.slice(0, 200), fields, updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return;
  const { error } = await serviceRoleClientUntyped().from("investor_directory_import_memory").upsert(rows, { onConflict: "profile_id,header_key" });
  if (error) throw new Error(error.message);
}
