// Field (signature_fields) data access. Service-role client only.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { AutoSource, FieldType, SignatureField } from "./types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export type FieldInput = {
  field_type: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required?: boolean;
  auto_source?: AutoSource | null;
  placeholder?: string | null;
};

export async function listFields(
  supabase: SupabaseClient<Database>,
  requestId: string,
): Promise<SignatureField[]> {
  const { data } = await raw(supabase)
    .from("signature_fields")
    .select("*")
    .eq("request_id", requestId)
    .order("page", { ascending: true })
    .order("created_at", { ascending: true });
  return (data as unknown as SignatureField[]) ?? [];
}

/** Replace the entire field set for a request (delete-all, then insert). */
export async function replaceFields(
  supabase: SupabaseClient<Database>,
  requestId: string,
  fields: FieldInput[],
): Promise<SignatureField[]> {
  await raw(supabase).from("signature_fields").delete().eq("request_id", requestId);

  if (fields.length === 0) return [];

  const rows = fields.map((f) => ({
    request_id: requestId,
    field_type: f.field_type,
    page: f.page,
    x: f.x,
    y: f.y,
    width: f.width,
    height: f.height,
    required: f.required ?? true,
    // Auto-fill source is implied by field type unless explicitly set.
    auto_source:
      f.auto_source ??
      (f.field_type === "date" ? "signing_date" : f.field_type === "company" ? "signer_company" : null),
    placeholder: f.placeholder ?? null,
  }));

  const { data, error } = await raw(supabase).from("signature_fields").insert(rows).select("*");
  if (error) throw new Error(`Could not save fields: ${error.message}`);
  return (data as unknown as SignatureField[]) ?? [];
}
