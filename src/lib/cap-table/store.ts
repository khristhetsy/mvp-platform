// Data access for the founder cap table (one row per company).
// cap_tables isn't in generated types yet — local raw() cast.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { CapTable, Holder, RoundModel } from "./types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

type Row = Record<string, unknown>;

function mapTable(r: Row): CapTable {
  return {
    holders: (r.holders as Holder[]) ?? [],
    round: (r.round as RoundModel | null) ?? null,
    updatedAt: (r.updated_at as string | null) ?? null,
  };
}

export async function getCapTable(
  supabase: SupabaseClient<Database>,
  companyId: string,
): Promise<CapTable | null> {
  const { data, error } = await raw(supabase)
    .from("cap_tables")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapTable(data as Row) : null;
}

export async function upsertCapTable(
  supabase: SupabaseClient<Database>,
  companyId: string,
  editorId: string,
  patch: { holders?: Holder[]; round?: RoundModel | null },
): Promise<CapTable> {
  const record: Record<string, unknown> = { company_id: companyId, last_edited_by: editorId };
  if (patch.holders !== undefined) record.holders = patch.holders;
  if (patch.round !== undefined) record.round = patch.round;

  const { data, error } = await raw(supabase)
    .from("cap_tables")
    .upsert(record, { onConflict: "company_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapTable(data as Row);
}
